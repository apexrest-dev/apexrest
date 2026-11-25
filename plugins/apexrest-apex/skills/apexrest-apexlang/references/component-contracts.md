# Component contracts for APEX 26.1

Use only the section for the requested component, then read its owning `_common` and scenario documents through [component routes](component-routes.md). These notes adapt Oracle's 2026.09.21 skills release to the plugin workflow; they do not establish connected Oracle or browser evidence. Resolve target-build grammar and compile the actual composition. An option inventory, sample-data label or release headline cannot enable a property absent from the applicable contract.

## Media List

- Use `themeTemplateComponent/mediaList` for the standalone component. A shared List region with `listTemplate: @/media-list` has a different source and host contract.
- Select `componentAppearance.display: report` or `partial`. Report support in this snapshot is limited to verified `localDatabase/sqlQuery` sources. Use bare projected aliases for `settings.title` and `settings.description`; keep SQL data-only and place deterministic ordering in `orderBy`.
- Resolve the report's column variant against the active target. Emit every projection using that one variant; never mix named `source.databaseColumn` columns with unnamed `columnName`/`show` columns. A compiler column contract does not establish support for policy-owned grouping or nested Avatar/Badge properties.
- Enable nested Avatar and Badge through `settings.displayAvatar` and `settings.displayBadge`, with the corresponding plugin blocks. Read the Media List contract before borrowing standalone Avatar/Badge options. Grouping remains unavailable unless the selected curated policy explicitly exposes it, even though a grouped scenario and theme inventory exist.
- For nested placement, reuse a verified Standard or Content Block parent and its supported `regionBody`/`subRegions` slot. For a query-backed partial region, use the catalog recipe with an explicitly bounded single-row query and metadata for every projection. Omit report-only layout, grouping, selection and pagination. A partial report column has a different host contract: mappings reference sibling columns and omit region-level componentAppearance.
- The current policy permits at most one sequenced `action.position: link` with a structured same-app redirect and no action template. It does not enable arbitrary URLs, link attributes, trigger actions, row selection or pagination.

## Comments

- Use `themeTemplateComponent/comments`. Map `settings.userName`, `settings.commentText` and optional `settings.date` to delivered columns. Report mode requires `settings.style: basic` or `chatSpeechBubbles` and column metadata for every projection.
- A partial Comments region requires a source proven to return at most one row; SQL needs an explicit row bound. Omit `settings.style` and report-only behavior blocks. For a partial Interactive Report column, use `comments.partial-column`: mappings reference sibling report columns and the Comments column omits region `componentAppearance` and report-only blocks.
- Keep `settings.displayAvatar` consistent with `plugin-avatar`; emit exactly one icon, image or initials payload. Initials require a dedicated projected column. The sample-data inventory's `INITIALS` label does not prove Tasks sample data exposes it. Follow the application-managed static-file URL contract for avatar images.
- Use only supported action positions `actions`, `avatarLink` or `userNameLink`, numeric `layout.sequence` and structured `behavior.target`; only `actions` takes a label. Do not copy action `template` or `behavior.type` from another family. Nested Badge and grouping are unsupported in the current contract.
- Keep dynamic attributes free of scriptable markup and event handlers. Comment classes must be static CSS tokens or a declared compatible source-column mapping, not substitution-driven classes.

## Metric Card

- Use `themeTemplateComponent/metricCard` with `settings.metric`. Query-backed `title`, `metric` and `meta` use `&COLUMN.` substitutions; source selectors such as Avatar initials and Badge value/state use bare projected aliases. Preserve this distinction from Media List and Comments mappings.
- For several metrics in one region, normalize one row per metric into a shared source shape. In report mode, describe every projection with the target's `column-f` shape and exact Metric Card data types; do not copy Interactive Report `STRING`/`NUMBER` tokens. Partial mode omits report layout, grouping, selection, messages and pagination.
- Avatar and Badge visibility belongs inside `plugin-avatar.displayAvatar` and `plugin-badge.displayBadge`. Badge rendering requires label and value. Resolve nested properties from the Metric Card inventory, not the standalone Avatar/Badge inventory.
- Any row-selection mode requires a declared primary-key column; use the grouping/selection scenario for the associated page items and ordering. Actions support only `position: link`, numeric sequence and no template or label. A trigger action requires a matching event consumer/dynamic action.
- Use structured targets for application navigation. For an external `targetUrl`, review the static scheme, host, path and fragment; allow substitutions only inside query parameters. Reject executable/protocol-relative URLs and inline handlers. A new-window link needs `noopener` or `noreferrer`.

