# Pattern catalog

Find a reusable Oracle APEX UX composition and adapt its APEXlang recipe to your application. This page is for developers and agents who reuse a pattern, and for maintainers who add patterns from another application.

## When to use

- Use the pattern catalog when you need the layout, data flow and interaction between several components.
- Use the [component catalog](component-catalog.md) when you need an individual building block. The two catalogs are separate.
- Both are local resources used by the agent through the existing reference tools.
- Pattern lookup needs no database connection, catalog UI or automatic insertion step.

## Search and use

### Search

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

Read a returned `pattern:` ID with `apexrest_reference` `mode: "read"` or `apexrest docs read --id ID --json`. Follow `nextOffset` for the needed continuation and `nextResultOffset` for more matches.

### How search behaves

- English and Ukrainian search names refer to the same records. Inflected forms (`панель показників`, `панелі показників`) match the same stem.
- The default corpus remains `apexlang`. `component:` and existing Oracle reference IDs retain their meaning.
- Search matches any of the query terms (at least half must match).
- A ready recipe whose title starts with the query ranks above its pattern contract. For example, `simple dashboard` returns the composition with its primary `apexlang` block inline.
- Unresolved variants and concepts are hidden unless `includeUnresolved: true` is set. An exact ID always resolves.

| Field or option                           | Behavior                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`                                    | The primary `apexlang` block, bounded to 2,500 characters with `truncated` and `length`.                                                                                              |
| `include: "code"`                         | Attaches `code` to every hit.                                                                                                                                                         |
| `include: "metadata"`                     | Attaches `code` to none.                                                                                                                                                              |
| `requiresReferences`, `relatedReferences` | Resolve linked `pattern:` IDs to `{ id, title, kind }` (three per hit, sixteen on read). `component:` and `oracle:` targets keep `title: null` and are read through their own corpus. |
| Page budget                               | Pages stay within the existing 7,000-byte budget.                                                                                                                                     |

### Adapt a pattern

1. Inspect the current project's source, APEX version, theme and MMD before choosing a recipe.
2. Read its data contract and required `component:`/`oracle:` references.
3. Adapt page and item names, DOM IDs, keys, SQL projections, submitted items, actions and shared references together.
4. Merge the composition into the existing application without copying the source application's authentication or configuration.
5. Compile the adapted application and use the existing authorized deployment and browser-verification workflow.

### Read coverage

- Read coverage with `pattern:source/<sourceId>/review`, then a page decision with `pattern:source/<sourceId>/review/page-<id>`.
- Search the `patterns` corpus with `family: "coverage"` to find these records.
- Coverage means all observed pages and meaningful variants were reviewed. It does not mean every possible combination of template options has a separate recipe.

## Sources and evidence

### Reviewed sources

The catalog reviews two sources on APEX 26.1.4 and Universal Theme 26.1:

| Source                                                  | Pages |
| ------------------------------------------------------- | ----: |
| [Universal Theme Reference](https://apex.oracle.com/ut) |   122 |
| Oracle APEX UX Pattern Catalog                          |    28 |

- Every captured page has an explicit review of its structural and behavioral variants.
- Individual components, visual options, documentation, inert controls and empty concepts remain distinct from reusable compositions.
- Public records contain safe source attribution, compatibility and content hashes.
- Raw exports and private target details stay outside the package.
- Redistribution rights are unverified; the catalog uses factual metadata and original recipes without copying source prose, JavaScript or assets.

### Counts

The [local manifest](../resources/patterns/manifest.json) records:

| Item              | Count |
| ----------------- | ----: |
| Reviewed pages    |   150 |
| Variant decisions |   818 |
| Pattern contracts |    58 |
| Recipes           |    84 |

Sixty-nine recipes contain original implementations and bound offline SQLcl compiler evidence; 15 remain explicit unresolved variants or concepts. Source attribution and compiler records remain part of the functional catalog.

### What `ready` means

- A `ready` recipe has a complete declared local dependency set and real offline compiler evidence for its scaffold and MMD.
- Source inspection, compilation, SQL execution, import and browser verification are separate results.
- `not-run` does not imply a pass.
- Unsupported behavior or unresolved dependencies remain explicit.
- Synthetic examples establish an input shape, not the user's business schema or a runtime guarantee.

### Limits

The observed sources and original recipes have concrete limits:

- The UX source form pages demonstrate structure without configured business-data DML. Original form recipes can declare a separate fixture SQL script; executing that script needs an authorized target and is not part of offline compilation.
- The UX source AI example has no configured provider. The catalog does not claim a working AI integration or create credentials.
- List/tree recipes explicitly distinguish native page navigation from original selection-and-refresh variants. Source application JavaScript is not copied; each recipe declares its own supported interaction.
- Empty master-detail concepts remain unresolved until a complete composition and its evidence exist.
- Placeholder `#` links, action names without handlers, legacy mobile samples and application-specific extensions do not become working recipes through compilation. Their limits and unresolved variants remain visible in the page reviews.

