# Implementation status

English | [Українська](implementation-status.uk.md)

## Composer — local implementation, 2026-09-29

The `1.3.0-beta.1` beta contains a working local Composer core, six experimental renderers, two blueprints, CLI/MCP and Catalog. The audit does **not** establish completion of CMP-000–041: shared-resource ownership, the complete compatibility/evidence policy, general captured-source normalization and parts of the verification matrix remain incomplete. [The audit](composer/audit.md), [ledger](composer/ledger.json) and [evidence](evidence/composer-local.json) distinguish implemented behavior from remaining work. G4, live SQL/import/roles/browser and fresh-chat discovery remain open. Beta CI on macOS, Ubuntu and Windows passed; published 1.2.0 evidence below is historical.

The second review added regressions for nested mapping determinism, page ownership transitions, exact API bindings, journal completeness and panel retry/invalidation. The current test and installation results are recorded in Composer evidence; this pass does not change the open roadmap or runtime gates.

For the beta, local checks passed: 262 unit tests, 59 contract tests, 26 installer tests and 25 packaging tests, plus lint, typecheck, bilingual documentation, Composer catalog/verification, native bundle synchronization and a tarball CLI/stdio MCP smoke check. The release dry run reported `stableReady: false` because Composer, Oracle and native-host gates remain open. [Registry publication](evidence/npm-130-beta1-publication.json) and clean installs are verified separately.

## Working-copy implementation — 2026-09-29, beta release

The beta adds `apex.sync`, CLI `apex sync --env NAME --action init|status|refresh|invalidate`, the nineteenth MCP tool `apexrest_apex_sync`, explicit working-copy adoption, local diff provenance and panel status. The [existing-app workflow](existing-app.md) documents the single-editor scope. Published 1.2.0 evidence below remains historical distribution evidence; [beta publication](evidence/npm-130-beta1-publication.json) is verified separately. Local installed-payload verification is recorded in the Composer evidence.

Implemented: private atomic sync state and transition journal; immutable APEXlang baseline/SQL backup; metadata reads; bound v2 plans; full import from frozen local sources without repeated exports; revision/dirty-source/security/unknown-outcome safeguards; legacy v1/full-export and separate baseline restore compatibility. Clean refresh preserves prior artifacts and replaces a known clean working tree. Ordinary status/panel reads make no Oracle calls. Active storage is protected from result retention.

Locally verified: real sync/plan/apply code with fake Oracle/compiler/test boundaries, direct SQLcl/ORDS metadata transport fixtures, restart and CLI/stdio MCP parity. The [measurement report](evidence/working-copy-local.json) separates initial 1 APEXlang + 1 SQL export from three later imports with zero exports, against legacy three-cycle 9 + 3 exports. Wall time and response bytes are local harness measurements, not Oracle latency, tokenizer or billing evidence. The [check report](evidence/working-copy-checks.json) records current build/typecheck/lint/unit/contracts/packaging/docs/plugin checks separately from older results.

Oracle verified for this change: none. Connected initial sync + three edits with restart, actual imports, authenticated application browser behavior and a separate SQL baseline restore are NOT RUN; live qualification is a separately agreed stage. Composer Catalog was checked in the Codex in-app browser; installed payload and fresh-chat tool discovery are separate checks. Existing required-suite scopes were preserved. No plugin-owned agents, teams or model router were added.

## Historical scope — 1.2.0, 2026-09-24

APEXREST works directly in the current Codex conversation. Published 1.2.0 provides 18 bounded MCP tools, 13 focused skills, a CLI and an optional panel for Oracle/APEX operations and settings. The pattern-catalog maintenance skill extends the catalog workflow without adding an MCP tool. Codex owns the task, context, model, permissions and native collaboration. No plugin work-start call, model session controller, role routing or model selection is part of the product.

The release preserves APEXlang generation/export/validation, pinned reference retrieval, scoped metadata batches, SQLcl CLI/MCP and ORDS transports, deployment plan/apply, configured tests, browser handoff, durable jobs and bounded artifact recovery. The panel keeps project/connection settings and the verification-browser preference.

Deployment still requires actual target identity, authorization, source/target drift checks, coordination and a verified backup for an existing application. Unknown write outcomes require reconciliation. Required suites cannot pass with empty, skipped or blocked results. Production needs protected external approval.

## Pattern catalog

The separate [pattern catalog](pattern-catalog.md) adds offline `corpus: "patterns"` retrieval and `pattern:` IDs for reusable page compositions. `$apexrest-pattern-catalog` captures structural facts privately and guides complete page-and-variant review plus original recipe curation. Stable source IDs preserve other sources; a replacement requires a reviewed update. Registry `sourceReviews` bind every page decision to its exact source hash. The builder rejects missing or stale reviews, unknown source anchors and patterns absent from their page reviews. Coverage is retrievable through `pattern:source/<sourceId>/review` and `/review/page-<id>`.