## Cards

- Map requested title, body, identity, media, badge and action roles to explicit SQL projections or the authoritative REST data profile. Cards uses native `card`, `title`, `body`, `media` and `iconAndBadge` blocks; do not add report-style child columns.
- Choose one media source: `blobColumn` maps `media.blobColumn`, `urlColumn` maps `media.urlColumn`, and `imageUrl` maps `media.url`. BLOB companion metadata belongs in `blobAttributes` and must also be projected. Resolve stable row identity where required, including BLOB media and row navigation.
- Every action needs its type, numeric sequence, behavior and matching target. Only button actions take a label and `layout.position`; full-card, title, subtitle and media actions omit them. Trigger behavior requires its declared consumer.
- Prefer direct column rendering. When requested formatting needs HTML substitutions, escape untrusted text with the supported `!HTML` syntax. Keep external navigation destinations reviewable, preserve source and target authorization, and reject executable URL schemes or inline event handlers.
- For refresh after dialog or item change, load the corresponding Cards refresh scenario and submit every source-dependent item. A REST source references existing shared source/credential configuration; a Cards edit is not permission to create or widen credentials.

## Smart Filters and Search

- Declare one `smartFilters` region before its authoritative results region and bind `source.filteredRegion` to that region. The documented results families are Classic Report, Cards, Map and Calendar; verify target support. A Map target is the region with one proven layer source, not a layer reference.
- Keep the proven secured base query/view intact. A search child uses `source.dbColumns` with an explicit ordered searchable-column allowlist. Every alias must be projected once; do not infer the search surface from all fields or change SQL to emulate unsupported behavior.
- Search, suggestions, refinements and counts must stay within the base region's effective authorization, server-side condition and row scope. Read the scenario's refinement/source rules before adding filters; do not query broader data to populate suggestions.
- Resolve requested match semantics, input bounds, tokenization and settings against actual compiler properties. Upstream ticket defaults and generation-plan CLI commands are not additional plugin tools or user requirements. Record unsupported requested behavior explicitly and continue independent work; do not invent DSL, silently omit the behavior or widen the source.
- For a performance claim, use expected cardinality, statistics and a suitable search/index strategy. A plain B-tree does not establish efficient substring search. Browser-check requested search/refinement refresh, labels and keyboard use; compare counts and any filtered export with the source scope.

## Region Display Selector

- Use one `regionDisplaySelector` controller and at least two explicitly selected eligible sibling regions. Set `advanced.regionDisplaySelector: true` only on those targets; exclude the controller, breadcrumbs and header/breadcrumb slots. Stable `layout.sequence` defines selector order.
- Use `advanced.htmlDomId` for controller/target region DOM identifiers; do not copy another component's `advanced.staticId`. Remembered selection requires stable target IDs.
- Emit the selected mode, icon-display and remember-selection settings. `includeShowAll` belongs only to `viewSingleRegion`; `scrollWindow` keeps the regions visible and scrolls between them. If region icons are enabled, resolve a valid icon for each target.
- `includeSlider` is an optional application-wide `componentSetting NATIVE_DISPLAY_SELECTOR` attribute, not a controller setting. Change it only when the user requests that application-wide behavior.
- Selector visibility is presentation, not authorization. Preserve each target's own authorization and conditions. Browser-check target order, chosen mode, keyboard navigation and requested remembered selection without treating a hidden region as access control.

## Qualified 26.2 recipes

In a 26.2 project, `apexrest_reference mode:select` can return a component's `example` with `qualifiedRecipe`: the whole region block of a recipe that compiled warning-free in a complete 26.2 application, with its `sha256`, `requires`, `dataContract` (columns to keep when you replace the synthetic query) and `adaptation` notes. Its qualification is the compiler only; import and browser behaviour are not claimed. Adapt it as given: keep its properties, rename ids, replace the synthetic SQL with authorized project SQL that projects the same columns. `apexrest_reference mode:read id:<example id>` returns the complete page it compiled in. Simple semantic edits (titles, labels, headings, formats, sequences, queries) still go straight to `action:context` and `patch`; they need no recipe.
