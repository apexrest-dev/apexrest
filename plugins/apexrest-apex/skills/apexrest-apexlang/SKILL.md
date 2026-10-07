---
name: apexrest-apexlang
description: Write or edit Oracle APEXlang (.apx) sources using pinned Oracle references, bundled component and pattern recipes, and compiler validation. Read when a change needs syntax, a component contract or a page composition. Excludes Salesforce Apex.
---

# APEXlang

Pass the absolute project directory as `project`. Reuse source already read; retrieve only what changes the edit, with at most 3 `apexrest_reference` lookups per change. Never guess grammar or leave placeholders; `apexrest_apex_validate` is the arbiter.

## Retrieval

- Known entry: `apexrest_reference` `mode:read` with the ID. `oracle:` is a complete document, `grammar:production-name` one production, `component:`/`pattern:` a bundled recipe. Follow only the `requires` and `related` links you need; page with `offset`/`nextOffset`.
- Unknown syntax: `mode:search` with the exact property or short English terms, `kind` (`grammar`, `template`, `contract`, `guide`), the route `family` from the table below and `limit:3`. `version` selects `26.1` or `26.2`; otherwise the project profile selects it, defaulting to 26.1. Pass the same version on reads. Empty results do not prove a feature absent.
- Reusable component: `mode:search`, `corpus:components`, `kind:template`, English or Ukrainian name, `limit:3`; read the `component:` recipe and its parameter contract. `ready` proves offline compilation only.
- UX flow across components: `corpus:patterns` the same way; read the `pattern:` recipe and its required `component:`/`oracle:` contracts and keep its page, item and action relationships.

Entry IDs are `oracle:templates/<family>/<name>._index`; `family` is the search filter:

- Form page `page-examples/form-page`; form region `region-components/form`.
- Interactive report, interactive grid, classic report: `region-components/<name>`.
- Dashboard page `page-examples/dashboard-page`; chart `region-components/chart`; cards `region-components/cards`; metric card `template-components/metric-card`.
- Media List, Comments: `template-components/<name>`.
- Smart Filters/Search `region-components/smart-filter-search`; Region Display Selector `region-components/region-display-selector`.
- Dynamic actions, processes, validations: `business-logic/<name>`.
- Buttons `buttons`; select list, date picker, popup LOV: `items/<name>`; shared SQL LOV `shared-components/lovs` (`lovs.dynamic.query`).

Other families: search the English type with `kind:contract`, then use the returned `family`. Read the owning component production to establish valid nesting; grammar presence does not prove that a combination compiles.

## Contract notes

For 26.2, read `oracle:26.2:inventory-catalog` for layout, syntax and containment, then search `corpus:components`, `version:26.2` for the complete official component contracts. Read the returned `oracle:26.2:inventory/...` ID and follow `nextOffset`; summaries do not replace full properties or applicability. Use `oracle:26.2:guide/file-import` for deployment. Local UX recipes and patterns remain independently bound to 26.1; do not use them as 26.2 property definitions. Keep source MMD intact; a major-version upgrade needs a reviewed export refresh. Partial import uses direct SQLcl CLI on a qualified 26.2 target; include changed dependencies and preserve unselected local/server work.

Read the family section in [component contracts](references/component-contracts.md) before Media List, Comments, Metric Card, Cards, Smart Filters/Search or Region Display Selector. Key points: Media List and Comments need column metadata for every projection and one source variant (never mix named and unnamed columns); partial regions need a provably single-row source; Smart Filters need the results region mapped and submitted items on every dependent source; Region Display Selector lists only regions on the same page; Cards and Metric Card bind title/value/icon columns explicitly. Theme option inventories and release notes do not prove compiler support.

Filtered dashboards: submit each filter item with every dependent region or chart series (`pageItemsToSubmit`), refresh dependent regions together with one Dynamic Action, keep date-range text inside a refreshed region, and reconcile source queries for default, changed, single-entity and empty cases ([native dashboard notes](references/native-dashboard.md)). A compiler-checked filtered chart/cards composition is in [p00020-filtered-components.apx](assets/p00020-filtered-components.apx): adapt page number, alias, item names and theme references together; it uses synthetic DUAL data.

## Editing rules

Establish tables, joins, keys and metric meanings from metadata (`apexrest_metadata_read`, batched `requests` for several objects) before binding sources. Edit related components together: column mappings, shared-component references, submitted items and refresh actions for every AJAX-dependent query. Preserve `.apex/apexlang.json`, Oracle IDs, templates, authentication and authorization; merge recipes into the existing application rather than replacing settings. Resolve warnings that say a requested behavior was ignored. Then continue with validation, shipping and browser checks in [work](../apexrest-work/SKILL.md).
