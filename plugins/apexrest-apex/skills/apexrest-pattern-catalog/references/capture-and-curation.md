# Capture and curate a source

Read this when adding or refreshing a catalog source. Commands run from the APEXREST source checkout, not from the installed skill directory. Inspect the helper's current options before capture; do not substitute a guessed connection or output directory.

## Private capture

The source identity comprises a saved SQLcl connection, application ID, workspace and parsing schema. Choose a stable non-sensitive `PATTERN_SOURCE_ID` slug before capture; `--source-id` is required for both live capture and offline normalization. Capture must verify the target against the live session and application metadata before exporting. Use a fresh private destination outside the public resources. The capture helper is:

```sh
node scripts/capture-pattern-snapshot.mjs --connection "$PATTERN_CONNECTION" --application "$PATTERN_APPLICATION_ID" --workspace "$PATTERN_WORKSPACE" --schema "$PATTERN_SCHEMA" --source-id "$PATTERN_SOURCE_ID" --compiler /path/to/sqlcl/lib/apexlang-compiler.jar --output /tmp/apexrest-pattern-snapshot-new
```

Set the variables from the approved source, not from this example. Use the helper's `--sqlcl` option when the intended executable is not on PATH. Capture reads metadata and exports source; it must not run sample-data installation scripts or import the application.

Keep raw exports and exact target identifiers in private provenance. Public records contain a stable source ID, a non-sensitive title, APEX/theme/MMD/compiler versions, capture hashes and redistribution status. Preserve the raw source digest separately from hashes of normalized public records.

## Candidate review

Inspect every captured page, nested declaration and shared dependency before claiming coverage. A page name, screenshot or top-level region count is insufficient to prove behavior. Retain safe source page/component anchors and hashes in public records; keep exact target identities and raw code private.

Use the current reader inventory rather than a flat regex list of declaration names. Anonymous branches are real control flow. Quoted or spaced keys and repeated keys need their declaration type and parent context; follow inventory `id`, `parentId`, `key` and provenance to disambiguate them. A parser correction can increase inventory counts while the raw source is unchanged: compare source-file hashes separately and report that difference honestly.

- Preserve layout, data flow, actions, dependent items and required shared components. Check page routes, referenced lists/search configurations, stable DOM selectors, submitted items, event initialization, dialog chaining and close/process conditions. Replace demo schema/table details with a documented synthetic source or required input contract.
- Trace every meaningful variant: alternate behavior needs an original recipe or an explicit unresolved decision. Classify isolated components and visual parameters without inventing extra workflows. A `#` target, inert action button, missing handler or empty concept is not a working interaction; record its limitation even when nearby variants are implemented.
- Keep documentation/helper regions out of the recipe unless their behavior is the requested pattern. Do not copy app authentication, workspace configuration or deployment mappings.
- Reuse the source ID on refresh. Keep unchanged pattern IDs stable; namespace additions from another source so identical page names cannot overwrite existing patterns.
- Review removed pages, renamed patterns, source drift, compatibility changes and licensing changes before updating the bundled source. Retain an unresolved record when its recipe cannot yet be supported.

Set `PATTERN_SOURCE_ID` to the stable source slug. Normalize the reviewed private snapshot into its own source directory:

```sh
node scripts/capture-pattern-snapshot.mjs --snapshot /tmp/apexrest-pattern-snapshot-new --publish resources/patterns/source --source-id "$PATTERN_SOURCE_ID"
```

This writes `source/<sourceId>/snapshot.json` and `inventory.json`. An existing source ID is refused by default. Add `--replace` only after reviewing a refresh of that same source; it must not replace other sources. Curate the source's patterns and recipes in `resources/patterns/recipes/registry.json`, following the current builder schema. Keep explicit source links and stable IDs; a new application is not a revision of an unrelated source.

Preserve captured facts unchanged. `sourceClassifications` optionally supplies reviewed page classifications; `sourceReviews` is mandatory for every captured page of every source. Both maps use stable source IDs and page IDs as strings. Each review must contain:

- `sourceSha256`: the exact `inventory.pages` entry's `provenance.sha256`.
- `classification`: `pattern`, `group`, `primitives`, `documentation`, `scaffolding` or `placeholder`, matching the effective classification.
- `patternIds`, `componentIds` and a concrete `reason`.
- Nonempty `variants`, each with `name`, `disposition`, `patternIds` and `reason`. Dispositions are `pattern`, `component`, `visual`, `documentation` or `unresolved`.

For example, this excerpt records one page; replace the illustrative digest and IDs and supply reviews for all other pages:

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
        "reason": "The page combines a trigger with its included destination.",
        "variants": [{
          "name": "Primary interaction",
          "disposition": "pattern",
          "patternIds": ["pattern:example/review"],
          "reason": "The recipe closes the route and action dependencies."
        }]
      }
    }
  }
}
```

A page classified as `pattern` must reference at least one catalog pattern. Every pattern's `sourcePageIds` must reference reviews that include that pattern. Add `sourceExamples` with `pageId`, exact inventory `componentKeys` and factual `behavior`; do not invent anchors from similar names. The builder rejects incomplete or stale coverage, unknown anchors and orphan patterns. Do not change inventory or relabel an unknown page merely to satisfy the checks. Empty concepts remain placeholders with unresolved implementation.

Coverage records are available offline as `pattern:source/<sourceId>/review` and `pattern:source/<sourceId>/review/page-<id>`; their search family is `coverage`. They expose decisions about all observed pages and meaningful variants, not hypothetical combinations of every template option.

Source redistribution rights must be evaluated independently for each application. Where rights remain unverified, publish factual metadata and original recipes only; do not copy explanatory prose, JavaScript or implementation assets.

## Readiness and delivery

The verifier must compile every recipe declared `ready` with its complete local dependency set and the exact scaffold/MMD. Review diagnostics about ignored behavior. A positive compiler result does not establish that a query runs, navigation reaches a real target, or a dynamic action behaves correctly in a browser.

Keep SQL/import/browser results separate and retain `not-run` with a reason when unavailable. Do not import into the source application to establish catalog readiness. A runtime verification request needs its own identified authorized target and the existing [deployment workflow](../../apexrest-work/SKILL.md).

After review, rebuild the catalog and validate deterministic output, ID/link integrity, source isolation, evidence hashes and search/read bounds. Use the repository's normal build, packaging and plugin synchronization checks. Ordinary retrieval uses `apexrest_reference` `mode:search` with `corpus: "patterns"`, then `mode:read` for a returned `pattern:` ID; it must work offline outside the source checkout.

```sh
node scripts/verify-pattern-recipes.mjs
node scripts/build-pattern-catalog.mjs
node scripts/build-pattern-catalog.mjs --check
```

For focused iteration the verifier accepts `--changed`, `--filter=REGEX` and `--catalog=DIR`. A filtered run does not waive the builder's evidence requirements for other ready recipes. The builder accepts an optional catalog directory before `--check`.
