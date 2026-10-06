# APEXlang authoring in Codex

> Amendment, 2026-10-04: both Codex and Claude Code are supported hosts. Earlier Codex-only decisions below are historical and superseded.

APEXREST targets Codex exclusively. The build emits the native `codex-compat` package with `.codex-plugin/plugin.json`; the generated marketplace restricts the product to `codex`. The previous experimental portable artifact is retired. Existing historical evidence and the original build specification are retained.

## Retrieval and authoring

The APEXlang skill routes Codex directly to the relevant component family, then its required contracts and selected scenario. A bundled, compiler-checked chart/cards/filter composition provides a small starting point when that pattern fits. The original Oracle documents remain data; their orchestration and deployment instructions do not replace APEXREST workflows or user authorization.

The pinned Oracle snapshot `26.1@b94ccf4` contains **658 complete template/syntax documents and 4,872 grammar fragments**, for 5,530 records. It reflects the changes documented in the September 21 Oracle release notes and the [upstream snapshot merged on September 22](https://github.com/oracle/skills/tree/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang): 21 added documents and 30 updated existing documents, with no removals or grammar changes. Stable legacy IDs remain valid. A reproducible offline builder verifies the archive hash, preserves original text and grammar boundaries, resolves contract dependencies and generates a search accelerator. It does not download documentation during Codex startup or normal lookup.

Search scores every document that matches at least half of the query terms, so a query such as `dynamic action refresh region` no longer returns nothing when no document contains every word. Documents matching all terms, the title, the exact phrase or adjacent terms rank far above partial matches. Query and corpus words are normalized the same way: camelCase splits (`pageItemsToSubmit` matches `page items to submit`), plural and singular English forms share a stem, common Ukrainian inflections share a stem, and a small alias table maps `textarea`, `lov`, `dropdown`, `ir`/`ig`/`da` and Ukrainian component vocabulary (`кнопка`, `звіт`, `діаграма`, `форма`) to the English corpus. Exact IDs still win outright; a bare production name (`chart-series`, `pageItemsToSubmit`, `grammar:region`) resolves the grammar symbol, while a prose word that happens to equal a symbol (`breadcrumb`, `button`) ranks the family templates first.

Concrete templates rank above routing documents: `_index`, `_common`, `_template_options`, `_configuration-modules` and `README` entries are demoted unless the query is navigational (it names `index`, `common`, `contract`, `readme`, `load order` or an ID). The default scenario of a family (`.standard`, `.basic`, `.minimal`, `.example`) ranks first among its siblings, long guides are penalized gently, and grammar wrapper productions (`*-line`) trail the productions that define properties. `kind`, `family` and `version` filters, match windows and bounded pagination are unchanged; `version: "26.1"` includes the pinned 26.1 snapshot and an explicit snapshot must match exactly.

Results are shaped for generation. The first hit of the first page carries `code`, the primary fenced block of a template or recipe (the `apexlang` fence, else the first unlabeled fence), bounded to 2,500 characters with `truncated: true` and `length` when the read must continue; `include: "code"` attaches code to every hit and `include: "metadata"` to none. `requires` and `related` IDs are resolved to `{ id, title, kind }` triples (`requiresReferences`, `relatedReferences`, three per hit, with `requiresCount`/`relatedCount`), so a grammar relation such as `oracle-grammar-1193` is readable as `dynamic-action` without a read. `docs.read` returns the same triples for a production's `related` list (up to 16) next to the ID array. A search page is bounded to 2,500 characters per requested result (7,500 for the default `limit: 3`, 16,000 at most): later snippets shrink first, then inline code, then resolved links of later hits, and code is dropped last. Component and pattern searches hide `readiness: "unresolved"` records unless `includeUnresolved: true` is set; an exact ID always resolves.

The runtime caches the parsed corpus, a stem map over the accelerator's posting words, per-stem membership sets, lazily normalized titles and bodies, extracted code blocks and up to 64 query rankings. File identity/size/timestamps invalidate that cache; the accelerator must match the corpus hash and its format is unchanged. Missing, stale or malformed accelerators fall back to indexing the actual corpus. Ranking touches postings only for most candidates; bodies are normalized once, for at most 400 strong candidates per query (bounded by 800 KB of text), and never during the MCP handshake.

## Measurements and limits

[Earlier retrieval evidence](evidence/apexlang-retrieval.json) records seven fresh processes and 100 repeated lookups per process on macOS arm64 with a warm filesystem. It retains its original corpus and build identity; the table below describes that historical comparison. The fixed twelve-case set covers properties, charts, grids, items, validations, dynamic actions and LOVs. Its baseline uses the earlier corpus/API; the measured update adds documents and filters. The report separately records relevance without a version filter so the old release-selector bug does not conceal that comparison.

| Local measurement       | Previous implementation | Measured update |
| ----------------------- | ----------------------: | --------------: |
| First lookup, median    |                 6.74 ms |        47.14 ms |
| Repeated lookup, median |                0.427 ms |        0.029 ms |

Recorded expected-first-result coverage: 12/12 selected retrieval cases. This is a deterministic regression set, not an unseen model-generation benchmark.

Repeated local lookups are substantially faster; first lookup is slower because the corpus and index are larger. These measurements establish retrieval performance and expected first-result coverage for this fixture set. They do not establish a percentage improvement in model-generated applications, total task duration or native-host context tokens. The skill body and selected references still consume context when Codex reads them.

The [0.5 retrieval run](evidence/minor-050-retrieval.json) separately records the refreshed `26.1@b94ccf4` corpus and the expanded 18-case fixture. Its local results do not extend the historical comparison or establish Oracle, application-browser or billed-token evidence.

The any-term ranking was measured on [48 generation queries](../tests/fixtures/generation-queries.json) (realistic requests such as `interactive report with edit link`, `select list LOV`, `dynamic action refresh after dialog close`, `картка показника`, with hand-verified acceptable IDs across the APEXlang, component and pattern corpora) against the previous all-terms implementation, in one process on macOS arm64 with the pinned corpora:

| Local measurement                               | Previous implementation |                    Any-term ranking |
| ----------------------------------------------- | ----------------------: | ----------------------------------: |
| Precision@1 (48 queries)                        |                      16 |                                  48 |
| Precision@3 (48 queries)                        |                      30 |                                  48 |
| Queries with no result                          |                       4 |                                   0 |
| Existing 18-case fixture, expected first result |                   18/18 |                               18/18 |
| Repeated lookup (ranking cached), median        |                0.045 ms |                        0.06–0.07 ms |
| Distinct lookup (uncached), median              |                 0.07 ms |                              0.8 ms |
| First lookup in a fresh process, median         |                   45 ms |                               50 ms |
| Default page (`limit: 3`), characters           |             4,200–5,500 | 5,700–7,500 (top-hit code included) |

Uncached lookups score every candidate instead of the all-terms intersection and normalize the bodies of the strongest candidates once per process, so they cost more the first time a family is touched (1–9 ms for very common words such as `page` or `region source`) and well under a millisecond afterwards. The benchmark script's repeated-lookup median stayed within 2× (0.017 ms to 0.03 ms), its first lookup moved from 45 ms to 50 ms, and its varied fixture pass moved from 5.5 ms to 17–27 ms for 36 lookups. These are deterministic local retrieval measurements, not model-generation evidence.

## Verification and reproduction

[Earlier native Codex evidence](evidence/apexlang-codex.json) checks discovery and read-only retrieval in a disposable Codex 0.154.0 profile on macOS arm64. It does not update the user's installed plugin. [Earlier Oracle evidence](evidence/apexlang-compiler.json) records real offline SQLcl compilation of the blank app, CRM and the filtered chart/cards fixture with unchanged MMD. These reports retain their original corpus and build identity. The fixture was corrected for required chart axes and filename/alias agreement before the final passing run. SQL was not executed and application/browser behavior was not tested.

```sh
npm run typecheck
npm run build
npm run test:unit
npm run test:contracts
node scripts/benchmark-apexlang-references.mjs docs/evidence/apexlang-retrieval.json
node scripts/verify-apexlang-patterns.mjs docs/evidence/apexlang-compiler.json
```

The compiler command requires the supported local SQLcl, selected through `APEXREST_SQLCL` when it is outside `PATH`; it does not connect to an Oracle database. The native Codex evidence was produced by a dedicated verification script that was removed in 1.0.0; the report is retained as historical evidence and cannot be regenerated with the current repository. To compare an earlier implementation, supply its saved bundled reference module and resource directory as the benchmark's third and fourth arguments. To rebuild the corpus, supply the exact reviewed archive to `node scripts/build-apexlang-references.mjs`; its pinned hash is recorded in the builder and snapshot manifest.

Connected component/runtime coverage, broader task-level generation evaluations and other native platforms remain separate work. See [implementation status](implementation-status.md) and [next actions](next-actions.md).
