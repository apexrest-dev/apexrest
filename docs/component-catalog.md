# Component catalog

Find a component, inspect its parameters and adapt its APEXlang recipe to your application. The catalog is bundled with APEXREST since 1.1.0 and works offline, without a project or a connection to the reference application. It covers the Universal Theme 26.1 Reference application, including distinct component hosts and examples; it is not a claim to cover every capability of Oracle APEX.

Browse the component list and examples in [Universal Theme Reference](https://apex.oracle.com/ut).

For `version:26.2`, `corpus:components` resolves the complete [official Oracle inventory](oracle-apexlang-coverage.md) by default, including native/plugin variants and all properties. With `kind:template`, it searches **1,350 original APEXlang page examples from 33 public Oracle applications**. The local compiler-checked recipe catalog remains independently bound to 26.1.

## Public page templates and ready recipes

The [internet source inventory](internet-template-sources.md) records the reviewed repositories, exact revisions, licenses and exclusions. The public page library includes Cards, Charts, Calendar, Interactive Grids, Maps, Master Detail, Reporting, Dynamic Actions, Approvals, Search, Customers, Opportunities, Poll, QAsk, Strategic Planner and Team Calendar. Every page retains its original source bytes, source URL, SHA-256, UPL notice and required application dependency guide. Page-number filtering is not a security or runtime readiness classification.

The 1,350 page records contain 1,349 distinct source hashes: Customers and Opportunities share the same help-dialog source. Both records retain their own application dependency context.

```sh
apexrest docs search --corpus components --version 26.2 --kind template --query "calendar drag drop" --limit 3 --json
apexrest docs read --id oracle:26.2:public-template/catalog --json
```

Public pages have `readiness:reference`: they can depend on sample tables, APIs, plug-ins, assets, shared objects and destination pages. Read the linked dependency inventory, adapt the complete dependency set and compile in the target application. They are not standalone ready recipes, and their source authentication/configuration must not replace an existing application's security.

The separate 26.1 catalog adds **30 dependency-closed recipes**: 12 dynamic actions, eight computations, seven validations, Area/Donut charts and a Classic Report with CASE/IF/LOOP directives. They use synthetic data and have exact-source attribution (29 Oracle UPL adaptations and one MIT adaptation with its complete notice). Offline compilation uses SQLcl 26.3 while retaining the original `26.1.0+3102` MMD; this does not upgrade the recipe's APEX version. SQL execution, import and browser verification remain `not-run`.

The 2026-11-01 expansion adds **93 more dependency-closed recipes** adapted from official Oracle sources: 67 from the `oracle/skills` 26.1 generation templates and 26 from `oracle/apex` 26.2 sample applications, including the new Faceted Search Patterns, Forms Patterns and Sample Directory Search applications. They cover 16 chart variants (bar, stacked, dual axis, bubble, scatter, Gantt, status meter gauge, stock, combination, links, tooltips, zoom, series colors, 3D, densification), nine map layers and controls, nine calendar variants, nine faceted search layouts, processes, dialog and message dynamic actions, button behaviors, item variants, Rich Text Editor, Geocoded Address and Display Image items, Help Text and Breadcrumb regions, static-content layouts, report variants and an editable Interactive Grid. All use synthetic data, retain exact UPL source attribution and passed the same SQLcl 26.3 offline compilation with the 26.1 MMD. The editable grid and sectioned form do not save data until a project table and row-processing process are added; Geocoded Address calls Oracle's geocoding service at runtime. SQL execution, import and browser verification remain `not-run`.

```sh
apexrest docs search --corpus components --version 26.1 --kind template --query "gantt chart" --limit 3 --json
apexrest docs search --corpus components --version 26.1 --kind template --query "conditional field visibility" --limit 3 --json
apexrest docs search --corpus components --version 26.1 --kind template --query "template directives" --limit 3 --json
```

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

## Optional OpenAI Decisions selection

Before composing a page, the host can select several useful references in one operation. A [one-page pilot video](assets/apexrest-decisions-pilot.mp4) ([captions](assets/apexrest-decisions-pilot.srt)) shows the measured effect and its limits.

```sh
apexrest docs select --project /absolute/project --request "Interactive grid with editable rows, filters and summary cards" --json
```

The equivalent MCP call is `apexrest_reference` with `mode:"select"`, an absolute `project`, and `request`. `request` is a nonempty concise description of UI needs, at most 4,000 characters. Optional `version` overrides the project profile; `limit` defaults to six and accepts 1–8. CLI selection defaults to the current project directory. The final APEXlang is composed by the current Codex or Claude Code model.

Selection is local unless `decisionApi.enabled` is true in `apexrest.json`:

```json
{
  "decisionApi": {
    "enabled": true,
    "apiKeyEnv": "OPENAI_API_KEY",
    "envFile": ".env",
    "timeoutMs": 3000
  }
}
```

This is an optional configuration fragment. `enabled` defaults to false, `apiKeyEnv` to `OPENAI_API_KEY`, and `timeoutMs` to 3,000 (allowed: 250–10,000). `envFile` is optional and project-relative. The environment variable takes precedence; otherwise the named variable is read from that regular, user-owned, Git-ignored and untracked ENV file, parsed literally. Never put the key itself in project configuration or tool arguments. Configure the variable in the plugin process environment, or use the private file when the desktop host does not inherit shell variables.

Local retrieval builds up to 64 candidates using English/Ukrainian aliases and individual term/phrase matches, without ordinary search's half-term requirement. For 26.1 it uses compatible components and patterns; for 26.2 it uses official inventory contracts and public page examples. Unresolved and incompatible records are excluded. One `POST https://api.openai.com/v1/decisions` request with `gpt-6-luna` asks an independent `predicate` question for each candidate. Only the supplied description and bounded public catalog metadata leave the host. Sources, history and database contents are not read for the request. See [OpenAI Decisions documentation](https://developers.openai.com/api/docs/guides/decisions).

`data.results` contains local reference records with dependency links and the top-hit code block when available; full documents use `mode:read`. Valid probabilities of at least 0.5 are ranked descending, with local order retained on ties. The threshold is an initial heuristic, not a calibrated confidence guarantee. The candidate shortlist can miss a relevant component; the host can supplement it with local search. `ready` and `reference` retain their original verification meanings.

`data.selection` reports `method` (`local` or `openai-decisions`), version, candidate count, duration, and, after an API attempt, model/API duration and validated usage when returned. Missing measurements are omitted. `fallbackReason` distinguishes disabled selection, no candidates, missing/unreadable credentials, timeout, HTTP/network failures, refusal, malformed answers and no confident match. These conditions return local candidates without automatic network retries. Cancellation stops the operation; catalog or selected-document integrity failures remain errors. The timeout includes response-body reading. Disabling the option prevents credential reads and network requests; ordinary `search`/`read` always remain local.

Local fixtures verify contracts and recovery only. On 2026-10-29 a live run exercised four fixed English/Ukrainian scenarios across 26.1/26.2, with 20 successful warm-process measurements per scenario. Full MCP selection median/p95 ranged from 1.01–1.15 / 1.59–1.90 seconds; all 80 successful measured responses included the declared component/contract groups and stayed release-isolated. Of 92 total attempts including initial calls and warm-ups, 89 used Decisions and three fell back on HTTP errors. Those failures remain in the denominator and are excluded from successful API latency statistics. Backend prompt-cache hits were observed; these are not cold-backend measurements or a general accuracy/SLA claim. Private samples and actual usage are in `docs/evidence/decisions/live-benchmark.json`.

A separate 26.1 page-generation pilot used the same `gpt-6.1-sol` / `xhigh` model, task and scaffold, with three runs per flag. Mean active time including all repairs was 344.31 s disabled versus 178.05 s enabled; all six final sources passed the offline Oracle compiler and the same 46 checks. The enabled cohort includes one timeout/local fallback. Mean generator tokens were 59,453 versus 35,277, with another 42,242 Decisions tokens across two successful calls; timeout usage is unknown. Mean known combined usage was therefore 59,453 versus at least 49,358 tokens per page. The fixed first-two-ready-template policy and common completion reference pack are documented in private `docs/evidence/decisions/page-ab/comparison.md`. An adaptive native host can supplement local search, so this one-page pilot does not establish general authoring speed or token savings. SQL checks used a declared synthetic SQLite subset; connected Oracle and browser behavior were not exercised.

## Adapt a recipe

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

`npm run templates:check` verifies the public page library, exact file membership, source bytes, attribution and dependency links. To reproduce it, download the immutable archive identified in `resources/public-templates/26.2/source-lock.json` and run `node scripts/build-public-template-catalog.mjs --archive /path/to/archive.zip`. The importer enforces its reviewed archive hash and never runs upstream code. Ordinary builds are offline. Per-recipe public provenance is validated separately by the component builder; MIT recipes must include a retained license notice, whose completeness is reviewed during intake.

The reviewed package contains factual metadata, original explanations, reusable examples and source attribution. It excludes raw application exports, deployment credentials, private URLs and the compiler bundle. A new source snapshot is reviewed through its inventory and content diff before it replaces the bundled revision. Preserve existing IDs where their meaning is unchanged.
