# Architecture

Historical redesign timing, ranking and size-baseline estimates are unverified. Current exact sizes and fresh offline SQLcl timings are recorded in [local redesign evidence](evidence/redesign-phase1-local.json).

APEXREST is one policy-aware core behind three surfaces: a stdio MCP server for Codex and Claude Code, the `apexrest` CLI and five skills that tell the host agent how to use them. Eleven MCP tools expose bounded operations; the CLI keeps granular commands. Both surfaces validate inputs against the same strict Zod schemas in `packages/core/src/operations.ts`.

Implementation runs in the user's open conversation. See [host integration](codex-integration.md) for ownership and host boundaries.

Oracle operations use SQLcl in `cli` mode (subprocess) or `mcp` mode (the official SQLcl stdio server, distinct from the APEXREST MCP server) over the `direct` listener or `ords` transport. See [configuration](configuration.md) and [SQL through ORDS](ords.md).

![APEXREST architecture from the agent through source, deployment planning, Oracle and verification.](assets/overview.svg)

## Components

| Component                                 | Responsibility                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `plugins/apexrest-apex/skills/`           | `apexrest-work` (the end-to-end cycle), `apexrest-apexlang`, `apexrest-safety`, `apexrest-setup`, `apexrest-pattern-catalog` |
| `packages/mcp/`                           | Stdio MCP catalog, structured output, in-process and detached job dispatch                                                   |
| `packages/cli/`                           | CLI parsing and JSON output, backed by the same operation schemas                                                            |
| `packages/core/`                          | Configuration, connections, references, SQLcl sessions, deployment policy, testing, jobs, artifacts and the status snapshot  |
| `packages/installer/`                     | Reviewed downloads, safe extraction, managed runtimes and Codex registration                                                 |
| `packages/testkit/`                       | Browser/API helpers for application tests                                                                                    |
| `resources/`, `templates/`, `toolchains/` | Pinned references, component and pattern catalogs, project starters and toolchain definitions                                |

`plugins/metadata.json` drives the build in `scripts/build-plugin.mjs`, which writes the Codex manifest (`.codex-plugin/plugin.json`, `.mcp.json`), the Claude Code manifest (`.claude-plugin/plugin.json`) and both marketplace files, shares ESM runtime chunks and copies skills, reference fragments, schemas, templates and locks into one self-contained bundle. `npm run plugin:sync` refreshes the checked-in copy under `plugins/apexrest-apex` and the repository marketplaces. MCP startup performs no dependency downloads and needs no extra global MCP registration.

## Request lifecycle

Short operations return one structured result (`ok`, `status`, `runId`, `diagnostics`, `artifacts`, `nextActions`, `data`). Long operations are jobs with a durable `state.json`, heartbeat and `phase`:

- `apexrest_apex_validate`, `apexrest_reference`, `apexrest_metadata_read`, `apexrest_ship` `mode:plan`, `apexrest_apex_sync` and local `apexrest_test_run` suites run inside the MCP server process, reusing one `OracleAdapter` per managed-home settings digest.
- `apexrest_ship` `mode:apply` validates and plans in-process, then runs the apply phase in a detached worker so a database write survives host termination; remote test suites (`sql`, `api`, `e2e`, `all`) use the same worker. The call waits up to `waitSeconds` (default 25, maximum 120; 25 and 30 for other long tools) and otherwise returns the `jobId`.

`apexrest_job` reads or cancels an existing job; the agent never restarts an operation to fetch its result. A lost heartbeat or an interruption during a write produces `outcome_unknown`, which never implies a rollback. Workers have a 15-minute deadline. SQLcl has separate process timeouts and classified diagnostics, including commands that print an error despite exit code zero.

## Persistent SQLcl engine

SQLcl executes a piped script only after stdin EOF, so a long-lived engine uses SQLcl's own server mode (`sql -mcp`). `packages/core/src/sqlcl-session.ts` keeps one server process per key (executable, Java home, server arguments, connection name, working directory) for the lifetime of the MCP server process. Commands on one session are serialized; a key opens at most a configured number of sessions (two for `/nolog` work, one per saved connection) and queues the rest. A timed-out, cancelled, truncated or failed command kills its session; idle sessions are unref'd, reaped after ten minutes and killed at exit, so a one-shot CLI call still exits naturally.

