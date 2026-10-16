# Current changes

## 2.1.0

- Expand the compiler-checked public recipe catalog with adapted internet examples and their pinned provenance, licenses and dependency boundaries.
- Working-copy sync: native selected export runs one component per call (APEX 26.2 rejects component lists with ORA-20987); readback equivalence reads template-option lists, ignores member and key order where explicit sequences decide execution, and accepts the canonical forms and defaults of native 26.2 exports; planning ignores canonical-only server rewrites, so a full import no longer blocks the next selected or full plan.
- APEX 26.1: accept hyphenated workspace names without relaxing SQL schema identifiers; MCP apply now dispatches an explicitly reviewed saved plan to the guarded apply worker.
- Testing: add 67 APEX 26.1 baseline and quality/performance cases, nine host-browser cases, separate APEX 26.2 extension, agent-task, Codex/Claude host, quality-performance and Bitcoin demo catalogs. Qualification includes title-import preservation, read-only 20-repetition benchmarks and actual host time/token checkpoints; installed-host and release-specific evidence remain separate.
- SQL review closes classification gaps: `EXEC`/`EXECUTE` shorthand, anonymous blocks with assignments or expression calls, queries calling user routines, privileged `CREATE` statements, `ALTER`/`DROP` across object kinds (users, roles, triggers, materialized views, links), `ALTER SESSION`, `PURGE`/`FLASHBACK` and program units after a preceding statement are reviewed as dangerous; control-only blocks and ordinary schema creation stay ordinary.
- Composer: extension code tokenizes doubled quotes correctly, denies APEX dynamic-execution wrappers (`apex_exec.execute_plsql`, `apex_plugin_util.execute_plsql_code`, `dbms_xmlgen`), and row predicates reject dotted names that are not allowlisted functions or columns of the bound table (parenthesis-free routine calls).
- SQLcl processes run as their own process group and timeouts/cancellations stop the whole tree; the runner resolves even when a descendant holds the pipes. The Windows verbatim runner shares this implementation and honours cancellation.
- Jobs: a detached worker that exits before its first heartbeat records a known failure; `apexrest_job` reports a terminal job's recorded outcome on the envelope; one transient heartbeat write error no longer cancels a live import; cancel requests reach a worker whose heartbeat stalled; unknown job or artifact IDs return not-found faults.
- `apexrest_ship`: `mode:recover` requires `run`, `plan`/`confirmation` bind to `mode:apply`, and a failed automatic recovery keeps the interrupted `deploymentRunId`.
- `passwordFile` must be inside the managed home, the project directory or the working directory; the PowerShell launcher exits non-zero when Node fails to start.
- Documentation: README tool rows name `envFile` and `mode:recover`; connected SQLcl sessions are documented as one server per call.

## Included capabilities

- APEX 26.1 and 26.2 release profiles, references and starter templates.
- Automatic and explicit APEX 26.2 selected-file imports through direct SQLcl CLI, with three-way conflict checks, fresh backups, bound scope, conservative readback and server checkpoints.
- Advisory CodeScan and source-upgrade diagnostics; SQLcl 26.3 generation isolation and compatible ORDS library handling.
- Host-neutral verification browser mode and Codex/Claude Code installation and invocation guidance.
- CRM SQL annotations, interactive-report filter cleanup, deletion confirmation and 26.2 session rejoin.
- Resumable post-deploy authentication: `awaiting_reauth`, `POST_DEPLOY_REAUTH_REQUIRED` and import-free `deploy verify`.
- CI on pushes to `main` only; repository release and Oracle integration workflows disabled.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
