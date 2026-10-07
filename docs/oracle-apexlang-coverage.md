# Official Oracle APEXlang coverage

APEXREST includes every official APEX 26.2 inventory definition, with byte-exact paginated retrieval. This establishes source-library completeness against an explicit upstream directory, not universal Oracle APEX platform support or deployed application qualification. Checked on 7 October 2026 against the official sources below.

## Source and version matrix

| Layer                                       | Exact source/version                                                                            | Current coverage and meaning                                                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oracle skills repository HEAD               | `6c57a52588c2a68e261ff0542b8fde80fd2b9c42`, 6 October 2026 14:32:20 UTC                         | Latest inspected repository commit; all APEX files equal the pinned inventory revision                                                                                       |
| Latest commit touching `apex/apexlang/26.2` | `03ee10d02273bc4002fd527089e7fbb5884f94c4`, 6 October 2026 13:55:39 UTC                         | Version routers and updated paths; this remains the reviewed 26.2 pin                                                                                                        |
| Bundled Oracle 26.2 inventory               | Same `03ee10d…`; ZIP SHA-256 `5e65f9734c3e4c00054ed91e2e14c795be09d17aaa96ddb43f25f4e6d4d3a343` | 389/389 definition documents, 130 distinct declaration keywords, 32,187 document/group/property occurrences                                                                  |
| Bundled Oracle 26.1 grammar/examples        | `b94ccf4dec34b27859c2378fa71ba2bad884f2fe`, 22 September 2026 00:21:44 UTC                      | 659 source files remain byte-identical after Oracle moved them under `26.1/apexlang-generation`; 5,530 reference records: 658 complete documents and 4,872 grammar fragments |
| Local component UX catalog                  | `26.1@2d5e25141a3c`, Universal Theme 26.1 Reference/APEX 26.1.4                                 | 463 records; 139 recipes, 138 compiler-ready; independent 26.1 evidence                                                                                                      |
| Local pattern UX catalog                    | `26.1@d92b2cf4623f`                                                                             | 406 records; 58 patterns and 84 recipes, 69 compiler-ready; 15 unresolved recipes and nine unresolved patterns                                                               |
| Installed offline compiler inspected        | SQLcl `26.3.0.260.1620`, actual MMD `26.2.0+3479`                                               | Oracle compiler validation of the six local 26.2 recipes passed; no database, import or browser execution                                                                    |

