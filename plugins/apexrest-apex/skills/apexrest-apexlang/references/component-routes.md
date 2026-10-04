# APEXlang routes for Codex

Read the selected entry with `apexrest_reference` `mode:read`, then its `requires` and one scenario template. No search is needed for these entrypoints. The IDs below resolve inside the installed plugin outside the source repository. The bundled Oracle APEXlang skills release is 2026.09.21 for APEX 26.1; compiler metadata remains authoritative for the actual target.

| Requested work | Entry ID | Search family |
| --- | --- | --- |
| Complete form page | `oracle:templates/page-examples/form-page/form-page._index` | `page-examples/form-page` |
| Form region | `oracle:templates/region-components/form/form._index` | `region-components/form` |
| Interactive report | `oracle:templates/region-components/interactive-report/interactive-report._index` | `region-components/interactive-report` |
| Editable grid | `oracle:templates/region-components/interactive-grid/interactive-grid._index` | `region-components/interactive-grid` |
| Classic report | `oracle:templates/region-components/classic-report/classic-report._index` | `region-components/classic-report` |
| Dashboard page | `oracle:templates/page-examples/dashboard-page/dashboard-page._index` | `page-examples/dashboard-page` |
| Chart, series, axes | `oracle:templates/region-components/chart/chart._index` | `region-components/chart` |
| Native cards | `oracle:templates/region-components/cards/cards._index` | `region-components/cards` |
| KPI metric card | `oracle:templates/template-components/metric-card/metric-card._index` | `template-components/metric-card` |
| Media List template component | `oracle:templates/template-components/media-list/media-list._index` | `template-components/media-list` |
| Comments region or report-column component | `oracle:templates/template-components/comments/comments._index` | `template-components/comments` |
| Smart Filters / Search with a results region | `oracle:templates/region-components/smart-filter-search/smart-filter-search._index` | `region-components/smart-filter-search` |
| Region Display Selector | `oracle:templates/region-components/region-display-selector/region-display-selector._index` | `region-components/region-display-selector` |
| Dynamic actions / AJAX | `oracle:templates/business-logic/dynamic-actions/dynamic-actions._index` | `business-logic/dynamic-actions` |
| Page processes | `oracle:templates/business-logic/processes/processes._index` | `business-logic/processes` |
| Validations | `oracle:templates/business-logic/validations/validations._index` | `business-logic/validations` |
| Buttons | `oracle:templates/buttons/buttons._index` | `buttons` |
| Select-list item | `oracle:templates/items/select-list/select-list._index` | `items/select-list` |
| Date-picker item | `oracle:templates/items/date-picker/date-picker._index` | `items/date-picker` |
| Popup LOV item | `oracle:templates/items/popup-lov/popup-lov._index` | `items/popup-lov` |
| Shared SQL LOV | `oracle:templates/shared-components/lovs/lovs.dynamic.query` | `shared-components/lovs` |

Route an explicit Media List template-component request to its own family; preserve an explicit List-region or Classic Report host choice. Route Smart Filter/Search requirements before choosing Cards as the results region. A plain Cards summary does not require search controls. For these families, use the relevant [component contract notes](component-contracts.md); load feature templates only for requested behavior.

For another item/region family, search its English type with `kind: "contract"`; then use the returned `family` for scenario searches. For a known property, start with its exact spelling and `kind: "grammar"`. Read the owning component production to establish valid nesting, then follow only the required child productions. Grammar presence does not prove that an arbitrary combination compiles.

For example, use `query: "pageItemsToSubmit", kind: "grammar", version: "26.1", limit: 3` to locate the source/series property. The result's match window gives its local context; read enough of that production to retain the surrounding block. Chart filters can require submitted items on the series source as well as a region refresh. Browser-check the actual changed filter after loading completes.

The legacy IDs `oracle-form-example`, `oracle-report-example` and `oracle-dashboard-example` remain available. They now identify the complete original documents and link to their family contracts. Do not copy an entire example when only one component is requested.

## Compiler-checked composition

For a combined filtered chart/cards page, inspect [the small native composition](../assets/p00020-filtered-components.apx). It passed offline SQLcl 26.1.2.132.1334 compilation in the bundled blank application with MMD 26.1.0+3102. This proves syntax for that composition, not SQL execution, deployment or AJAX/browser behavior. It uses synthetic DUAL data: replace it from the user's source evidence and keep only requested components. Adapt the page number, filename/alias, item names and existing theme references together.

The sample includes the x/y axes required by its bar chart, submitted filter items on both query sources, ordered child refresh actions and declarative item validation. Preserve those component dependencies when adapting it. It is an optional starting pattern, not a requirement to add all these components to other pages.