[Universal Theme Reference](https://apex.oracle.com/ut) and Oracle APEX UX Pattern Catalog were inspected and exported read-only. The [pattern manifest](../resources/patterns/manifest.json) records two sources, 150 pages (122 + 28), 818 reviewed variants, 58 patterns and 84 recipes: 69 original implementations and 15 explicit unresolved entries. All 69 implemented recipes passed real offline SQLcl validation without warnings: the merged verification covers 56 additions alongside the 13 existing proofs. The [local evidence record](evidence/pattern-catalog-local.json) separates actual catalog/build/package checks from recipe compiler proof.

The UX export digest and all 147 previously captured Universal Theme source-file hashes are unchanged. The new capture also inventories 53 binary/static resources as facts without redistributing them. Reader corrections retain 15 previously missed anonymous declarations in the UX source (1,099 objects, 102 shared components), plus seven anonymous Universal Theme branches; the larger inventory is not evidence of source-application mutation. Source forms do not establish business-data DML, optional fixtures have not been installed, and the AI provider remains unconfigured. Original navigation and selection/refresh recipes do not copy source JavaScript. Empty concepts and unsupported behaviors remain unresolved.

Recipe evidence binds complete scaffold and overlay inputs. SQL execution, application import and browser verification were not run for this catalog work. [Acceptance](acceptance.json) tracks the 1.2.0 implementation separately from earlier release evidence.

## Verification

The [1.2.0 local evidence](evidence/pattern-catalog-local.json) records 187 unit tests, 57 contract tests, 26 installer tests and 25 packaging tests. Catalog, documentation, plugin synchronization and relocated offline CLI/MCP checks passed. The 69 ready pattern recipes retain real offline SQLcl evidence without warnings. Publication, clean registry installs and installed-cache updates are separate checks.

The unchanged [component catalog](component-catalog.md), introduced in 1.1.0, provides offline discovery across 109 families and 138 compiler-checked recipes from the read-only Universal Theme 26.1 Reference snapshot. One unsupported recipe remains explicitly unresolved. [Catalog evidence](evidence/component-catalog-local.json) records source coverage, contextual parameter contracts, real offline compiler output, 181 unit tests, 42 contract tests and 19 packaging tests. Each ready recipe binds its scaffold and overlay hashes; SQL execution, application import and browser checks remain separate and not run for this catalog work.

[Historical 1.0.0 local evidence](evidence/current-session-100-local.json) records the exact source/build and checks executed for 1.0.0. CLI/stdio MCP, unit, packaging and UI fixtures establish their stated local behavior; they do not establish live Codex reasoning, Oracle execution or desktop rendering unless the record explicitly includes those observations.

[Historical connected evidence](evidence/ords-connected.json) establishes one authorized unchanged APEXlang export/import/export with 21 byte-identical files and a checksum-verified SQL backup. Earlier native installation and Oracle template compiler reports keep their original versions and scope. The catalog release does not rerun those connected operations or broaden their claims.

The [acceptance matrix](acceptance.json) distinguishes current criteria, retired requirements, available evidence and open verification. The original [build specification](../APEXREST_CODEX_PLUGIN_BUILD_SPEC.md) remains unchanged as historical input. Historical JSON reports are retained for provenance, including reports of removed functionality; they are not a description of 1.2.0.

## Distribution and remaining checks

`apexrest@1.3.0-beta.1` is published under npm `beta`, with registry integrity, clean local/global installs and [CI](https://github.com/apexrest-dev/apexrest-codex/actions/runs/36689253006) on macOS, Ubuntu and Windows verified in the [beta publication record](evidence/npm-130-beta1-publication.json). npm `latest` remains 1.2.0. The beta package and native plugin versions match; this does not update the active Codex plugin cache or establish live Oracle behavior.

`apexrest@1.2.0` is published as npm `latest`. The [1.2.0 publication record](evidence/npm-120-publication.json) confirms registry integrity and clean local/global installs for source commit `858b5d14b45370fc2ba01d63013d636f1fa11070`. The [release CI run](https://github.com/apexrest-dev/apexrest-codex/actions/runs/36017573027) passed on Ubuntu, macOS and Windows. The [previous 1.1.0 publication record](evidence/npm-110-publication.json) and [historical 1.0.0 publication record](evidence/npm-100-publication.json) retain their verified integrity, clean installs and platform CI results.

For the stable release, the package and native plugin version is `1.2.0`. That publication makes no installed-cache update claim. npm publication is independent of the disabled protected GitHub artifact publisher. [Release notes](release-notes.md) track distribution separately from implementation and verification. Registry installation, local packaging, GitHub source and deployed website are separate outcomes.

Broader native-platform coverage, changed Oracle imports, SQL restore, real interruption/recovery, utPLSQL and authenticated application checks remain open where the existing evidence does not cover them. UTF-8 payload measurements are not paid-token measurements. See [next actions](next-actions.md).
