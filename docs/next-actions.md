# Next actions and verification limits

## Customer CRM integration follow-up

- Add an instance-level diagnostic for `REJOIN_EXISTING_SESSIONS=Y` before saved-state E2E; the application setting alone was insufficient on APEX 26.2. The requirement is documented in [testing](testing.md#automated-application-tests).
- Treat the SQLcl 26.3 `arraysize` warning over the ORDS transport as non-fatal in connection tests.
- The 26.1 CRM initialization does not yet set `rejoinSessions`; qualify it with a 26.1 compiler before changing it.

## Post-deploy re-authentication

- The resume path reached `succeeded` on the local 26.2 stack ([local record](evidence/post-deploy-reauth-local.json)) after a scripted login, and the user's interactive `apexrest test auth` with the current runtime produced state that passed E2E. An older global `apexrest` (0.1.0-beta.1) on `PATH` rejects 26.2 project configuration and has no `deploy verify`.
- The probe checks the base URL. When an application shows its `expectedMarker` only on a deeper page (as crm262 does), a valid session is `unknown` and the specs decide; consider an optional probe path if earlier detection is needed.
- `deploy verify` is CLI-only. Consider an MCP surface (for example an `apexrest_ship` verify mode) if agents without a shell need it; keep it import-free and gate-preserving.
- The probe recognizes a login page by a visible password field without the marker. Applications using external SSO redirects without a password field fall back to ordinary E2E failures; extend detection only with real evidence from such a target.
- Session rejoin (`REJOIN_EXISTING_SESSIONS`) did not keep sessions across a full import in the earlier run; do not rely on it as a workaround.

## Integration harness

- Run `npm run test:integration` from an interactive terminal against `crm262`/`dev` so that `test auth` can run after the full imports and the final standalone SQL+E2E check produces evidence. The ship-based authorization, imports, grant removal and no-op export preservation already ran on the local stack ([evidence](evidence/oracle-integration.json)).
- Post-deploy E2E after a full import now stops in `awaiting_reauth` (`POST_DEPLOY_REAUTH_REQUIRED`) and resumes with `deploy verify` after `test auth` (see [testing](testing.md#sessions-ended-by-a-full-import)). The harness recognizes that blocked outcome. Add an import-free `deploy verify` step after interactive authentication so that the original deployment journal also reaches a verified terminal state; the current harness runs final standalone suites only.
- CI runners have no interactive terminal; until post-deploy E2E survives full imports, `npm run test:integration` there ends `blocked` after the no-op checks.

## Claude Code

- Discovery and read-only tool calls are recorded in the [Claude Code session record](evidence/claude-code-session-200-native.json). The offline part of `/apexrest:apexrest-work` (init, edit, validate) also passed. Still open: install from the repository marketplace, restore a connection to the authorized 26.2 test application 92620, run one authorized dev/test change through `/apexrest:apexrest-work` (validate, ship plan/apply, job status) and record the browser handoff with the Claude Code built-in browser or Claude in Chrome.
- Consider switching the stored default browser mode from `codex` to `host` in a later version; both are accepted today and behave identically.

## Version 2.0.0

- PRs #1 and #2, the pending CRM fixes and all additional worktree tips are integrated into `main`; local source, bundle and packaging gates passed. Continue with the connected and native-host qualification below; Git integration does not close those acceptance gaps.
- The source and rebuilt bundle are `2.0.0`; npm publication and tagging remain separate, unperformed actions. Keep published 1.3.0 records and prior qualification receipts unchanged.
- Reconcile pending outcomes/local edits before explicitly refreshing working copies from a previous runtime version. Do not bypass the runtime-version binding by editing stored state.

## APEX 26.2 follow-up

- Documentation review completed: partial imports are prominent in the README, docs index and site navigation/search, with coherent command examples. Keep the source-only availability notice until a separately verified publication includes this update. Documentation/site builds are not new Oracle acceptance evidence.
- Direct SQLcl partial-import qualification is recorded in [connected evidence](evidence/apex262-connected.json), with actual browser observations separate from automated suites. Preserve the historical strict-readback failure and its artifacts; do not relabel it as a passed run.
- Refresh native model-host discovery and execution in Codex and Claude Code for the rebuilt bundle; CLI/stdio MCP smoke does not establish that scope. Qualify Linux/Windows and live 26.2 ORDS full imports before broadening support claims.
- Keep the managed default at 26.1 until broader qualification is complete. Existing project locks and the original specification remain unchanged. A 26.2 project uses the reviewed explicit SQLcl/profile/lock.
- ORDS selected-file import requires a separate verified transport implementation. Current automatic planning reports a full-import reason; explicit file mode refuses it.
- Extend readback equivalence only with Oracle evidence and negative tests. Today the only semantic default rule is the proven native select-list startNewRow default, and only selected .apx files may normalize; all other files stay byte-exact.
- Provider access, DDS enforcement, OCI IAM/network setup and running-workflow migration need their own operator-managed prerequisites and runtime evidence. Offline recipe compilation and visible APIs are not those checks.
- Release publication and any additional database/environment changes need their applicable authorization. The isolated authorized qualification application remains available; no broader target authorization is implied.

## Full review follow-up

- `1.3.0` was explicitly selected for npm `latest` despite open connected Oracle and native-host gates. Complete those gates before claiming full release qualification; the protected artifact publisher stays disabled.
- On an explicitly authorized DEV target, verify remote-suite preflight, fresh connected MCP sessions, error/unknown-outcome cleanup and CLI-only restricted scripts. Oracle/native-host/browser checks remain NOT RUN.
- Timing samples in the local evidence are offline only; reproduce matched connected workloads before making production latency claims. Ranking and historical size baselines remain unverified.

## Redesign follow-up

[Redesign phase 1](implementation-status.md#redesign-phase-1--local-implementation-2026-10-04) is implemented and checked locally only. Remaining work, in order:

- **Connected verification of the pooled engine and ship.** On a separately authorized DEV target: run `apexrest_apex_validate`, `apexrest_ship` `mode:plan` and `mode:apply` through the MCP server, confirm the grant is recorded and removed, the phases `backing_up` → `testing` are reported by `apexrest_job`, connected SQLcl `mcp` batches use fresh sessions, and the ORDS `cli` path still imports. Record real Oracle results separately from the fixture results.
- **Host sessions.** Load the 5-skill, 11-tool bundle in a live Codex session and in an end-to-end Claude Code session (`claude plugin marketplace add`, `claude plugin install apexrest@apexrest`, then a change through `/apexrest:apexrest-work` that calls the tools). Record discovery, tool calls and browser handoff per host.
- **Phase 2 — verify loop.** Add the checks the work cycle still lacks: an APEXlang lint before compilation, a SQL precheck of source queries against the parsing schema, a page smoke test after import, reading APEX debug output for the changed page, and seed data for empty-state checks.
- **Phase 3 — App Spec compiler.** Replace the experimental Composer blocks with a compiler from a reviewed application specification to APEXlang that feeds the same validate/ship cycle; retire `apexrest compose` afterwards.
- **Windows and Linux.** Exercise the MCP server, the pooled engine and the installers on both platforms.

## Review fixes follow-up

The [review fixes](implementation-status.md#review-fixes--local-implementation-2026-10-04) are verified locally only. Remaining work:

- On a separately authorized DEV target, run migrations, package scripts, `apex import`, metadata restore and SQL tests through connected SQLcl sessions started with `-R 2`, and confirm that neither the restriction nor the client-command scanner rejects the project's legitimate scripts.
- Verify the generated Composer save dialog in a browser over both `http` and `https`, including the path that retries a saved create as an edit.
- On Windows, verify Codex `.cmd` shim resolution, the `apexrest.cmd` launcher and rename retries during installation.
- Write provisioning guidance for `production-trust.json` on CI runners: file ownership, permissions, key fingerprints and target digests.
- Reject deploy grants without `planDigest` at schema level. Today this is enforced only at authorization time; `schemas/policy.schema.json` and `tests/fixtures/working-copy.ts` still allow such grants.
- Provide a recovery command for `LOCK_CORRUPT`; recovery is currently manual.
- Toolchains installed by earlier releases receive integrity records on their first verification (trust on first use); decide whether to require a fresh install or an explicit re-verification.
- If the runner user can delete `production-trust.json`, it removes the trust-file production classification of listed targets. Production approval still fails closed, but `kind`-only classification then applies; protect the managed home directory as well.

## Complete Composer local acceptance

Close the local gaps recorded in the [audit](composer/audit.md): shared resources and consumer ownership; complete contract/compatibility evidence policy; executable captured-source normalization; deployment fault/property coverage and comparable workflow benchmarks. Do not close the roadmap merely because the existing test suites pass.

## Composer runtime acceptance

Keep the second-review regressions when expanding the adapters: nested mappings must remain deterministic, ownership transitions must use resulting source consumers, and recovery/reconciliation must retain exact operation identity.

Separately authorize an exact DEV target, fixture DDL/DML, metadata, app mapping/import and authenticated browser qualification. Verify create/edit/cancel, stale versions, denied roles, scoped reads, saved/refresh payloads and narrow screens. G4 and dependent release gates remain open. In a new host session verify the work skill and reference tool; Composer remains CLI-only; beta CI passed on macOS, Ubuntu and Windows but does not establish native-host execution. Preserve [Composer ledger](composer/ledger.json) and [local evidence](evidence/composer-local.json).

## Working-copy connected acceptance

The [working-copy change](existing-app.md) is included in the `1.3.0-beta.1` beta release. Preserve the [local check evidence](evidence/working-copy-checks.json) and [matched fixture measurements](evidence/working-copy-local.json); fixtures do not establish Oracle behavior.

- With a separately authorized existing DEV/test app, run initial APEXlang + SQL sync, three local edit/plan/apply cycles with restart between cycles, and verify actual export/import counters, target identity, required suites and authenticated browser behavior. These checks are NOT RUN now; historical targets are not authorization.
- Run a separate checksum-bound initial SQL restore under exact approval. Verify invalidation before writes and actual restored state; intermediate applied snapshots do not provide automatic rollback.
- Exercise real lost-response/crash reconciliation, retaining unknown ownership and no retry until resolved. Verify metadata query compatibility on the supported APEX versions and direct SQLcl/ORDS targets; unchanged metadata remains a single-editor assumption.
- Verify working-copy connected read-only status snapshots on an authorized target. The local Composer update and in-app Catalog checks are recorded separately; fresh-chat tool discovery remains open.
- For token/cost or Oracle performance claims, measure matched connected cycles with real usage counters. Local wall time, call counts and UTF-8 bytes remain separately labeled.

## Beta release 1.3.0-beta.1

The [publication record](evidence/npm-130-beta1-publication.json) verifies the `beta` registry tag, tarball integrity and clean local/global installs. `latest` is now the stable 1.3.0 release; see its [publication record](evidence/npm-130-publication.json). Next verify the installed plugin in a new Codex conversation and complete the connected Oracle qualification; the beta package does not close the Composer roadmap.

## Release 1.2.0

Registry integrity and clean local/global installs for the former npm `latest`, `apexrest@1.2.0`, are recorded in the [1.2.0 publication record](evidence/npm-120-publication.json). Use the [current catalog evidence](evidence/pattern-catalog-local.json) and [release notes](release-notes.md) for the exact checks and distribution state. The [previous 1.1.0 publication record](evidence/npm-110-publication.json) remains historical evidence. Verify the installed plugin in a new Codex conversation after update. Keep npm metadata, the checked-in native bundle and canonical GitHub source aligned; a registry clean install does not establish desktop behavior or Oracle correctness.

## Pattern catalog maintenance

- Keep the [pattern catalog](pattern-catalog.md), its maintenance skill and the four other current skills aligned with the 2.0.0 source package. A source/build check or npm publication is not an installed-cache update.
- Preserve the complete review of all 150 captured pages and 818 variants across both sources. On refresh, use stable source IDs, explicit replacement and `sourceReviews` bound to each page's `provenance.sha256`; re-review changed pages and their meaningful variants. Reject missing/stale reviews, orphan patterns, unknown source anchors, ID collisions and stale recipe evidence before packaging.
- Preserve compiler evidence for all 69 ready recipes, including the 56 additions, and revalidate changed inputs. Keep the 15 unresolved variants/concepts visible; compiler readiness does not establish live behavior.
- Verify adapted pattern SQL, imports and browser interactions on a separately authorized target. Optional form fixture scripts have not been installed by catalog compilation; the reference forms alone do not demonstrate working DML.
- Keep the unconfigured AI provider and empty master-detail concepts unresolved until their dependencies and behavior are implemented and verified. Original list/tree navigation and selection/refresh variants declare their own contracts; they do not establish equivalence to every source JavaScript interaction. Keep inert `#` actions and unsupported extensions explicit.

## Connected and platform verification

- For the [component catalog](component-catalog.md), test adapted recipes on a separately authorized development application. Record source-query, import and browser evidence independently of offline compilation; the reference application remains read-only. npm publication does not establish application runtime behavior.

- Exercise changed APEX imports, component/static-file/MMD preservation and SQL restore on an explicitly authorized test target, with source/target identity and verified backups.
- Record real database interruption, lost-response reconciliation and coordination evidence. Separate homes/machines need external serialization.
- Run nonempty configured utPLSQL, API and authenticated application tests; verify changed pages in the selected browser. Missing suites or access are limitations, not passes.
- Refresh native Codex installation, discovery and browser observations for current supported hosts. Linux, Windows and WSL2 retain their documented gaps until actually exercised.
- Compare matched tasks using actual Codex usage counters if token or end-to-end latency claims are needed. Local UTF-8 bytes and tool counts measure payloads and surface area only.

## Preserve scope

The [acceptance matrix](acceptance.json) records which older requirements are retired. Do not reintroduce plugin session orchestration to satisfy historical requirements. The original build specification and older JSON reports remain provenance; the current product runs in the user's open Codex or Claude Code session.

Continue to preserve project trust, explicit mutation scope, production approval, backup, drift, required suites and unknown-outcome recovery. Do not change a live Oracle target merely to close an evidence gap without active authorization.
