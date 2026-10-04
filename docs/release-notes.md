# Unreleased — redesign phase 1

## Source repository — 2026-10-04

The working tree contains the first redesign phase, implemented and checked locally only; nothing is published. npm `latest` remains `1.2.0` and npm `beta` remains `1.3.0-beta.1`, both with the previous surface described below.

- A persistent SQLcl engine: offline compiler work and SQLcl `mcp`-mode connections run on a pooled SQLcl server process for the MCP server's lifetime, with one capability probe per process. Measured locally: `apex validate` 3.2 s cold → about 43 ms warm; capability probe 1.5 s → 0 ms. Compiler results return structured diagnostics with file, line, column, type, message, valid values and hint.
- Eleven MCP tools instead of 21 (`apexrest_project`, `apexrest_reference`, `apexrest_metadata_read`, `apexrest_apex_validate`, `apexrest_ship`, `apexrest_apex_sync`, `apexrest_test_run`, `apexrest_browser_open`, `apexrest_job`, `apexrest_artifact_read`, `apexrest_status`); the catalog shrinks from about 24 KB to 12.2 KB. `apexrest_ship` plans, records a plan-bound deploy grant from the user's explicit request, applies, verifies and removes the grant; production is refused.
- Five host-neutral skills instead of 14 (`apexrest-work`, `apexrest-apexlang`, `apexrest-safety`, `apexrest-setup`, `apexrest-pattern-catalog`), about 17.6 KB instead of 41 KB.
- Claude Code support through `.claude-plugin/plugin.json` and the repository marketplace (`claude plugin marketplace add apexrest-dev/apexrest`, `claude plugin install apexrest@apexrest`); the Codex route is unchanged.
- Removed: the terminal UI, the panel server, worker, actions and MCP UI resource, database-backed deployment coordination, the Composer MCP tools and skill (Composer remains an experimental CLI), and Ukrainian documentation. The repository is renamed to `apexrest-dev/apexrest`.

See the [changelog](../CHANGELOG.md#unreleased--redesign-phase-1-security-hardening-and-review-fixes) for breaking changes and [implementation status](implementation-status.md#redesign-phase-1--local-implementation-2026-10-04) for what was and was not verified.

# 1.3.0-beta.1 — experimental Composer and working copies

## Beta release — 2026-09-30

- Adds local Composer with six experimental renderers, two blueprints, reviewed plans, materialization, recovery, CLI/MCP routes and an in-app Catalog. The package contains 21 MCP tools and 14 skills.
- Adds single-editor working copies for existing applications: explicit `apex sync`, immutable local baselines, source-bound plans and imports from frozen local source. The legacy full-export path remains available.
- The [Composer audit](composer/audit.md) records unfinished CMP-000–041 requirements. Local tests and offline compiler checks do not establish live Oracle import, roles, authenticated browser behavior or new-chat native loading. Those gates remain open.

`apexrest@1.3.0-beta.1` is published under the npm `beta` tag. The [publication record](evidence/npm-130-beta1-publication.json) confirms matching registry integrity, clean local/global installs and [CI success](https://github.com/apexrest-dev/apexrest/actions/runs/36689253006) on macOS, Ubuntu and Windows for source commit `d119ca60998565ab0d0eb73e54c227c5dbb9bfa7`. Stable `latest` remains `1.2.0`. No Git tag, production deployment or active plugin-cache update is claimed.

## 1.2.0 — reusable APEX pattern catalog

## Changes — 2026-09-24

- Find **58 reusable patterns** through offline `corpus: "patterns"` retrieval and stable `pattern:` IDs. Adapt **84 recipes**: 69 have compiler-checked implementations and 15 retain explicit unresolved reasons.
- Review **150 source pages and 818 meaningful variants** from Universal Theme Reference and Oracle APEX UX Pattern Catalog. Coverage records bind each page decision to its exact source hash; missing or stale reviews, unknown source anchors and orphan patterns fail the build.
- Use the new `$apexrest-pattern-catalog` skill to add patterns from identified APEX applications. Capture source facts read-only, preserve stable source IDs, curate original recipes and verify changed dependencies before packaging.
- Search in English or Ukrainian through the existing MCP reference tools and CLI. Read large coverage records with pagination and recover all links. Installed catalog retrieval works offline without a project or Oracle connection.
- Preserve the existing component catalog with **109 families and 138 ready recipes**, default `corpus: "apexlang"`, Oracle reference IDs, SQLcl/ORDS operations and deployment safeguards. The plugin now provides **18 MCP tools and 13 skills** in the current Codex conversation.

Browse the [Universal Theme component list and examples](https://apex.oracle.com/ut), then follow the [pattern catalog guide](pattern-catalog.md) or [component catalog guide](component-catalog.md).

## Verification and limits

[Current catalog evidence](evidence/pattern-catalog-local.json) records 69 real offline SQLcl compiler passes without warnings, bound to the exact scaffold and recipe inputs. Local checks passed: 187 unit tests, 57 contract tests, 26 installer tests and 25 packaging tests, plus deterministic catalogs, bilingual documentation, plugin synchronization and relocated offline CLI/MCP retrieval. The [previous component evidence](evidence/component-catalog-local.json) preserves its 138 compiler proofs unchanged.

`ready` means a complete declared local dependency set with matching compiler evidence. Prerequisite SQL execution, application import, authenticated browser behavior and native host model execution remain separate and were not run for this catalog work. Payload measurements use UTF-8 bytes, not billed tokens.

## Distribution

`apexrest@1.2.0` is published as npm `latest`. The [1.2.0 publication record](evidence/npm-120-publication.json) confirms registry integrity and clean local/global installs for source commit `858b5d14b45370fc2ba01d63013d636f1fa11070`. The [release CI run](https://github.com/apexrest-dev/apexrest/actions/runs/36017573027) passed on Ubuntu, macOS and Windows. The previous 1.1.0 publication remains recorded separately below.

npm publication is separate from the disabled protected GitHub artifact publisher. It does not claim signed GitHub artifacts, a Git tag, website deployment or full platform/Oracle qualification. Updating the active Codex plugin cache and opening a new conversation to load its tools are separate installation actions.

[Implementation status](implementation-status.md), the [acceptance matrix](acceptance.json), [publisher setup](publishing.md) and [open verification](next-actions.md) track those boundaries.

## Historical releases

These records describe earlier versions, not the current product. Their source digests, outcomes and limitations remain unchanged.

| Version                     | Historical record                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1.1.0                       | [Component catalog](evidence/component-catalog-local.json), [npm publication](evidence/npm-110-publication.json)        |
| 1.0.0                       | [Current-session checks](evidence/current-session-100-local.json), [npm publication](evidence/npm-100-publication.json) |
| 0.5.0                       | [Stable npm publication](evidence/npm-050-stable-publication.json)                                                      |
| 0.5.0-beta.1                | [Oracle reference update](evidence/minor-050-local.json), [npm publication](evidence/npm-050-publication.json)          |
| 0.4.0-beta.1                | [Minor release checks](evidence/minor-040-local.json), [deterministic automation](evidence/codex-automation-local.json) |
| 0.3.0-beta.1                | [Local checks](evidence/minor-update-030.json), [native record](evidence/minor-update-030-native.json)                  |
| Earlier ORDS implementation | [Authorized unchanged round trip](evidence/ords-connected.json)                                                         |

Historical reports include removed functionality. They are retained as provenance, not current APIs or workflow instructions. Existing Oracle evidence does not establish changed imports, SQL restore or new native-platform coverage for 1.2.0.
