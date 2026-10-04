# Release {{version}}

English | [Українська](releases.uk.md)

Beta 1.3.0-beta.1 adds experimental Composer and single-editor working copies. It provides 21 MCP tools and 14 skills for Oracle/APEX work, with Codex managing the conversation and collaboration. It is published under the npm `beta` tag; stable 1.2.0 remains npm `latest`.

## Beta changes

- Compose local APEXlang source from six experimental blocks and two blueprints through reviewed plans, materialization and recovery, using the CLI, MCP or the panel Catalog. See the [Composer guide](../../docs/composer.md).
- Edit existing applications through working copies: explicit `apex sync`, immutable local baselines, source-bound plans and imports from frozen local source. The legacy full-export path remains available.
- The [Composer audit](../../docs/composer/audit.md) records unfinished requirements. Live Oracle import, roles, authenticated browser behavior and new-chat native loading remain unverified.

## Stable 1.2.0 changes

Release 1.2.0 adds a separate offline UX pattern catalog and a skill for expanding it from APEX applications; it provides 18 MCP tools and 13 skills.

- Search 58 patterns and adapt 84 recipes: 69 compile with the matching Oracle compiler, while 15 remain visible with explicit unresolved dependencies or behavior contracts.
- Review coverage accounts for 150 pages from two source applications and 818 variant decisions. Page hashes bind each review to its captured source; these counts describe the reviewed sources, not every possible APEX composition.
- Use `corpus: "patterns"` with the existing reference tools or CLI. Read pattern contracts, individual recipes and page coverage on demand, offline and without a configured project or database connection.
- Use the new `$apexrest-pattern-catalog` skill to capture an authorized source application, classify its examples, author reusable recipes and extend the catalog with compiler evidence.
- Keep access to 109 component families and 138 compiler-checked component recipes through `corpus: "components"`. Existing Oracle reference IDs and the `apexlang` default remain compatible.

Follow the [pattern catalog guide](../../docs/pattern-catalog.md) and [component catalog guide](../../docs/component-catalog.md), or browse the [Universal Theme component list and examples](https://apex.oracle.com/ut). Install the stable release with `npm install -g apexrest`, or pin `apexrest@1.2.0` or `apexrest@1.3.0-beta.1`.

## Evidence and distribution

The [1.3.0-beta.1 publication record](../../docs/evidence/npm-130-beta1-publication.json) confirms registry integrity and clean installs of the beta. [Pattern evidence](../../docs/evidence/pattern-catalog-local.json) records source coverage, offline compiler checks, retrieval and package verification. The [component evidence](../../docs/evidence/component-catalog-local.json) retains its original scope. Compiler readiness means that the recipe's declared dependencies are closed and its scaffold compiles; SQL execution, application import, authenticated browser behavior and native model execution retain separate [verification limits](../../docs/next-actions.md).

[Release notes](../../docs/release-notes.md) identify the actual distribution outcome. npm publication, canonical GitHub source, signed GitHub artifacts and website deployment remain distinct. The protected GitHub artifact publisher stays disabled.

Historical [1.1.0 publication](../../docs/evidence/npm-110-publication.json), [1.0.0 publication](../../docs/evidence/npm-100-publication.json) and [connected Oracle evidence](../../docs/evidence/ords-connected.json) retain their original source identities and limits.
