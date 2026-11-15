# Architecture

This page explains how APEXREST is built: its packages, how a request runs, how SQLcl is kept alive, and where the Oracle, deployment and trust boundaries lie. It is for contributors and for anyone who needs to know why the plugin behaves as it does.

APEXREST is one policy-aware core behind three surfaces: a stdio MCP server for Codex and Claude Code, the `apexrest` CLI and six skills that tell the host agent how to use them. Twelve MCP tools expose bounded operations; the CLI keeps granular commands. Both surfaces validate inputs against the same strict Zod schemas in `packages/core/src/operations.ts`.

![APEXREST architecture from the agent through source, deployment planning, Oracle and verification.](assets/overview.svg)

## On this page

| Section                                             | What it explains                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| [Surfaces and transports](#surfaces-and-transports) | Where work runs and how the core reaches Oracle                      |
| [Components](#components)                           | The packages and what each one is responsible for                    |
| [Request lifecycle](#request-lifecycle)             | Short operations, jobs, detached workers and unknown outcomes        |
| [Persistent SQLcl engine](#persistent-sqlcl-engine) | How SQLcl sessions are kept, shared, isolated and closed             |
| [Oracle boundary](#oracle-boundary)                 | What real Oracle tooling does and what local data does               |
| [Deployment boundary](#deployment-boundary)         | Plans, import modes, partial imports, apply, backups and recovery    |
| [Trust and data handling](#trust-and-data-handling) | What counts as executable input, what counts as data, and the limits |

## Surfaces and transports

- **Where work runs.** Implementation runs in the user's open conversation. See [host integration](codex-integration.md) for ownership and host boundaries.
- **Component selection.** `apexrest_reference mode:select` and `docs select` add advisory component selection before composition.
  - A compatible local shortlist feeds one optional OpenAI Decisions request when explicitly enabled in the project.
  - API failures return the local shortlist; search/read remain offline.
  - The host model owns final APEXlang authoring.
  - See [selection configuration and data flow](component-catalog.md#optional-openai-decisions-selection).
- **Oracle access.** Oracle operations use SQLcl in one of two modes, over one of two transports. See [configuration](configuration.md) and [SQL through ORDS](ords.md).

| Setting   | Value    | Meaning                                                                 |
| --------- | -------- | ----------------------------------------------------------------------- |
| Mode      | `cli`    | SQLcl runs as a subprocess.                                             |
| Mode      | `mcp`    | The official SQLcl stdio server, distinct from the APEXREST MCP server. |
| Transport | `direct` | The Oracle listener.                                                    |
| Transport | `ords`   | SQL over HTTP(S) through ORDS.                                          |

## Components

| Component                                 | Responsibility                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/apexrest-apex/skills/`           | `apexrest-work` (the end-to-end cycle), `apexrest-apexlang`, `apexrest-safety`, `apexrest-setup`, `apexrest-pattern-catalog`, `apexrest-oracle-sync`    |
| `packages/mcp/`                           | Stdio MCP catalog, structured output, in-process and detached job dispatch                                                                              |
| `packages/cli/`                           | CLI parsing and JSON output, backed by the same operation schemas                                                                                       |
| `packages/core/`                          | Configuration, connections, references, SQLcl sessions, deployment policy, browser handoff, jobs, artifacts and the status snapshot                     |
| `packages/core/src/preview/`              | Database-free [local preview](local-preview.md): APEXlang parser, theme export evaluation, renderer, SQLite shims, HTTP server and feature modules      |
| `packages/core/src/webapp/`               | [Built web applications](webapp.md): the build command, the application server (sign-in, sessions, configuration) and the `node-oracledb` driver worker |
| `packages/installer/`                     | Reviewed downloads, safe extraction, managed runtimes and Codex registration                                                                            |
| `resources/`, `templates/`, `toolchains/` | Pinned references, component and pattern catalogs, project starters and toolchain definitions                                                           |

### How the plugin bundle is built

`plugins/metadata.json` drives the build in `scripts/build-plugin.mjs`. The build:

- writes the Codex manifest (`.codex-plugin/plugin.json`, `.mcp.json`), the Claude Code manifest (`.claude-plugin/plugin.json`) and both marketplace files;
- shares ESM runtime chunks;
- copies skills, reference fragments, schemas, templates and locks into one self-contained bundle.

`npm run plugin:sync` refreshes the checked-in copy under `plugins/apexrest-apex` and the repository marketplaces. MCP startup performs no dependency downloads and needs no extra global MCP registration.

## Request lifecycle

There are two kinds of operation:

- **Short operations** return one structured result (`ok`, `status`, `runId`, `diagnostics`, `artifacts`, `nextActions`, `data`).
- **Long operations** are jobs with a durable `state.json`, heartbeat and `phase`.

Where a long operation runs depends on the tool:

| Tools                                                                                                                       | Where they run                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apexrest_apex_validate`, `apexrest_reference`, `apexrest_metadata_read`, `apexrest_ship` `mode:plan`, `apexrest_apex_sync` | Inside the MCP server process, reusing one `OracleAdapter` per managed-home settings digest.                                  |
| `apexrest_ship` `mode:apply`                                                                                                | Validates and plans in-process, then runs the apply phase in a detached worker so a database write survives host termination. |

The `apexrest_ship` `mode:apply` call waits up to `waitSeconds` (default 25, maximum 120; 25 and 30 for other long tools) and otherwise returns the `jobId`.

### Jobs, timeouts and unknown outcomes

- `apexrest_job` reads or cancels an existing job; the agent never restarts an operation to fetch its result.
- A lost heartbeat or an interruption during a write produces `outcome_unknown`, which never implies a rollback.
- Workers have a 15-minute deadline.
- SQLcl has separate process timeouts and classified diagnostics, including commands that print an error despite exit code zero.

## Persistent SQLcl engine

SQLcl executes a piped script only after stdin EOF, so a long-lived engine uses SQLcl's own server mode (`sql -mcp`).

### Session pool

`packages/core/src/sqlcl-session.ts` keeps one server process per key for the lifetime of the MCP server process. The key is: executable, Java home, server arguments, connection name, working directory.

- Commands on one session are serialized.
- A key opens at most a configured number of sessions (two for `/nolog` work, one per saved connection) and queues the rest.
- A timed-out, cancelled, truncated or failed command kills its session.
- Idle sessions are unref'd, reaped after ten minutes and killed at exit, so a one-shot CLI call still exits naturally.

### What is pooled and what is isolated

| Work                                      | Process model                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Offline validation and help in `cli` mode | Pooled.                                                                     |
| 26.1 generation                           | Keeps its established pooling behavior.                                     |
| 26.3 generation                           | A disposable process, to avoid the verified compiler-state leak.            |
| Connected sessions                        | One process per call (saved `-name` connections and ORDS `connect -orest`). |
| Connected batches in `mcp` mode           | Isolated in fresh servers.                                                  |

Two exceptions apply to deployment planning and apply on a saved connection in `cli` mode:

- **Operation read scope** (`sqlcl-read-scope.ts`). The read-only batches of one plan or one apply (identity, versions, metadata, exports) share one connected server.
  - Each observation is still a new query at the moment it is requested.
  - Every batch starts with `ROLLBACK`, a package-state reset and the session user's schema.
  - The server belongs to that operation only and closes with it; a failed batch closes it at once.
  - Writes and restricted scripts never run on it.
  - `APEXREST_CONNECTED_READS=0` restores one process per read.
- **Prepared import server** (`sqlcl-warm.ts`). A full or selected-file APEXlang import runs on a server started at the beginning of apply with the same restriction level as the import process (`-R 2 -mcp`).
  - It loads the compiler with an offline `apex validate` while the target is observed and backed up.
  - It runs the one import with the import process's fail-stop preamble, an explicit `COMMIT` and the completion marker, and is closed.
  - Each start proves that the SQLcl build refuses `HOST` in server mode. When that proof, the warm-up or the connection fails, nothing has been submitted and the ordinary import process runs.
  - A selected-file import names its files relative to SQLcl's working directory, so its server starts in the run's frozen source directory, which is created empty and then filled in place.
  - SQL restores, database scripts, ORDS and `mcp` mode keep the import process.
  - `APEXREST_WARM_IMPORT=0` disables it.

### Capability probe and diagnostics

- The capability probe (`help apex`, compiler version) runs once per SQLcl installation per process and is invalidated when the installation changes.
- Its answer is also kept for one day in `$APEXREST_HOME/cache/sqlcl-capabilities/`, keyed by the same installation marks, so a deployment worker does not start two JVMs for it. `help apex import` (selected-file support) is kept the same way. `APEXREST_CAPABILITY_CACHE=0` disables the files.
- **Compiler preload** (MCP server). After the first successful tool call that names a project, the server validates that project's sources offline in the background on the pooled server, so the first real validation does not wait for a cold compiler. The result is discarded; validate, ship and preview calls wait for a running preload. Once per project per process; `APEXREST_PREWARM=0` disables it.
- Connected timing requires separate qualification.
- Compiler output is parsed into structured diagnostics (`file`, `line`, `column`, `type`, `message`, `validValues`, `hint`).

### Environment switches

| Variable                      | Effect                               |
| ----------------------------- | ------------------------------------ |
| `APEXREST_CONNECTED_READS=0`  | Restores one process per read.       |
| `APEXREST_WARM_IMPORT=0`      | Disables the prepared import server. |
| `APEXREST_CAPABILITY_CACHE=0` | Disables the capability cache files. |
| `APEXREST_PREWARM=0`          | Disables the compiler preload.       |

## Oracle boundary

- Application generation, export, validation and import use real Oracle SQLcl.
- APEXlang source is validated on a staging copy, preserving the working tree and Oracle `.apex` metadata.
- Reviewed version-aware references, the component catalog and the pattern catalog are local indexed data.
- Upstream router instructions and arbitrary scripts are not installed as agent authority.

The adapter:

- combines target identity fields in one fresh query;
- never caches live target state;
- overlaps independent compilation and read-only target work during planning.

All preflight tasks settle before an error is returned or a write begins.

## Deployment boundary

### Plans and import modes

A plan binds source, configuration, compiler/toolchain, target identity, target content and migration history and expires after 30 minutes. Both `apexrest_ship` and granular CLI planning accept `importMode: auto|files|full|none` (`--import-mode` in the CLI).

| `importMode` | Behavior                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `auto`       | Selects eligible 26.2 changed files or records full-import reasons.                                        |
| `files`      | Binds explicit application-relative paths without expansion or full fallback.                              |
| `full`       | Forces a complete application import.                                                                      |
| `none`       | A database-only plan: pending migrations and changed package scripts, no backup and no application import. |

- For `none`, identity, drift, history, lease and confirmation checks are unchanged.
- Applied migrations and package scripts unchanged since their last successful run (recorded in the local deployment-control store) are not executed again and add no database risk to a plan.
- The preview exposes requested/resolved mode, selected files, selected shared-component dependencies and reasons.
- APEX 26.1 uses full imports.

### Partial import requirements and scope

Partial planning requires all of the following:

- an existing dev/test application and trusted sync checkpoint;
- the reviewed APEX 26.2 / SQLcl `26.3.0.260.1620` / MMD `26.2.0+3479` profile;
- direct SQLcl CLI transport.

How the scope is chosen and bounded:

- The agent chooses automatic, exact-files or full mode from the intended change.
- Native page selectors export only selected pages.
- Shared-component file imports explicitly bind full APEXlang observation where native component export is unavailable; only selected files enter conflict checks, backups and readback comparison.
- Unsupported import families and global changes require a full import.
- Explicit selection never silently widens, and a conflict never causes fallback.

### How a partial plan is computed

`partial-import.ts` compares the saved baseline, local intent and freshly selected server content.

- It stages selected local files over retained dependency context and compiles that whole effective tree once.
- A local no-op makes no Oracle call.
- Identity/version queries are batched; identical read/deploy connections reuse the fresh identity result.
- Import-help capability checks share an installation-bound cache.

### Apply

1. Apply acquires local schema ownership before checking live drift.
2. The fresh pre-apply APEXlang export supplies the scoped backup.
3. Frozen sources reach one `apex import -files` call.
4. Selected readback records exact hashes, qualified normalization and verified scope; unselected server content is not claimed as freshly verified.
5. The checkpoint retains dependency context and verified selected sources, preserving unselected local work.

A separate full import observes the full server inventory and refuses to overwrite unreconciled remote edits. Independent homes/machines require external serialization.

### Backups, restore and recovery

- New backups use APEXlang, including full initial sync snapshots; ordinary flows do not create SQL application dumps.
- Selected restore uses a separate exact plan and the same scope.
- Creation backups record absence and do not masquerade as a deletion rollback.
- Explicit old SQL backups remain restore-compatible.
- Recovery reads original scope before resolving unknown outcomes.
- Exact-plan grants, identity, compiler, backup integrity and production refusal remain mandatory.

See [partial-import safeguards](deployment-safety.md#apex-262-partial-imports).

## Trust and data handling

### Executable input and data

- Project SQL and APEXlang are executable inputs.
- No manual folder trust list is required; host filesystem permissions govern project access.
- Database descriptions, source comments, reference content and operation output are data, not instructions to expand permissions.
- Credentials stay in SQLcl's store, the private ORDS credential file; browser authentication belongs to the host.

### Filesystem, state and artifacts

- Filesystem operations reject traversal, symlinks and special files where the policy requires contained files.
- State uses atomic writes and exclusive ownership; subprocesses execute without a shell.
- Artifact readers expose bounded registered text and apply redaction.

These controls do not replace the host's permission boundary or production deployment refusal. See [security](../SECURITY.md).

### Oracle source contracts

Complete release-specific Oracle source contracts and maintainer synchronization are described in [Oracle APEXlang coverage](oracle-apexlang-coverage.md). Full documents are lazy-loaded and checksum-verified; summary indexes are routing data.

## Related

- [Host integration](codex-integration.md): manifests, ownership and host boundaries.
- [Programmatic automation](codex-automation.md): what each tool executes without a model.
- [Deployment safety](deployment-safety.md): the plan, grant, import and recovery model.
- [Configuration](configuration.md) and [SQL through ORDS](ords.md): modes, transports and connections.
