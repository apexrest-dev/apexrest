# APEXlang authoring in Codex

English | [Українська](apexlang-optimization.uk.md)

APEXREST targets Codex exclusively. The build emits the native `codex-compat` package with `.codex-plugin/plugin.json`; the generated marketplace restricts the product to `codex`. The previous experimental portable artifact is retired. Existing historical evidence and the original build specification are retained.

## Retrieval and authoring

The APEXlang skill routes Codex directly to the relevant component family, then its required contracts and selected scenario. A bundled, compiler-checked chart/cards/filter composition provides a small starting point when that pattern fits. The original Oracle documents remain data; their orchestration and deployment instructions do not replace APEXREST workflows or user authorization.

The pinned Oracle snapshot `26.1@b94ccf4` contains **658 complete template/syntax documents and 4,872 grammar fragments**, for 5,530 records. It reflects the changes documented in the September 21 Oracle release notes and the [upstream snapshot merged on September 22](https://github.com/oracle/skills/tree/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang): 21 added documents and 30 updated existing documents, with no removals or grammar changes. Stable legacy IDs remain valid. A reproducible offline builder verifies the archive hash, preserves original text and grammar boundaries, resolves contract dependencies and generates a search accelerator. It does not download documentation during Codex startup or normal lookup.

Search ranks exact IDs, owning productions, titles and adjacent query terms before incidental mentions. It handles camelCase and separated words, returns a window around the match, supports family/kind filters and bounded result pagination. `version: "26.1"` includes the pinned 26.1 snapshot; an explicit snapshot must match exactly. `grammar:series-source-property` supports direct reading. Documents expose `requires` and bounded `related` IDs without automatically expanding their content.

The runtime caches the corpus and up to 64 query rankings. File identity/size/timestamps invalidate that cache; the accelerator must match the corpus hash. Missing, stale or malformed accelerators fall back to indexing the actual corpus. Reference bodies are not read during the MCP handshake.

## Measurements and limits

[Earlier retrieval evidence](evidence/apexlang-retrieval.json) records seven fresh processes and 100 repeated lookups per process on macOS arm64 with a warm filesystem. It retains its original corpus and build identity; the table below describes that historical comparison. The fixed twelve-case set covers properties, charts, grids, items, validations, dynamic actions and LOVs. Its baseline uses the earlier corpus/API; the measured update adds documents and filters. The report separately records relevance without a version filter so the old release-selector bug does not conceal that comparison.

| Local measurement | Previous implementation | Measured update |
| --- | ---: | ---: |
| First lookup, median | 6.74 ms | 47.14 ms |
| Repeated lookup, median | 0.427 ms | 0.029 ms |

Recorded expected-first-result coverage: 12/12 selected retrieval cases. This is a deterministic regression set, not an unseen model-generation benchmark.

Repeated local lookups are substantially faster; first lookup is slower because the corpus and index are larger. These measurements establish retrieval performance and expected first-result coverage for this fixture set. They do not establish a percentage improvement in model-generated applications, total task duration or native-host context tokens. The skill body and selected references still consume context when Codex reads them.

The [0.5 retrieval run](evidence/minor-050-retrieval.json) separately records the refreshed `26.1@b94ccf4` corpus and the expanded 18-case fixture. Its local results do not extend the historical comparison or establish Oracle, application-browser or billed-token evidence.

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