`cli` mode pools offline validation and help; 26.1 generation keeps its established pooling behavior, while 26.3 generation uses a disposable process to avoid the verified compiler-state leak. Connected sessions use one process per call (saved `-name` connections and ORDS `connect -orest`); `mcp` mode isolates connected batches in fresh servers. The capability probe (`help apex`, compiler version) runs once per SQLcl installation per process and is invalidated when the installation changes. Connected timing qualification is NOT RUN; local offline measurements are recorded in the linked evidence. Compiler output is parsed into structured diagnostics (`file`, `line`, `column`, `type`, `message`, `validValues`, `hint`).

## Oracle boundary

Application generation, export, validation and import use real Oracle SQLcl. APEXlang source is validated on a staging copy, preserving the working tree and Oracle `.apex` metadata. Reviewed version-aware references, the component catalog and the pattern catalog are local indexed data; upstream router instructions and arbitrary scripts are not installed as agent authority.

The adapter combines target identity fields in one fresh query, never caches live target state, and overlaps independent compilation and read-only target work during planning. All preflight tasks settle before an error is returned or a write begins.

## Deployment boundary

A plan binds source, configuration, compiler/toolchain, target identity, target content and migration history and expires after 30 minutes. Both `apexrest_ship` and granular CLI planning accept `importMode: auto|files|full` (`--import-mode` in the CLI). `auto` selects eligible 26.2 changed files or records full-import reasons; `files` binds explicit application-relative paths without expansion or full fallback; `full` forces a complete application import. The preview exposes requested/resolved mode, selected files, selected shared-component dependencies and reasons. These 26.2 additions are in the source checkout and are not part of published npm `1.3.0`; 26.1 retains its full-import behavior.

Partial planning requires an existing dev/test application and trusted sync checkpoint, the reviewed APEX 26.2 / SQLcl `26.3.0.260.1620` / MMD `26.2.0+3479` profile, and direct SQLcl CLI transport inside the adapter. A host can invoke it through APEXREST's MCP server; this transport restriction concerns SQLcl's own MCP mode and ORDS. `partial-import.ts` compares baseline, local and fresh server inventories, blocks conflicting local/server edits, and stages selected local files over the server tree. Whole-tree compilation checks a selected page with its shared LOV and other dependencies. Unselected remote edits are preserved; missing local dependencies are never silently added. Unsupported changes can require a full plan, but observed remote changes must be reconciled before an automatic full fallback.

Apply verifies the plan binding, checks current identity and drift, freezes the sources and takes ownership before writing. Partial plans use schema v4, bind the exact file list and effective tree, and always take a fresh full SQL backup before one SQLcl `apex import -files` call. Complete server readback verifies selected and unselected content, and the actual verified export becomes the sync checkpoint after required test gates. Local reconciliation preserves unselected edits; before/effective/server snapshots and backup/run journals remain durable. Legacy 26.1 working-copy plans retain their initial-backup behavior, while the full-export path creates a fresh SQL backup for an existing application. `apexrest_ship` records a plan-bound deploy grant from the user's explicit request before apply and removes it afterwards; production targets are refused and keep the signed external approval path. Post-import checks and configured test gates remain part of completion. See [partial-import safeguards](deployment-safety.md#apex-262-partial-imports).

Migration history and ownership are always local: `$APEXREST_HOME/deployment-control/`, scoped to database identity and parsing schema. They coordinate runners sharing one managed home; independent machines or homes need external serialization, because filesystem locking is not a distributed database guarantee and no database-backed mode exists. See [deployment safety](deployment-safety.md).

## Trust and data handling

Project SQL, tests and APEXlang are executable inputs. The project must be reviewed and trusted locally. Database descriptions, source comments, reference content and test output are data, not instructions to expand permissions. Credentials stay in SQLcl's store, the private ORDS credential file and the browser auth store.

Filesystem operations reject traversal, symlinks and special files where the policy requires contained files. State uses atomic writes and exclusive ownership; subprocesses execute without a shell. Artifact readers expose bounded registered text and apply redaction. These controls do not replace the host's permission boundary or protected production approval. See [security](../SECURITY.md).