## Add patterns from another application

This section is for maintainers.

### Before you start

- Invoke `$apexrest-pattern-catalog` (Codex) or `/apexrest:apexrest-pattern-catalog` (Claude Code) to add or refresh catalog entries from an identified APEX application. The skill handles catalog maintenance; ordinary use of an existing pattern follows `$apexrest-apexlang`.
- Maintainer capture/build helpers run from the [APEXREST source repository](https://github.com/apexrest-dev/apexrest). An installed plugin can search existing patterns without that checkout.
- Do not edit the installed plugin cache or assume repository scripts are bundled beside its skills.
- Access to a source application alone does not grant permission to distribute its code.
- Catalog maintenance does not publish a release or authorize an application import.

### 1. Capture the source

Set `PATTERN_CONNECTION`, `PATTERN_APPLICATION_ID`, `PATTERN_WORKSPACE` and `PATTERN_SCHEMA` to the approved read-only source. Set `PATTERN_SOURCE_ID` to a stable non-sensitive slug; it is required in both capture modes. Capture to a fresh private directory:

```sh
node scripts/capture-pattern-snapshot.mjs --connection "$PATTERN_CONNECTION" --application "$PATTERN_APPLICATION_ID" --workspace "$PATTERN_WORKSPACE" --schema "$PATTERN_SCHEMA" --source-id "$PATTERN_SOURCE_ID" --compiler /path/to/sqlcl/lib/apexlang-compiler.jar --output /tmp/apexrest-pattern-snapshot-new
```

Capture verifies the live identity before reading metadata and exporting source. It performs no import or business-table writes.

### 2. Review the snapshot

- Review the private snapshot, select compositions, replace application-specific details and confirm redistribution rights.
- Use a stable source ID across refreshes. New applications add separate sources; equal page names must not overwrite another source's patterns.
- Review source drift, removed entries, ID collisions and compatibility changes before merging.
- Preserve existing IDs when their meaning is unchanged.
- Keep raw snapshots private and publish only reviewed metadata, original or authorized recipes and safe attribution.

### 3. Normalize the snapshot

Normalize the reviewed snapshot with the same source ID:

```sh
node scripts/capture-pattern-snapshot.mjs --snapshot /tmp/apexrest-pattern-snapshot-new --publish resources/patterns/source --source-id "$PATTERN_SOURCE_ID"
```

- Normalization writes `source/<sourceId>/snapshot.json` and `inventory.json`.
- Existing source IDs are refused unless `--replace` is supplied for a reviewed refresh of the same source.

### 4. Curate patterns and reviews

Curate patterns and recipes in `resources/patterns/recipes/registry.json` before verification, preserving their source links and the other sources' entries. Inspect the current builder schema when adding records.

Keep captured facts immutable. The registry takes two maps:

| Map                     | Required  | Purpose                                                                                                                  |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `sourceClassifications` | Optional  | Classify new or reclassified pages as `pattern`, `group`, `primitives`, `documentation`, `scaffolding` or `placeholder`. |
| `sourceReviews`         | Mandatory | One entry for every page of every source, keyed by source ID and string page ID.                                         |

For example, this excerpt describes one reviewed page:

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

Rules for the review entries:

- Replace the illustrative digest and IDs with actual inventory and catalog values, and review every remaining page.
- `sourceSha256` must equal that page's exact `provenance.sha256`.
- Variant dispositions are `pattern`, `component`, `visual`, `documentation` and `unresolved`.
- Inventory nested declarations, anonymous branches, quoted keys, repeated keys with their parent context, shared dependencies and every meaningful action or state.
- A button label, `#` link or template name alone does not prove working behavior.
- Record actual source examples with page IDs and exact inventory component keys; keep unsupported behavior explicit.

The builder rejects:

- missing or stale reviews;
- unknown pages or source anchors;
- unclassified pages;
- patterns absent from their source-page reviews.

Every page classified as `pattern` needs a pattern reference. A placeholder is not a working recipe.

### 5. Verify and build

After curation, run:

```sh
node scripts/verify-pattern-recipes.mjs
node scripts/build-pattern-catalog.mjs
node scripts/build-pattern-catalog.mjs --check
```

- Verify every recipe declared ready, rebuild the catalog and check deterministic output, dependencies, evidence hashes, bounded retrieval and package portability.
- The verifier also accepts `--changed`, `--filter=REGEX` and `--catalog=DIR`; the builder accepts an optional catalog directory.
- A focused verification run does not waive evidence requirements for other ready recipes.
- Update this guide with the catalog counts.

## Related

- [Component catalog](component-catalog.md): individual building blocks and their recipes.
- [Implementation status](implementation-status.md), the [acceptance matrix](acceptance.json) and [next actions](next-actions.md): current evidence and remaining work.
