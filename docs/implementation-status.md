# Implementation status

The current source and bundled plugin version is **2.0.0**. The current contract is described in [architecture](architecture.md), [testing](testing.md) and the [acceptance matrix](acceptance.json).

## Implemented

- Five skills and eleven composite MCP tools for Codex and Claude Code, backed by the same CLI/runtime and host manifests.
- Oracle SQLcl generation/validation, pinned release-specific references, blank/CRM templates and an experimental local Composer CLI.
- APEX 26.1 full imports and eligible APEX 26.2 selected-file imports through direct SQLcl CLI, with exact plan binding, fresh backups, three-way conflict checks, readback verification and durable checkpoints.
- Local durable migration history and schema coordination. Independent machines or managed homes require external serialization.
- Required-suite gates, read-only E2E session probing, the blocked `awaiting_reauth` state and import-free `deploy verify` after the user renews browser authentication.
- Private named connections, project trust, scoped grants, redaction, bounded jobs/artifacts and recovery safeguards for unknown outcomes.
- Offline component, pattern, block and blueprint discovery. Recipe/compiler qualification belongs to the functional catalog and does not establish deployed application behavior.

## Verification

Run the relevant checks in [testing](testing.md) against the current source. Local unit, contract, installer, documentation and packaging checks establish their stated fixture/build behavior. Oracle compilation, connected imports/SQL tests, authenticated application browsing and fresh native model-host execution require separate checks on an authorized target. Missing or skipped required suites never count as passed.

Current local checks pass: lint, typecheck, documentation links/commands, Composer catalog consistency, plugin integrity, site generation, release dry-run, 367 unit tests, 61 contracts, 46 installer tests and 27 packaging tests. One real SQLcl opt-in test is skipped. The installed repository CLI/stdio MCP smoke check passes; it does not execute a model-host session or connect to Oracle.

Release readiness requires source-bound reports for every mandatory gate. Generated reports are private working output under ignored `docs/evidence/`; their absence blocks readiness. No connected or native-host result is inferred from a local build.

## Repository automation

CI runs automatically only on pushes to `main`. Release and Oracle integration workflows are disabled in GitHub and gated off in their checked-in jobs. The publisher remains disabled. Build, site generation and release dry-run create local output only.

Open checks are listed in [next actions](next-actions.md). Publication, tagging and database changes require their own applicable authorization.
