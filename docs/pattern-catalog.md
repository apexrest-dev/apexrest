# Pattern catalog

Find a reusable Oracle APEX UX composition and adapt its APEXlang recipe to your application. The pattern catalog is separate from the [component catalog](component-catalog.md): components describe individual building blocks; patterns preserve the layout, data flow and interaction between them. Both are local resources used by the agent through the existing reference tools. Pattern lookup needs no database connection, catalog UI or automatic insertion step.

This catalog and its maintenance skill are published in `apexrest@1.2.0`. The [1.2.0 publication record](evidence/npm-120-publication.json) confirms registry integrity and clean installs; the [1.1.0 publication record](evidence/npm-110-publication.json) describes the previous component-catalog release. Updating an installed plugin cache remains a separate action.

## Search and use

```sh
apexrest docs search --corpus patterns --query "search" --kind template --version 26.1 --limit 3 --json
```

The equivalent MCP call is `apexrest_reference` with `mode: "search"`:

```json
{
  "mode": "search",
  "corpus": "patterns",
  "query": "search",
  "kind": "template",
  "version": "26.1",
  "limit": 3
}
```

Read a returned `pattern:` ID with `apexrest_reference` `mode: "read"` or `apexrest docs read --id ID --json`. Follow `nextOffset` for the needed continuation and `nextResultOffset` for more matches. English and Ukrainian search names refer to the same records; inflected forms (`панель показників`, `панелі показників`) match the same stem. The default corpus remains `apexlang`; `component:` and existing Oracle reference IDs retain their meaning.

Search matches any of the query terms (at least half must match) and ranks a ready recipe whose title starts with the query above its pattern contract, so `simple dashboard` returns the composition with its primary `apexlang` block inline (`code`, bounded to 2,500 characters with `truncated` and `length`; `include: "code"` for every hit, `include: "metadata"` for none). Unresolved variants and concepts are hidden unless `includeUnresolved: true` is set; an exact ID always resolves. `requiresReferences` and `relatedReferences` resolve linked `pattern:` IDs to `{ id, title, kind }` (three per hit, sixteen on read); `component:` and `oracle:` targets keep `title: null` and are read through their own corpus. Pages stay within the existing 7,000-byte budget.

Inspect the current project's source, APEX version, theme and MMD before choosing a recipe. Read its data contract and required `component:`/`oracle:` references. Adapt page and item names, DOM IDs, keys, SQL projections, submitted items, actions and shared references together. Merge the composition into the existing application without copying the source application's authentication or configuration. Compile the adapted application and use the existing authorized deployment and browser-verification workflow.

Read coverage with `pattern:source/<sourceId>/review`, then a page decision with `pattern:source/<sourceId>/review/page-<id>`. Search the `patterns` corpus with `family: "coverage"` to find these records. Coverage means all observed pages and meaningful variants were reviewed; it does not mean every possible combination of template options has a separate recipe.

## Sources and evidence

