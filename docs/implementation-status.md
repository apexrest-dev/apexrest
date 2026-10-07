# Implementation status

The current source and bundled plugin version is **2.0.0**. The current contract is described in [architecture](architecture.md), [testing](testing.md) and the [acceptance matrix](acceptance.json).

## Implemented

- Five skills and ten composite MCP tools for Codex and Claude Code, backed by the same CLI/runtime and host manifests.
- Oracle SQLcl generation/validation, pinned release-specific references, blank/CRM templates and an experimental local Composer CLI.
- APEX 26.1 full imports and eligible APEX 26.2 selected-file imports through direct SQLcl CLI, with exact plan binding, fresh backups, three-way conflict checks, readback verification and durable checkpoints.
- Local durable migration history and schema coordination. Independent machines or managed homes require external serialization.
- Host in-app browser verification, separate from compiler and deployment completion. No automatic application test runners, saved browser-authentication state or browser-install steps. Dependencies are Node.js, Java and SQLcl.
- Private named connections, project trust, scoped grants, redaction, bounded jobs/artifacts and recovery safeguards for unknown outcomes.
- Offline component, pattern, block and blueprint discovery. Recipe/compiler qualification belongs to the functional catalog and does not establish deployed application behavior.

## Verification

Run the relevant checks in [testing](testing.md) against the current source. Local unit, contract, installer, documentation and packaging checks establish their stated fixture/build behavior. Oracle compilation, connected imports, authenticated application browsing and fresh native model-host execution require separate checks on an authorized target. Browser checks are not inferred from compiler/import success.

Local source verification passed after removing application test runners: typecheck/lint, 355 unit tests (one skipped), 61 contracts, 44 installer checks and 27 packaging checks, plus documentation/site, bundle comparison and isolated installation/stdio checks. The local Codex installation was updated to 2.0.0 and its installed ten-tool catalog was verified; this conversation retains its previously loaded tools until a new session. On local APEX 26.2, compiler validation and current-runtime metadata batching succeeded. The host in-app browser verified authenticated invalid-email rejection, create, edit, search and deletion using a dedicated test account. CodeScan returned nine advisory findings; compiler success is not a security-audit pass. Current-version imports and fresh native model-host discovery remain unverified.

Release readiness requires source-bound reports for every mandatory gate. Generated reports are private working output under ignored `docs/evidence/`; their absence blocks readiness. No connected or native-host result is inferred from a local build.

## Repository automation

CI runs automatically only on pushes to `main`. Release and Oracle integration workflows are disabled in GitHub and gated off in their checked-in jobs. The publisher remains disabled. Build, site generation and release dry-run create local output only.

Open checks are listed in [next actions](next-actions.md). Publication, tagging and database changes require their own applicable authorization.