Primary provenance: [pinned revision](https://github.com/oracle/skills/commit/03ee10d02273bc4002fd527089e7fbb5884f94c4), [inspected HEAD](https://github.com/oracle/skills/commit/6c57a52588c2a68e261ff0542b8fde80fd2b9c42), [official 26.2 tree](https://github.com/oracle/skills/tree/03ee10d02273bc4002fd527089e7fbb5884f94c4/apex/apexlang/26.2), [26.1 source pin](https://github.com/oracle/skills/commit/b94ccf4dec34b27859c2378fa71ba2bad884f2fe). Oracle publishes this material as repository commits; the inspected repository had no release/tag version for these skills. A date or Git commit is not an Oracle semantic release number.

## Complete inventory denominator

The denominator is every Markdown definition under `apex/apexlang/26.2/apexlang-inventory/assets/` at the pinned revision. The separate upstream inventory `SKILL.md` is retained as a reference catalog for syntax, application layout and containment; it is vendor data, not executable host policy.

The inventory includes workspace components, applications and shared components, page components, native plugin variants and template-component variants. Every document retains its original component keyword, parents/children, grouped properties, types, enums, defaults, requiredness, applicability and explanatory text. Repeated declarations or properties under different variants remain separate contexts.

The source contains 16,935,821 inventory bytes. The largest definition, `app/page/region/series/series.md`, is 2,565,435 bytes; it exceeds the former inline entry limit. Definitions are therefore stored as individual files, checksum-verified when read and paginated through the actual `apexrest_reference` operation. The compact search index is only a routing summary and does not replace a contract. Search postings cover full document text and their own SHA-256 is bound in the snapshot. Missing or mismatched accelerators are rebuilt from complete integrity-verified documents. Accelerator changes invalidate cached search results; they cannot silently turn ordinary component/property queries into successful empty results. Legacy inline corpora derive postings directly when no independent accelerator digest exists.

The former 26.2 source bundle selected only 27 inventory documents and omitted property groups from some of them. That selection has been replaced completely. There is one official authority for 26.2 property definitions; local guides and recipes are explicitly separate. The resulting 26.2 corpus has 412 records: 389 complete definitions, one inventory catalog, nine selected source examples, seven local guides and six original compiler-checked recipes.

Use these MCP arguments:

```json
{ "mode": "read", "id": "oracle:26.2:inventory-catalog", "version": "26.2" }
```

```json
{ "mode": "search", "corpus": "components", "version": "26.2", "query": "interactive grid", "limit": 3 }
```

Read the returned `oracle:26.2:inventory/...` ID and follow `nextOffset` until it is null. Related variant contracts link to their owning selector/component. Official definitions containing public `password` or `authorization` property/enum syntax retain those exact bytes; integrity-verified vendor pages alone bypass operation-output secret heuristics. Connection data, environment output, diagnostics and objects merely labeled as vendor data retain normal redaction.

The default/project-absent profile remains 26.1. Local `component:` recipes and `pattern:` compositions remain bound to their independently verified 26.1 source. They do not silently become 26.2 contracts. An empty search is not proof that a platform feature is absent.

## Inventory, compiler and platform are different scopes

| Scope                                                      | Measured coverage                                                                                                                                                                                | Limit                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Official inventory definition bytes                        | 389/389 included and available through MCP                                                                                                                                                       | Specific upstream revision and directory                                                                               |
| Inventory declaration keywords                             | 130 distinct `componentType` values                                                                                                                                                              | Multiple documents may describe one keyword with different variants                                                    |
| Inventory property occurrences                             | 32,187 document/group/name addresses                                                                                                                                                             | Includes repeated variant contexts; not 32,187 unique API features                                                     |
| Inspected compiler MMD                                     | 222 component definition IDs; 136 distinct keywords; 2,561 global property definitions, 2,528 referenced global IDs; 6,071 component/property bindings; 314 groups; 97 property types; 32 events | Separate compiler structure; these counts are not interchangeable with Markdown occurrences                            |
| Compiler-only keyword differences                          | `attributes`, `chart`, `dataProfile`, `groupBy`, `pivot`, `printAttributes` lack a separate inventory declaration document                                                                       | Some are represented within parent definitions; this does not prove missing runtime support                            |
| Local 26.2 recipes                                         | Six files plus generated scaffold compile against actual MMD `26.2.0+3479`                                                                                                                       | Queries/provider calls/security enforcement/import/browser behavior require separate checks                            |
| Theme/component/plugin installation and Builder operations | Outside a complete-inventory claim                                                                                                                                                               | Actual plugins, themes, templates, workspace provisioning, privileges and dependencies need target evidence            |
| Business data, SQL/PLSQL runtime, APIs and administration  | Outside a complete-inventory claim                                                                                                                                                               | Tables, DML, grants, network/OCI/provider configuration, execution semantics and runtime authorization are independent |
| Target deployment and user experience                      | Unverified by this inventory change                                                                                                                                                              | Authorized import and authenticated browser observations remain separate outcomes                                      |

The installed compiler has resource directory labels including `26.2.0-11+3480`; its inspected metadata content and default compiler MMD identify `26.2.0+3479`. A containing directory name must not be used as the actual source schema build. Source metadata stays intact. The compiler is Oracle SQLcl, not an independent implementation bundled by the upstream skills.

Oracle's 26.2 repository has compile, deploy, inventory and example-application skills. Generation guidance remains in the 26.1 generation tree. The three upstream 26.2 example applications contain 257 source files; APEXREST imports nine selected examples, not all three applications. Upstream executable helpers are not copied or run as plugin policy.

## Current Oracle release context

[Oracle announced APEX 26.2 on 6 October 2026](https://blogs.oracle.com/apex/announcing-oracle-apex-262); availability on a particular cloud/target is a separate fact. The [26.2 new-features reference](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/new-features.html) describes changes including AI integrations and navigation, workflows, reports, security/data-source options and Universal Theme improvements. Inclusion of an inventory definition does not establish those integrations on an arbitrary target.

[File-level APEXlang import](https://blogs.oracle.com/apex/introducing-file-level-import-with-apexlang-in-oracle-apex) requires matching 26.2 source/target and SQLcl/ORDS 26.3 prerequisites. Oracle documents [deployment-file structure and dependencies](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/understanding-apexlang-deployment-files.html) and [source upgrades across releases](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/upgrading-apexlang-source-with-new-apex-release.html). APEXREST's implemented transport/selection restrictions remain in the [26.2 guide](apex-26.2.md); this library synchronization does not widen them. SQLcl version context comes from [Oracle's changelog](https://www.oracle.com/tools/sqlcl/sqlcl-changelog.html).

## Maintenance and verification

Use the bundled [maintainer synchronization skill](../plugins/apexrest-apex/skills/apexrest-oracle-sync/SKILL.md) in the canonical source checkout. It requires no global skill installation or scheduled automation.

```sh
node scripts/check-oracle-apexlang-upstream.mjs
```

The checker inspects repository HEAD, not only commits touching 26.2. Its ignored `docs/evidence/oracle-upstream/upstream.json` distinguishes full pinned-inventory differences, imported catalog/example changes, licensing and new official version directories. `inventory-content-current` may coexist with `new-release-review-required`; it never declares another release supported. Other unimported upstream skills/examples remain outside that comparison.

Review the exact candidate archive/revision/SHA-256. For an authorized 26.2 source refresh:

```sh
node scripts/build-apexlang-references-26.2.mjs ARCHIVE.zip --commit COMMIT --archive-sha256 SHA256
node scripts/build-apexlang-references-26.2.mjs ARCHIVE.zip --check
npm run build
node scripts/sync-repository-plugin.mjs
node scripts/verify-oracle-apexlang-coverage.mjs --archive ARCHIVE.zip
```

`--check` is read-only and verifies all generated metadata and document bytes. A no-op rebuild must stay clean. Exact source and license hashes are retained in the lock/snapshot. New releases need an explicit profile/compiler/source review; the checker never automatically upgrades an application. Local recipe claims remain bound to their actual verification MMD even if a newly inspected example carries a different MMD.

The exhaustive helper checks archive/index/search provenance, ordinary component/property discovery (`interactive grid`, `reasoningEffort`, `workflow`), valid empty unrelated queries, every document, all 130 declaration keywords, all 32,187 property occurrences, exact-ID discovery and complete paginated reconstruction through the packaged MCP server. Its ignored `docs/evidence/oracle-inventory-coverage.json` is local retrieval evidence. Regression tests independently cover integrity failure, cross-release routing, public enum preservation, operation/diagnostic secret redaction, empty/incomplete/misrouted/missing accelerator recovery and synthetic future-release/license/catalog detection. Synthetic fixtures are not evidence that Oracle published a future release.

A source refresh remains distinct from publication, global plugin installation, database changes, provider setup and native host/browser qualification. See [implementation status](implementation-status.md), [acceptance](acceptance.json) and [next actions](next-actions.md).
