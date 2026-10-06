# Component catalog

Find a component, inspect its parameters and adapt its APEXlang recipe to your application. The catalog is bundled with APEXREST since 1.1.0 and works offline, without a project or a connection to the reference application. It covers the Universal Theme 26.1 Reference application, including distinct component hosts and examples; it is not a claim to cover every capability of Oracle APEX.

Browse the component list and examples in [Universal Theme Reference](https://apex.oracle.com/ut).

## Search and read

```sh
apexrest docs search --corpus components --query "metric card" --kind template --version 26.1 --limit 3 --json
apexrest docs read --id component:catalog --json
```

The equivalent MCP call is `apexrest_reference` with `mode: "search"`:

```json
{
  "mode": "search",
  "corpus": "components",
  "query": "metric card",
  "kind": "template",
  "version": "26.1",
  "limit": 3
}
```

Read the returned ID with `apexrest_reference` `mode: "read"` (`id`), following `nextOffset` for the rest of a document and `nextResultOffset` for more search matches. The CLI alias `apexrest reference search|read` maps to the same `docs` commands. Parameter and recipe documents are separate so a request does not load an entire component family. English and Ukrainian search aliases resolve to the same versioned records; plural, singular and inflected forms match the same stem. The existing reference search defaults to `corpus: "apexlang"`; existing Oracle IDs keep their meaning.

Search matches any of the query terms (at least half must match), ranks ready recipes whose title starts with the query above their overview contracts, and returns property-name lookups such as `pageItemsToSubmit` at the parameter contract. Records with `readiness: "unresolved"` are hidden unless `includeUnresolved: true` is set; an exact ID always resolves. The first hit of a page carries `code`, the recipe's primary `apexlang` block read from its checksum-verified document (bounded to 2,500 characters, `truncated: true` with the full `length` when a read must continue); `include: "code"` attaches it to every hit and `include: "metadata"` to none. `requiresReferences` and `relatedReferences` resolve up to three linked IDs to `{ id, title, kind }` (titles of `oracle:` or `pattern:` targets are `null`), and `docs.read` resolves up to sixteen. The page budget of 7,000 bytes is unchanged: later snippets shrink first, then inline code, and code is dropped before any hit is omitted.

## Use a recipe

First inspect the current project's source, theme and MMD. Select the correct host: a Media List list template and a Media List template component have different contracts, as do classic Comments reports and Comments template components. Read the selected recipe, its parameter document and its required Oracle contracts.

Adapt page and item names, DOM IDs, SQL column mappings, keys, shared references and AJAX submitted items together. Synthetic example data documents the required shape; it is not a connection to your business data. Editable controls require the declared table or API contract. Compile the complete adapted application before the existing authorized deployment workflow.

A recipe marked `ready` has a complete local dependency set and real offline compiler evidence for its declared scaffold and MMD. SQL execution, import and browser verification are separate fields. `not-run` is not a pass. An unsupported example remains discoverable with an explicit reason. A template option present in the reference application does not alone establish that an arbitrary APEXlang composition compiles.

## Source and compatibility

The initial source is Universal Theme 26.1 Reference: APEX 26.1.4, Universal Theme 26.1, SQLcl 26.1.2 and MMD 26.1.0+3102. The inventory includes 122 pages, 987 regions, 539 template options and 164 Universal Theme component attributes. Documentation and helper regions are classified; they are not all reusable recipes.

The catalog combines an application snapshot, allowlisted APEX metadata, matching compiler metadata and pinned Oracle APEXlang references. Parameters retain their full context, value mappings, defaults, conditions and provenance. Region appearance and component-template options are separate. Current selections, defaults and presets are distinct; `#DEFAULT#` is a marker, not a CSS class.

Catalog revisions bind source and content hashes. The manifest records APEX, theme and MMD separately. Select the matching version and inspect compatibility before adapting a recipe. The catalog does not silently substitute a different target build.

## Maintenance and distribution

Source capture is a separate maintainer operation with an explicit saved SQLcl connection, application, workspace and schema. It verifies target identity before exporting or reading application metadata. Capture writes private local research files; it performs no application import or business-table writes. Ordinary catalog search never refreshes the database snapshot.

Set `REFERENCE_CONNECTION`, `REFERENCE_APPLICATION_ID` (a numeric ID), `REFERENCE_WORKSPACE` and `REFERENCE_SCHEMA` to the approved read-only source. Capture to a new private directory outside the repository, then normalize the reviewed snapshot:

```sh
node scripts/capture-component-snapshot.mjs --connection "$REFERENCE_CONNECTION" --application "$REFERENCE_APPLICATION_ID" --workspace "$REFERENCE_WORKSPACE" --schema "$REFERENCE_SCHEMA" --compiler /path/to/sqlcl/lib/apexlang-compiler.jar --output /tmp/apexrest-component-snapshot-new
node scripts/capture-component-snapshot.mjs --snapshot /tmp/apexrest-component-snapshot-new --publish resources/components/source
npm run catalog:verify
npm run catalog:build
npm run catalog:check
npm run build
```

`catalog:verify` invokes SQLcl without a database connection and validates every supported recipe against its exact scaffold. It records file hashes and compiler output; it never executes prerequisite SQL. Review any source-count diff, unresolved recipe and version mismatch before packaging. For faster local iteration, `node scripts/verify-component-recipes.mjs --changed` rechecks changed inputs; the builder still requires valid evidence for every `ready` recipe.

The reviewed package contains factual metadata, original explanations, reusable examples and source attribution. It excludes raw application exports, deployment credentials, private URLs and the compiler bundle. A new source snapshot is reviewed through its inventory and content diff before it replaces the bundled revision. Preserve existing IDs where their meaning is unchanged.
