# Implementation status

The current source and bundled plugin version is **2.0.0**. The current contract is described in [architecture](architecture.md), [testing](testing.md) and the [acceptance matrix](acceptance.json).

## Implemented

- Six skills and ten composite MCP tools for Codex and Claude Code, backed by one canonical work skill and CLI/runtime. Managed payloads include both marketplaces and bind both MCP adapters to the same Node executable and managed home; Claude retains cache-root expansion.
- Oracle SQLcl generation/validation, pinned release-specific references, blank/CRM templates and an experimental local Composer CLI.
- APEX 26.1 full imports and eligible APEX 26.2 selected-file imports through direct SQLcl CLI, with automatic scope selection, native selected-page export, scoped APEXlang backups/restore, exact plan binding, same-component conflict checks, scoped readback and durable checkpoints.
- Local durable migration history and schema coordination. Independent machines or managed homes require external serialization.
- Host in-app browser verification, separate from compiler and deployment completion. No automatic application test runners, saved browser-authentication state or browser-install steps. Dependencies are Node.js, Java and SQLcl.
- Private named connections, task-scoped grants without folder trust, redaction, bounded jobs/artifacts and recovery safeguards for unknown outcomes.
- Complete official 26.2 inventory: 389 definition documents, 130 declaration keywords and 32,187 contextual property occurrences, with full paginated MCP reads and the maintainer Oracle synchronization skill. New upstream release discovery is separate from pinned inventory currency; see [coverage](oracle-apexlang-coverage.md).
- Offline component, pattern, block and blueprint discovery. Recipe/compiler qualification belongs to the functional catalog and does not establish deployed application behavior.

- Current safety policy: DEV/QA/TEST deployment, production refusal, effective endpoint/server locality, operation-aware remote exact-plan risk confirmation and server-first APEX recovery without blind SQL replay.
- Local ignored/untracked ENV credential input and browser checks only on user request; canonical rules are bundled from [deployment safety](deployment-safety.md).

## Verification

Run the relevant checks in [testing](testing.md) against the current source. Local unit, contract, installer, documentation and packaging checks establish their stated fixture/build behavior. Oracle compilation, connected imports, authenticated application browsing and fresh native model-host execution require separate checks on an authorized target. Browser checks are not inferred from compiler/import success.

The current parity source passed typecheck and lint, 383 unit checks (one additional check skipped), 62 contracts, 46 installer checks and all 29 packaging cases. Claude Code 2.1.291 accepted the plugin and marketplace manifests with strict validation. The final unit run followed the completed build and had local-listener access for its ORDS protocol fixture; npm inventory used a private temporary cache. These are repository, manifest and subprocess checks, not native model-host execution.

Host parity changes preserve the existing scoped deployment core. Both manifest launch adapters are checked from a relocated package, with equal tool contracts/reference results and shared managed connection state. Installer checks cover dual-host launch bindings, source-safe reinstall, Node changes and Claude metadata integrity. Source-bound validation and packaging results are recorded separately under ignored `docs/evidence/host-parity/`. Native Codex/Claude model-host execution and new Oracle/browser runs are not established by these subprocess/fixture checks. Managed setup still registers Codex only; Claude uses its native plugin commands.

On the explicitly authorized local Oracle APEX 26.2 target, page creation and isolated replacement passed Oracle compiler/import/readback checks. APEXlang restoration of the previous selected page also passed without a SQL application dump. A stopped verification was reconciled as already applied without replay; Oracle filenames are matched by unique page ID rather than alias spelling. New and changed shared LOV files passed isolated imports: their plans explicitly disclose full APEXlang observation, while backup, import and comparison retain the selected scope. A final separate full audit checks unrelated files and business-row counts; it is outside the page-only edit cycle.

The authenticated in-app browser showed the new dashboard's version marker, three zero-valued CRM cards, empty customer chart, demonstration chart and the changed shared LOV label. These observations establish this dashboard and dependency rendering, not full CRM CRUD or security qualification. Page replacement measured about 34 seconds including planning/apply/readback; new dashboard creation about 44 seconds. Shared-component creation/replacement measured about 42/49 seconds because native selected export is unavailable for these families. Local no-op measured about 30 milliseconds with zero Oracle calls. The earlier whole-export flow took about 48 seconds for plan/apply; these are individual local samples, not a controlled performance guarantee. Independent machines/homes still require external serialization.

The official inventory maintenance change passed complete archive/document/type/property reconciliation and 2,269 packaged MCP reads for all 389 definitions. Its focused checks cover exact pagination, ordinary component/property discovery, independently bound search bytes, recovery of incomplete/corrupt accelerators, integrity failure, release isolation, public Oracle enums and continued operation/diagnostic secret redaction. Independent temporary-copy forward checks also passed source refresh and synthetic MMD/new-release review decisions. These are library/compiler checks, not connected or native-host qualification.

The current parity bundle has not been registered into the user's existing Codex or Claude Code profiles. Local contracts exercise relocated MCP subprocesses, and Claude's native CLI validates manifests without starting a model session. Fresh cache/skill reload and model-driven tool execution remain unverified for both hosts. This parity work leaves global connection, credential, toolchain and deployment-history state unchanged; its installer registrations use isolated fixtures only.

Release readiness requires source-bound reports for every mandatory gate. Generated reports are private working output under ignored `docs/evidence/`; their absence blocks readiness. No connected or native-host result is inferred from a local build.

## Repository automation

CI runs automatically only on pushes to `main`. Release and Oracle integration workflows are disabled in GitHub and gated off in their checked-in jobs. The publisher remains disabled. Build, site generation and release dry-run create local output only.

Open checks are listed in [next actions](next-actions.md). Publication, tagging and database changes require their own applicable authorization.

## Documentation website

The Markdown pipeline generates tracked GitHub Pages output under `docs/`, with `/apexrest/` routes, responsive grouped navigation, search, section links and previous flat `.html` guide URLs. `site:check` verifies generated freshness. The safety source is integrated before generation; The local browser verified current safety rules and the coverage route, navigation/search/anchors and a 390-pixel layout with contained table scrolling. The final generated site and packaging checks passed separately from these browser observations. This local work does not publish or verify revised live Pages output.
