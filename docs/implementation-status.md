# Implementation status

The current source and bundled plugin version is **2.0.0**. The current contract is described in [architecture](architecture.md), [testing](testing.md) and the [acceptance matrix](acceptance.json).

## Implemented

- Six skills and ten composite MCP tools for Codex and Claude Code, backed by the same CLI/runtime and host manifests.
- Oracle SQLcl generation/validation, pinned release-specific references, blank/CRM templates and an experimental local Composer CLI.
- APEX 26.1 full imports and eligible APEX 26.2 selected-file imports through direct SQLcl CLI, with exact plan binding, fresh backups, three-way conflict checks, readback verification and durable checkpoints.
- Local durable migration history and schema coordination. Independent machines or managed homes require external serialization.
- Host in-app browser verification, separate from compiler and deployment completion. No automatic application test runners, saved browser-authentication state or browser-install steps. Dependencies are Node.js, Java and SQLcl.
- Private named connections, task-scoped grants without folder trust, redaction, bounded jobs/artifacts and recovery safeguards for unknown outcomes.
- Complete official 26.2 inventory: 389 definition documents, 130 declaration keywords and 32,187 contextual property occurrences, with full paginated MCP reads and the maintainer Oracle synchronization skill. New upstream release discovery is separate from pinned inventory currency; see [coverage](oracle-apexlang-coverage.md).
- Offline component, pattern, block and blueprint discovery. Recipe/compiler qualification belongs to the functional catalog and does not establish deployed application behavior.

- Current safety policy: DEV/QA/TEST deployment, production refusal, effective endpoint/server locality, operation-aware remote exact-plan risk confirmation and server-first APEX recovery without blind SQL replay.
- Local ignored/untracked ENV credential input and browser checks only on user request; canonical rules are bundled from [deployment safety](deployment-safety.md).

## Verification

Run the relevant checks in [testing](testing.md) against the current source. Local unit, contract, installer, documentation and packaging checks establish their stated fixture/build behavior. Oracle compilation, connected imports, authenticated application browsing and fresh native model-host execution require separate checks on an authorized target. Browser checks are not inferred from compiler/import success.

The final combined safety/Pages/reference source passed typecheck and lint, 374 unit checks (one additional test skipped), 61 contracts, 44 installer checks and 29 packaging checks. Documentation, the 31-page site, Composer catalog, source/fresh-build bundle equality and isolated CLI/stdio MCP checks also passed. These establish repository and packaged subprocess behavior; they do not establish fresh native model-host discovery.

On the explicitly authorized local Oracle APEX 26.2 target, current-runtime reconciliation recognized the reviewed result of a stopped import without replay. A subsequent selected-file import changed only the Customers page, created a fresh SQL backup, removed its exact-plan grant and passed complete server readback without normalizations. Home and every unselected server file remained byte-exact, and pre-existing local Home edits were preserved. The authenticated built-in browser showed the new Customers marker, opened and cancelled the related form without business writes, and verified Home navigation. This narrow demonstration does not establish full CRUD/report behavior. Read-only effective endpoint and server/container identity checks independently confirmed locality. A separate project absent from the legacy trust list passed real Oracle compiler validation; its browser handoff alone is not a rendered-page check.

The official inventory maintenance change passed complete archive/document/type/property reconciliation and 2,269 packaged MCP reads for all 389 definitions. Its focused checks cover exact pagination, ordinary component/property discovery, independently bound search bytes, recovery of incomplete/corrupt accelerators, integrity failure, release isolation, public Oracle enums and continued operation/diagnostic secret redaction. Independent temporary-copy forward checks also passed source refresh and synthetic MMD/new-release review decisions. These are library/compiler checks, not connected or native-host qualification.

The existing local Codex APEXREST installation was updated through supported native-only setup from this final bundle. Installed/cache hashes match, the managed CLI remains 2.0.0, and all six skills and 412 release-specific reference records are present. A fresh installed-runtime MCP subprocess independently passed the complete 389-document byte/type/property reconciliation, 2,269 read windows and ordinary discovery/empty-query checks. The seven checked connection, credential, SQLcl/runtime/policy and deployment-history files remained byte-identical. The old immutable payload and installer transition/config backups remain available for supported rollback. The current conversation retains previously loaded host state; reload/new-session discovery and native model tool execution remain unverified. The unrelated older npm/PATH CLI was unchanged.

Release readiness requires source-bound reports for every mandatory gate. Generated reports are private working output under ignored `docs/evidence/`; their absence blocks readiness. No connected or native-host result is inferred from a local build.

## Repository automation

CI runs automatically only on pushes to `main`. Release and Oracle integration workflows are disabled in GitHub and gated off in their checked-in jobs. The publisher remains disabled. Build, site generation and release dry-run create local output only.

Open checks are listed in [next actions](next-actions.md). Publication, tagging and database changes require their own applicable authorization.

## Documentation website

The Markdown pipeline generates tracked GitHub Pages output under `docs/`, with `/apexrest/` routes, responsive grouped navigation, search, section links and previous flat `.html` guide URLs. `site:check` verifies generated freshness. The safety source is integrated before generation; The local browser verified current safety rules and the coverage route, navigation/search/anchors and a 390-pixel layout with contained table scrolling. The final generated site and packaging checks passed separately from these browser observations. This local work does not publish or verify revised live Pages output.
