# Next actions and verification limits

English | [Українська](next-actions.uk.md)

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

Keep the second-review regressions when expanding the adapters: nested mappings must remain deterministic, ownership transitions must use resulting source consumers, and recovery/panel retry must retain exact operation identity.

Separately authorize an exact DEV target, fixture DDL/DML, metadata, app mapping/import and authenticated browser qualification. Verify create/edit/cancel, stale versions, denied roles, scoped reads, saved/refresh payloads and narrow screens. G4 and dependent release gates remain open. In a new Codex chat verify Composer tool/skill loading; beta CI passed on macOS, Ubuntu and Windows but does not establish native-host execution. Preserve [Composer ledger](composer/ledger.json) and [local evidence](evidence/composer-local.json).

## Working-copy connected acceptance

The [working-copy change](existing-app.md) is included in the `1.3.0-beta.1` beta release. Preserve the [local check evidence](evidence/working-copy-checks.json) and [matched fixture measurements](evidence/working-copy-local.json); fixtures do not establish Oracle behavior.

- With a separately authorized existing DEV/test app, run initial APEXlang + SQL sync, three local edit/plan/apply cycles with restart between cycles, and verify actual export/import counters, target identity, required suites and authenticated browser behavior. These checks are NOT RUN now; historical targets are not authorization.
- Run a separate checksum-bound initial SQL restore under exact approval. Verify invalidation before writes and actual restored state; intermediate applied snapshots do not provide automatic rollback.
- Exercise real lost-response/crash reconciliation and optional database coordination, retaining unknown ownership and no retry until resolved. Verify metadata query compatibility on the supported APEX versions and direct SQLcl/ORDS targets; unchanged metadata remains a single-editor assumption.
- Verify working-copy connected panel flows on an authorized target. The local Composer update and in-app Catalog checks are recorded separately; fresh-chat tool discovery remains open.
- For token/cost or Oracle performance claims, measure matched connected cycles with real usage counters. Local wall time, call counts and UTF-8 bytes remain separately labeled.

## Beta release 1.3.0-beta.1

The [publication record](evidence/npm-130-beta1-publication.json) verifies the `beta` registry tag, tarball integrity and clean local/global installs. `latest` remains at the stable 1.2.0 release. Next verify the installed plugin in a new Codex conversation and complete the connected Oracle qualification; the beta package does not close the Composer roadmap.

## Release 1.2.0

Registry integrity and clean local/global installs for `apexrest@1.2.0` on npm `latest` are recorded in the [1.2.0 publication record](evidence/npm-120-publication.json). Use the [current catalog evidence](evidence/pattern-catalog-local.json) and [release notes](release-notes.md) for the exact checks and distribution state. The [previous 1.1.0 publication record](evidence/npm-110-publication.json) remains historical evidence. Verify the installed plugin in a new Codex conversation after update. Keep npm metadata, the checked-in native bundle and canonical GitHub source aligned; a registry clean install does not establish desktop behavior or Oracle correctness.

## Pattern catalog maintenance

- Keep the [pattern catalog](pattern-catalog.md), its maintenance skill and the other 12 skills aligned with the 1.2.0 package. A source/build check or npm publication is not an installed-cache update.
- Preserve the complete review of all 150 captured pages and 818 variants across both sources. On refresh, use stable source IDs, explicit replacement and `sourceReviews` bound to each page's `provenance.sha256`; re-review changed pages and their meaningful variants. Reject missing/stale reviews, orphan patterns, unknown source anchors, ID collisions and stale recipe evidence before packaging.
- Preserve compiler evidence for all 69 ready recipes, including the 56 additions, and revalidate changed inputs. Keep the 15 unresolved variants/concepts visible; compiler readiness does not establish live behavior.
- Verify adapted pattern SQL, imports and browser interactions on a separately authorized target. Optional form fixture scripts have not been installed by catalog compilation; the reference forms alone do not demonstrate working DML.
- Keep the unconfigured AI provider and empty master-detail concepts unresolved until their dependencies and behavior are implemented and verified. Original list/tree navigation and selection/refresh variants declare their own contracts; they do not establish equivalence to every source JavaScript interaction. Keep inert `#` actions and unsupported extensions explicit.

## Connected and platform verification

- For the [component catalog](component-catalog.md), test adapted recipes on a separately authorized development application. Record source-query, import and browser evidence independently of offline compilation; the reference application remains read-only. npm publication does not establish application runtime behavior.

- Exercise changed APEX imports, component/static-file/MMD preservation and SQL restore on an explicitly authorized test target, with source/target identity and verified backups.
- Record real database interruption, lost-response reconciliation and coordination evidence. Separate homes/machines need external serialization or explicitly configured database coordination.
- Run nonempty configured utPLSQL, API and authenticated application tests; verify changed pages in the selected browser. Missing suites or access are limitations, not passes.
- Refresh native Codex installation, discovery and panel/browser observations for current supported hosts. Linux, Windows and WSL2 retain their documented gaps until actually exercised.
- Compare matched tasks using actual Codex usage counters if token or end-to-end latency claims are needed. Local UTF-8 bytes and tool counts measure payloads and surface area only.

## Preserve scope

The [acceptance matrix](acceptance.json) records which older requirements are retired. Do not reintroduce plugin session orchestration to satisfy historical requirements. The original build specification and older JSON reports remain provenance; the current product runs in the user's open Codex session.

Continue to preserve project trust, explicit mutation scope, production approval, backup, drift, required suites and unknown-outcome recovery. Do not change a live Oracle target merely to close an evidence gap without active authorization.
