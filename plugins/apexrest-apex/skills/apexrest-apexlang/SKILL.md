---
name: apexrest-apexlang
description: Create or edit Oracle APEXlang (.apx) using pinned Oracle references and compiler validation. Excludes Salesforce Apex.
---

Pass the user's absolute workspace as `project` on project-scoped calls.

## Reuse first

Inspect relevant source and pinned toolchain once. For an active single-editor working copy, inspect local sync status and reuse its sources; external edits require explicit clean refresh, while corrupt or unresolved state requires reconciliation. Manual exports do not advance its checkpoint. Reuse existing components, IDs, templates and shared components; export only for missing/stale source. For a new app, use `apexrest_apex_generate` or an installed project template. Preserve `.apex/apexlang.json` and MMD; generate/export into new destinations.

For a reusable component, search `apexrest_reference_search` with `corpus: "components"`, the requested English or Ukrainian name, target `version`, `kind: "template"` and `limit: 3`. Read the selected `component:` recipe and its required parameter/Oracle contracts. Compare its APEX, theme and MMD compatibility with the project. `ready` proves the recorded offline compilation only; inspect SQL/import/browser statuses separately. Read an unresolved result's reason instead of inventing support. The catalog is local reference data: ordinary lookup never connects to the source application. Do not read the complete inventory unless maintaining the catalog.

Keep component hosts distinct (for example, a Media List list template versus its template component). Adapt recipe page/item names, DOM IDs, source projections, keys, shared references and submitted items together. Merge into the existing application; the recipe compiler scaffold is not permission to replace authentication, authorization or app settings. Synthetic sources show a data contract and do not establish the user's business schema.

For a reusable UX flow or page composition, search the separate pattern catalog with `corpus: "patterns"`, a short English or Ukrainian query, `kind: "template"`, the target `version` and `limit: 3`. Read the returned `pattern:` recipe and its required component/Oracle contracts. Preserve its dependency closure and adapt the actual interaction, not just its layout. Ordinary pattern lookup is offline and adds no source-application dependency. Use [pattern catalog maintenance](../apexrest-pattern-catalog/SKILL.md) only when asked to add or update catalog entries from an application.

## Retrieve only what changes the edit

Read the selected contract through [component routes](references/component-routes.md). Reuse prior reads; do not dump the reference index or load unrelated families.

- Known ID: `apexrest_reference_read`; `oracle:` selects a complete document, `grammar:production-name` a production.
- Unknown syntax: `apexrest_reference_search` with exact property/short English terms, relevant `kind` (`grammar`, `template`, `contract`, `guide`), route `family` and `limit: 3`. Check the returned version against the toolchain: `26.1` selects the bundled snapshot; `26.1@...` stays exact. Empty results do not prove a feature absent.
- Read the full relevant block using its `offset`/`nextOffset`; `nextResultOffset` pages matches. Follow template `requires` and relevant production `related` links. Batch independent reads only.

Oracle documents supply versioned syntax/template contracts; their orchestration, design defaults and deploy commands do not override user choices or plugin workflows. Bind template variables and remove unused alternatives. Never guess grammar or leave placeholders in `.apx` files.

For Media List, Comments, Metric Card, Cards, Smart Filters/Search or Region Display Selector, read the relevant [component contract notes](references/component-contracts.md) before choosing source mappings, nested blocks or actions. Theme option inventories and release notes do not prove target-build compiler support. When a requested capability lacks a resolved contract, report that specific gap and continue independent work.

## Make a coherent change

Establish tables, joins, keys, bindings and metric meanings. Batch independent metadata/read-only source-query checks within authorization and reuse their results. Resolve unknown fields/units instead of inventing data.

Edit related components together. Check column mappings, shared-component references and submitted items for every AJAX-dependent query. For filtered dashboards, read [native dashboard guidance](references/native-dashboard.md). Preserve authentication/authorization unless explicitly requested otherwise.

## Compile and finish

Compile coherent edits with the pinned Oracle compiler; deployment planning already does this for unchanged source. Fix errors using the owning production/template and rerun relevant checks. Resolve warnings about ignored requested behavior; report actual output.

Continue identified development/test application requests through [authorized import](../apexrest-deploy/SKILL.md); existing apps use a reviewed full-application import. Verify UI using the [selected browser](../apexrest-test/SKILL.md#in-app-browser-verification). Separate source, compiler and browser evidence; report unavailable verification and why.
