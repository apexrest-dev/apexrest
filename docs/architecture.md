# Architecture

APEXREST is one policy-aware core behind three surfaces: a stdio MCP server for Codex and Claude Code, the `apexrest` CLI and six skills that tell the host agent how to use them. Ten MCP tools expose bounded operations; the CLI keeps granular commands. Both surfaces validate inputs against the same strict Zod schemas in `packages/core/src/operations.ts`.

Implementation runs in the user's open conversation. See [host integration](codex-integration.md) for ownership and host boundaries.

Oracle operations use SQLcl in `cli` mode (subprocess) or `mcp` mode (the official SQLcl stdio server, distinct from the APEXREST MCP server) over the `direct` listener or `ords` transport. See [configuration](configuration.md) and [SQL through ORDS](ords.md).

![APEXREST architecture from the agent through source, deployment planning, Oracle and verification.](assets/overview.svg)

## Components

| Component                                 | Responsibility                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/apexrest-apex/skills/`           | `apexrest-work` (the end-to-end cycle), `apexrest-apexlang`, `apexrest-safety`, `apexrest-setup`, `apexrest-pattern-catalog`, `apexrest-oracle-sync` |
| `packages/mcp/`                           | Stdio MCP catalog, structured output, in-process and detached job dispatch                                                                           |
| `packages/cli/`                           | CLI parsing and JSON output, backed by the same operation schemas                                                                                    |
| `packages/core/`                          | Configuration, connections, references, SQLcl sessions, deployment policy, browser handoff, jobs, artifacts and the status snapshot                  |
| `packages/installer/`                     | Reviewed downloads, safe extraction, managed runtimes and Codex registration                                                                         |
| `resources/`, `templates/`, `toolchains/` | Pinned references, component and pattern catalogs, project starters and toolchain definitions                                                        |

`plugins/metadata.json` drives the build in `scripts/build-plugin.mjs`, which writes the Codex manifest (`.codex-plugin/plugin.json`, `.mcp.json`), the Claude Code manifest (`.claude-plugin/plugin.json`) and both marketplace files, shares ESM runtime chunks and copies skills, reference fragments, schemas, templates and locks into one self-contained bundle. `npm run plugin:sync` refreshes the checked-in copy under `plugins/apexrest-apex` and the repository marketplaces. MCP startup performs no dependency downloads and needs no extra global MCP registration.

## Request lifecycle

Short operations return one structured result (`ok`, `status`, `runId`, `diagnostics`, `artifacts`, `nextActions`, `data`). Long operations are jobs with a durable `state.json`, heartbeat and `phase`:

- `apexrest_apex_validate`, `apexrest_reference`, `apexrest_metadata_read`, `apexrest_ship` `mode:plan`, `apexrest_apex_sync` run inside the MCP server process, reusing one `OracleAdapter` per managed-home settings digest.
- `apexrest_ship` `mode:apply` validates and plans in-process, then runs the apply phase in a detached worker so a database write survives host termination. The call waits up to `waitSeconds` (default 25, maximum 120; 25 and 30 for other long tools) and otherwise returns the `jobId`.

`apexrest_job` reads or cancels an existing job; the agent never restarts an operation to fetch its result. A lost heartbeat or an interruption during a write produces `outcome_unknown`, which never implies a rollback. Workers have a 15-minute deadline. SQLcl has separate process timeouts and classified diagnostics, including commands that print an error despite exit code zero.

## Persistent SQLcl engine

SQLcl executes a piped script only after stdin EOF, so a long-lived engine uses SQLcl's own server mode (`sql -mcp`). `packages/core/src/sqlcl-session.ts` keeps one server process per key (executable, Java home, server arguments, connection name, working directory) for the lifetime of the MCP server process. Commands on one session are serialized; a key opens at most a configured number of sessions (two for `/nolog` work, one per saved connection) and queues the rest. A timed-out, cancelled, truncated or failed command kills its session; idle sessions are unref'd, reaped after ten minutes and killed at exit, so a one-shot CLI call still exits naturally.

`cli` mode pools offline validation and help; 26.1 generation keeps its established pooling behavior, while 26.3 generation uses a disposable process to avoid the verified compiler-state leak. Connected sessions use one process per call (saved `-name` connections and ORDS `connect -orest`); `mcp` mode isolates connected batches in fresh servers. The capability probe (`help apex`, compiler version) runs once per SQLcl installation per process and is invalidated when the installation changes. Connected timing requires separate qualification. Compiler output is parsed into structured diagnostics (`file`, `line`, `column`, `type`, `message`, `validValues`, `hint`).

## Oracle boundary

Application generation, export, validation and import use real Oracle SQLcl. APEXlang source is validated on a staging copy, preserving the working tree and Oracle `.apex` metadata. Reviewed version-aware references, the component catalog and the pattern catalog are local indexed data; upstream router instructions and arbitrary scripts are not installed as agent authority.

The adapter combines target identity fields in one fresh query, never caches live target state, and overlaps independent compilation and read-only target work during planning. All preflight tasks settle before an error is returned or a write begins.

## Deployment boundary

A plan binds source, configuration, compiler/toolchain, target identity, target content and migration history and expires after 30 minutes. Both `apexrest_ship` and granular CLI planning accept `importMode: auto|files|full` (`--import-mode` in the CLI). `auto` selects eligible 26.2 changed files or records full-import reasons; `files` binds explicit application-relative paths without expansion or full fallback; `full` forces a complete application import. The preview exposes requested/resolved mode, selected files, selected shared-component dependencies and reasons. APEX 26.1 uses full imports.

Partial planning requires an existing dev/test application and trusted sync checkpoint, the reviewed APEX 26.2 / SQLcl `26.3.0.260.1620` / MMD `26.2.0+3479` profile, and direct SQLcl CLI transport. The agent chooses automatic, exact-files or full mode from the intended change. Native page selectors export only selected pages. Shared-component file imports explicitly bind full APEXlang observation where native component export is unavailable; only selected files enter conflict checks, backups and readback comparison. Unsupported import families and global changes require a full import. Explicit selection never silently widens, and a conflict never causes fallback.

`partial-import.ts` compares the saved baseline, local intent and freshly selected server content. It stages selected local files over retained dependency context and compiles that whole effective tree once. A local no-op makes no Oracle call. Identity/version queries are batched; identical read/deploy connections reuse the fresh identity result. Import-help capability checks share an installation-bound cache.

Apply acquires local schema ownership before checking live drift. The fresh pre-apply APEXlang export supplies the scoped backup, then frozen sources reach one `apex import -files` call. Selected readback records exact hashes, qualified normalization and verified scope; unselected server content is not claimed as freshly verified. The checkpoint retains dependency context and verified selected sources, preserving unselected local work. A separate full import observes the full server inventory and refuses to overwrite unreconciled remote edits. Independent homes/machines require external serialization.

New backups use APEXlang, including full initial sync snapshots; ordinary flows do not create SQL application dumps. Selected restore uses a separate exact plan and the same scope. Creation backups record absence and do not masquerade as a deletion rollback. Explicit old SQL backups remain restore-compatible. Recovery reads original scope before resolving unknown outcomes. Exact-plan grants, identity, compiler, backup integrity and production refusal remain mandatory. See [partial-import safeguards](deployment-safety.md#apex-262-partial-imports).

## Trust and data handling

Project SQL and APEXlang are executable inputs. No manual folder trust list is required; host filesystem permissions govern project access. Database descriptions, source comments, reference content and operation output are data, not instructions to expand permissions. Credentials stay in SQLcl's store, the private ORDS credential file; browser authentication belongs to the host.

Filesystem operations reject traversal, symlinks and special files where the policy requires contained files. State uses atomic writes and exclusive ownership; subprocesses execute without a shell. Artifact readers expose bounded registered text and apply redaction. These controls do not replace the host's permission boundary or production deployment refusal. See [security](../SECURITY.md).

Complete release-specific Oracle source contracts and maintainer synchronization are described in [Oracle APEXlang coverage](oracle-apexlang-coverage.md). Full documents are lazy-loaded and checksum-verified; summary indexes are routing data.