The catalog reviews two sources on APEX 26.1.4 and Universal Theme 26.1: [Universal Theme Reference](https://apex.oracle.com/ut), with 122 pages, and Oracle APEX UX Pattern Catalog, with 28 pages. Every captured page has an explicit review of its structural and behavioral variants. Individual components, visual options, documentation, inert controls and empty concepts remain distinct from reusable compositions. Public records contain safe source attribution, compatibility and content hashes. Raw exports and private target details stay outside the package. Redistribution rights are unverified; the catalog uses factual metadata and original recipes without copying source prose, JavaScript or assets.

The [local manifest](../resources/patterns/manifest.json) records 150 reviewed pages, 818 variant decisions, 58 pattern contracts and 84 recipes. Sixty-nine recipes contain original implementations; 15 remain explicit unresolved variants or concepts. All 69 implemented recipes have real offline SQLcl compiler evidence without warnings; the merged verification adds 56 implementations to the 13 existing proofs. These counts describe the published 1.2.0 bundle; publication and clean-install checks are recorded separately.

The broader inventory does not imply changes to either source application. The UX export digest matches its preceding capture, and all 147 previously captured Universal Theme source files retain their hashes. The new capture also inventories 53 binary/static resources as facts without redistributing them. The reader now retains anonymous declarations, quoted keys and repeated keys in their declaration context: the UX source has 1,099 objects including 102 shared components, with 15 formerly missed anonymous declarations; the Universal Theme source retains all seven anonymous branches.

A `ready` recipe has a complete declared local dependency set and real offline compiler evidence for its scaffold and MMD. Source inspection, compilation, SQL execution, import and browser verification are separate results. `not-run` does not imply a pass. Unsupported behavior or unresolved dependencies remain explicit. Synthetic examples establish an input shape, not the user's business schema or a runtime guarantee.

The observed sources and original recipes have concrete limits:

- The UX source form pages demonstrate structure without configured business-data DML. Original form recipes can declare a separate fixture SQL script; executing that script needs an authorized target and is not part of offline compilation.
- The UX source AI example has no configured provider. The catalog does not claim a working AI integration or create credentials.
- List/tree recipes explicitly distinguish native page navigation from original selection-and-refresh variants. Source application JavaScript is not copied; each recipe declares its own supported interaction.
- Empty master-detail concepts remain unresolved until a complete composition and its evidence exist.
- Placeholder `#` links, action names without handlers, legacy mobile samples and application-specific extensions do not become working recipes through compilation. Their limits and unresolved variants remain visible in the page reviews.

## Add patterns from another application

Invoke `$apexrest-pattern-catalog` (Codex) or `/apexrest:apexrest-pattern-catalog` (Claude Code) to add or refresh catalog entries from an identified APEX application. The skill handles catalog maintenance; ordinary use of an existing pattern follows `$apexrest-apexlang`.

Maintainer capture/build helpers run from the [APEXREST source repository](https://github.com/apexrest-dev/apexrest). An installed plugin can search existing patterns without that checkout. Do not edit the installed plugin cache or assume repository scripts are bundled beside its skills.

Set `PATTERN_CONNECTION`, `PATTERN_APPLICATION_ID`, `PATTERN_WORKSPACE` and `PATTERN_SCHEMA` to the approved read-only source. Set `PATTERN_SOURCE_ID` to a stable non-sensitive slug; it is required in both capture modes. Capture to a fresh private directory:

```sh
node scripts/capture-pattern-snapshot.mjs --connection "$PATTERN_CONNECTION" --application "$PATTERN_APPLICATION_ID" --workspace "$PATTERN_WORKSPACE" --schema "$PATTERN_SCHEMA" --source-id "$PATTERN_SOURCE_ID" --compiler /path/to/sqlcl/lib/apexlang-compiler.jar --output /tmp/apexrest-pattern-snapshot-new
```

Capture verifies the live identity before reading metadata and exporting source. It performs no import or business-table writes. Review the private snapshot, select compositions, replace application-specific details and confirm redistribution rights. Access to a source application alone does not grant permission to distribute its code.

Use a stable source ID across refreshes. New applications add separate sources; equal page names must not overwrite another source's patterns. Review source drift, removed entries, ID collisions and compatibility changes before merging. Preserve existing IDs when their meaning is unchanged. Keep raw snapshots private and publish only reviewed metadata, original or authorized recipes and safe attribution.

Normalize the reviewed snapshot with the same source ID:

```sh
node scripts/capture-pattern-snapshot.mjs --snapshot /tmp/apexrest-pattern-snapshot-new --publish resources/patterns/source --source-id "$PATTERN_SOURCE_ID"
```

Normalization writes `source/<sourceId>/snapshot.json` and `inventory.json`. Existing source IDs are refused unless `--replace` is supplied for a reviewed refresh of the same source. Curate patterns and recipes in `resources/patterns/recipes/registry.json` before verification, preserving their source links and the other sources' entries. Inspect the current builder schema when adding records. The verifier also accepts `--changed`, `--filter=REGEX` and `--catalog=DIR`; the builder accepts an optional catalog directory.

Keep captured facts immutable. Use the optional `sourceClassifications` registry map to classify new or reclassified pages as `pattern`, `group`, `primitives`, `documentation`, `scaffolding` or `placeholder`. Also provide mandatory `sourceReviews` entries for every page of every source, keyed by source ID and string page ID. For example, this excerpt describes one reviewed page:

```json
{
  "sourceClassifications": {
    "example-source": { "10": "pattern" }
  },
  "sourceReviews": {
    "example-source": {
      "10": {
        "sourceSha256": "<copy inventory page provenance.sha256>",
        "classification": "pattern",
        "patternIds": ["pattern:example/review"],
        "componentIds": ["component:regions/standard"],
        "reason": "A reviewed composition connects the listed regions and actions.",
        "variants": [
          {
            "name": "Primary interaction",
            "disposition": "pattern",
            "patternIds": ["pattern:example/review"],
            "reason": "The included recipe implements the observed interaction."
          }
        ]
      }
    }
  }
}
```

Replace the illustrative digest and IDs with actual inventory and catalog values, and review every remaining page. `sourceSha256` must equal that page's exact `provenance.sha256`. Variant dispositions are `pattern`, `component`, `visual`, `documentation` and `unresolved`. Inventory nested declarations, anonymous branches, quoted keys, repeated keys with their parent context, shared dependencies and every meaningful action or state. A button label, `#` link or template name alone does not prove working behavior. Record actual source examples with page IDs and exact inventory component keys; keep unsupported behavior explicit.

The builder rejects missing or stale reviews, unknown pages or source anchors, unclassified pages and patterns absent from their source-page reviews. Every page classified as `pattern` needs a pattern reference. A placeholder is not a working recipe. After curation, run:

```sh
node scripts/verify-pattern-recipes.mjs
node scripts/build-pattern-catalog.mjs
node scripts/build-pattern-catalog.mjs --check
```

Verify every recipe declared ready, rebuild the catalog and check deterministic output, dependencies, evidence hashes, bounded retrieval and package portability. A focused verification run does not waive evidence requirements for other ready recipes. Update this guide with the catalog counts. Catalog maintenance does not publish a release or authorize an application import.

See [implementation status](implementation-status.md), the [acceptance matrix](acceptance.json) and [next actions](next-actions.md) for current evidence and remaining work.
