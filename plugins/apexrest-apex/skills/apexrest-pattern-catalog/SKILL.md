---
name: apexrest-pattern-catalog
description: Maintainer-only - add or update reusable Oracle APEX UX patterns in the bundled catalog from an identified application. Not for ordinary application work; using a pattern belongs to apexrest-apexlang.
---

# Maintain the pattern catalog (maintainers)

Turn an identified source application's reusable page compositions into reviewed catalog records and APEXlang recipes. Keep this workflow separate from using a pattern to change the user's application: route that work to [APEXlang](../apexrest-apexlang/SKILL.md).

## Establish the source

Resolve the requested saved SQLcl connection, application ID, workspace and parsing schema from the user's request and available configuration. Check the live identity before capture. Read-only inspection/export does not authorize imports, business-table changes or changing authentication. Preserve existing authorization; ask only for a missing target or an action outside it. Never request credentials in chat.

Read [capture and curation](references/capture-and-curation.md) for maintainer commands and the source record. Capture/build helpers run from a source checkout of `https://github.com/apexrest-dev/apexrest`; do not assume those repository scripts exist relative to an installed skill. An installed plugin can retrieve existing patterns offline. Locate an available checkout for maintenance, or explain the missing checkout while completing source inspection and a local candidate inventory. Do not mutate the installed plugin cache.

## Curate a reusable composition

Choose a stable, non-sensitive source ID and preserve it across refreshes. Compare the candidate with existing source and pattern IDs before merging. A second application must add its source without replacing another source's records; a collision or changed meaning needs an explicit reviewed mapping, not silent ID reuse.

Review every captured page and its meaningful structural and behavioral variants before claiming complete coverage. Classify each page and record `sourceReviews[sourceId][pageId]` with the exact page `provenance.sha256`, pattern/component references, a reason and variant decisions. Keep `sourceClassifications` separate from immutable captured facts. Re-review changed pages; a previous review does not apply to a new hash.

Inspect nested declarations, anonymous branches, quoted keys and repeated keys in their parent context. Preserve page/region hierarchy, query projections and keys, items, submitted items, dynamic actions, process ordering, links and shared dependencies. Trace each action to its actual handler and destination; a button label, `#` link or declaration without a consumer is not a working action. Distinguish component host variants, visual options, documentation, scaffolding and unsupported concepts from compositions. Represent materially different behavior with a recipe or an explicit unresolved decision; do not multiply recipes for every visual combination.

Anchor each pattern to observed `sourcePageIds` and `sourceExamples` with exact inventory component keys and a factual behavior description. Link relevant `component:` and `oracle:` contracts instead of copying their inventories. Every pattern must appear in its source-page reviews; every variant reference must resolve to a reviewed pattern.

Create an original or redistribution-authorized recipe with synthetic data or an explicit data contract. Remove private URLs, owner/schema names, credentials, auth configuration and application-specific identifiers. Record rights and source attribution; source access alone is not permission to redistribute its code. Use the exact source APEX/theme versions and matching compiler/MMD to map properties, defaults and conditions. Keep unknown dependencies or unsupported behavior explicit.

## Verify and merge

Resolve the recipe's complete local dependency closure and compile it with its declared scaffold before marking it `ready`. Bind evidence to the recipe, dependencies, scaffold and compiler inputs so edits invalidate stale results. Record source inspection, offline compilation, SQL execution, import and browser behavior separately; an unavailable check remains `not-run`.

Review the source/ID/content diff, then merge only the selected source's curated records. Build and check the pattern catalog, including rejection of missing/stale reviews, orphan patterns and unknown source anchors. Verify focused recipe and coverage retrieval (`pattern:source/<sourceId>/review` and `/review/page-<id>`, family `coverage`), installed-package portability, and the English documentation. Preserve raw captures outside the public package. Report added/updated IDs, compatibility, actual checks and unresolved items. Catalog maintenance does not authorize publishing a release or importing into any application.
