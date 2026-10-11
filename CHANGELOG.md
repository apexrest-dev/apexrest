# Current changes

## Unreleased

- APEX 26.1: accept hyphenated workspace names without relaxing SQL schema identifiers; MCP apply now dispatches an explicitly reviewed saved plan to the guarded apply worker.
- Testing: add a reusable 49-case APEX 26.1 server catalog, nine host-browser cases, application-title import/preservation checks, six read-only 20-repetition benchmarks and actual host time/token checkpoints. APEX 26.2 extensions and installed-host qualification remain separate.
- SQL review closes classification gaps: `EXEC`/`EXECUTE` shorthand, anonymous blocks with assignments or expression calls, queries calling user routines, privileged `CREATE` statements, `ALTER`/`DROP` across object kinds (users, roles, triggers, materialized views, links), `ALTER SESSION`, `PURGE`/`FLASHBACK` and program units after a preceding statement are reviewed as dangerous; control-only blocks and ordinary schema creation stay ordinary.
- Composer: extension code tokenizes doubled quotes correctly, denies APEX dynamic-execution wrappers (`apex_exec.execute_plsql`, `apex_plugin_util.execute_plsql_code`, `dbms_xmlgen`), and row predicates reject dotted names that are not allowlisted functions or columns of the bound table (parenthesis-free routine calls).
- SQLcl processes run as their own process group and timeouts/cancellations stop the whole tree; the runner resolves even when a descendant holds the pipes. The Windows verbatim runner shares this implementation and honours cancellation.
- Jobs: a detached worker that exits before its first heartbeat records a known failure; `apexrest_job` reports a terminal job's recorded outcome on the envelope; one transient heartbeat write error no longer cancels a live import; cancel requests reach a worker whose heartbeat stalled; unknown job or artifact IDs return not-found faults.
- `apexrest_ship`: `mode:recover` requires `run`, `plan`/`confirmation` bind to `mode:apply`, and a failed automatic recovery keeps the interrupted `deploymentRunId`.
- `passwordFile` must be inside the managed home, the project directory or the working directory; the PowerShell launcher exits non-zero when Node fails to start.
- Documentation: README tool rows name `envFile` and `mode:recover`; connected SQLcl sessions are documented as one server per call.

## 2.0.0 — source bundle

- APEX 26.1 and 26.2 release profiles, references and starter templates.
- Automatic and explicit APEX 26.2 selected-file imports through direct SQLcl CLI, with three-way conflict checks, fresh backups, bound scope, conservative readback and server checkpoints.
- Advisory CodeScan and source-upgrade diagnostics; SQLcl 26.3 generation isolation and compatible ORDS library handling.
- Host-neutral verification browser mode and Codex/Claude Code installation and invocation guidance.
- CRM SQL annotations, interactive-report filter cleanup, deletion confirmation and 26.2 session rejoin.
- Resumable post-deploy authentication: `awaiting_reauth`, `POST_DEPLOY_REAUTH_REQUIRED` and import-free `deploy verify`.
- CI on pushes to `main` only; repository release and Oracle integration workflows disabled.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
