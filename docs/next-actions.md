# Next actions and verification limits

## Connected and host qualification

- Exercise the current five-skill/eleven-tool bundle in fresh Codex and Claude Code sessions: discovery, a change through the work skill, ship/job behavior and browser handoff.
- On an explicitly authorized development/test target, verify full and selected-file imports, source preservation, SQL/API/CRUD suites, denied actions, stale versions and narrow screens. Record compiler, import and browser observations separately.
- Qualify Linux/Windows/WSL2 native installations and connected SQLcl/ORDS behavior. Hosted build tests do not establish native host or Oracle behavior.
- Exercise real interruption, lost-response reconciliation, backup/restore and externally serialized runners. Retain unknown ownership until the outcome is reconciled.

## Application tests and authentication

- Add a diagnostic for the instance-level `REJOIN_EXISTING_SESSIONS=Y` prerequisite before saved-state E2E. Qualify session rejoin in the 26.1 CRM template before changing it.
- Extend session probing beyond a base URL or password-field login only when an actual application demonstrates the requirement; external SSO may need separate handling.
- Consider an import-free verification mode on the MCP surface. The current resume operation is `apexrest deploy verify` in the CLI.
- Extend the integration harness to resume the original deployment journal after interactive authentication; it currently runs final standalone suites. Re-authentication and final suites need an interactive terminal.

## APEX 26.2

- Keep the managed installer default at 26.1 until broader qualification is complete. A 26.2 project needs its explicit profile, compiler and lock.
- ORDS and SQLcl MCP-mode selected-file imports require a separate transport implementation; explicit file mode must continue refusing unsupported transports.
- Extend readback equivalence only with actual Oracle results and negative tests. Unselected files remain byte-exact.
- Qualify provider calls, DDS, OCI IAM/network prerequisites and workflow migration independently of offline recipes and metadata visibility.

## Runtime and Composer

- Complete Composer shared-resource ownership, typed route/consumer handling, property/fault coverage and authenticated Oracle/browser qualification. See [Composer](composer.md).
- Verify the generated save dialog over HTTP/HTTPS and the create-as-edit retry path. Materialization and compiler success do not establish runtime DML or authorization.
- Add recovery for `LOCK_CORRUPT`, clarify first-use integrity records and verify Windows launchers/rename retries.
- Harden protected-runner provisioning and schema-level exact-plan grant requirements without weakening current authorization checks.

## Release and repository policy

Run relevant local checks before integrating changes; CI runs only on `main`. Repository deployment workflows and publisher configuration remain disabled. Refresh current source-bound release evidence before requesting any separately authorized publication. Do not treat absent reports as passed gates.

Preserve functional catalog provenance, licensing and compiler bindings. Preserve private application baselines, SQL backups, migration history and unresolved journals; repository cleanup does not authorize removing active deployment state.
