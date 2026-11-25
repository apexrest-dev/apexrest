# Generate native APEX pages

Use `apexrest_project action:scaffold` with `project` and a project-relative JSON `specFile` for supported Oracle APEX 26.1 and 26.2 pages. The host supplies verified SQL, PL/SQL, labels and behavior. The emitter generates native component syntax, navigation and distinct numeric process identifiers. Follow the project's pinned release.

Read the necessary metadata once, or use the verified schema supplied by the task. When Decisions is enabled, call `apexrest_reference mode:select` once with a concise UI-only request covering the components. Read this guide, write one complete specification and materialize it in one call. Shared query strings and repeated columns can be assembled programmatically in a project-local script.

```json
{
  "applicationName": "Task Desk",
  "pages": [
    {
      "id": 10,
      "name": "Tasks",
      "regions": [
        {
          "id": "tasks",
          "type": "interactiveReport",
          "name": "Tasks",
          "sql": "select task_id, title, status from TASKS order by task_id",
          "columns": [
            {
              "name": "TASK_ID",
              "heading": "ID",
              "dataType": "number",
              "link": { "page": 11, "items": { "P11_ID": "#TASK_ID#" }, "clearCache": [11] }
            },
            { "name": "TITLE", "heading": "Title", "dataType": "varchar2" },
            { "name": "STATUS", "heading": "Status", "dataType": "varchar2" }
          ],
          "emptyMessage": "No tasks match this selection."
        }
      ],
      "buttons": [
        {
          "id": "new-task",
          "label": "New Task",
          "region": "tasks",
          "target": { "page": 11, "clearCache": [11] }
        }
      ]
    },
    {
      "id": 70,
      "name": "Activity",
      "regions": [
        {
          "id": "activity",
          "type": "calendar",
          "name": "Task activity",
          "sql": "select task_id, title, start_date from TASKS",
          "displayColumn": "TITLE",
          "startDateColumn": "START_DATE",
          "keyColumn": "TASK_ID",
          "link": { "page": 11, "items": { "P11_ID": "&TASK_ID." }, "clearCache": [11] }
        }
      ]
    }
  ]
}
```

The example expects an existing `TASKS` object and an authored editor on page 11. Supply their verified contracts or adapt the SQL and target together. Query aliases in column mappings are uppercase. Spec report types are `varchar2`, `number`, `date` or `timestamp`; the emitter supplies the release-specific native representation. The first report column is emitted as an accessible row header, so choose a useful row label or identifier.

## Regions

Every region has `type`, `name` and optional stable `id`. Generated IDs are `r1`, `r2` and so on. Query regions accept `sql` and optional `itemsToSubmit`, an array of full page item names.

| Type                                 | Fields                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interactiveReport`, `classicReport` | `sql`, `columns` with `name`, `heading`, `dataType` and optional `formatMask`, `link`, `linkText`. Optional `emptyMessage`. Interactive reports also accept a region `link`.           |
| `cards`                              | `sql`, `titleColumn`, `bodyColumn`, optional `keyColumn` and `link`.                                                                                                                   |
| `barChart`                           | `sql`, `labelColumn`, `valueColumn`, `xTitle`, `yTitle`.                                                                                                                               |
| `chart`                              | `chartType` of `bar`, `line`, `pie` or `donut`, and `series` with `name`, `sql`, `labelColumn`, `valueColumn`, optional `id`, `itemsToSubmit` and `link`. Optional `xTitle`, `yTitle`. |
| `calendar`                           | `sql`, `displayColumn`, `startDateColumn`, optional `endDateColumn`, `keyColumn`, `showTime`, `initialDate` and `link`. Linked calendars need the query's key column.                  |
| `staticContent`                      | Optional `html` for authored information or a container with native items.                                                                                                             |
| `form`                               | `sql` for a native read-only query form, or `table` with optional `edit` for native DML; items with `sourceColumn`.                                                                    |
| `interactiveGrid`                    | `table`, `columns` with `name`, `dataType` and optional `heading`, `primaryKey`, `hidden`, `queryOnly`, `masterColumn`; optional `edit` and `master` (master grid id on the page).     |
| `facetedSearch`                      | `filteredRegion` (a `classicReport` or `cards` id) and `facets` with full `item`, `type` (`search`, `checkboxGroup`, `radioGroup`), `label` and `columns`.                             |

Targets have `page`, optional `items` mapping full target item names to values, and optional `clearCache` page IDs. Use the native substitution for the component, such as `#TASK_ID#` in a report column and `&TASK_ID.` in a calendar. The emitter creates structured links. Supply `initialDate` when the task specifies a calendar date. Its JavaScript retains the preview's local-coverage diagnostic.

### Filtered dashboard recipe

A filter item in a `staticContent` region, `cards` and a `line` chart whose queries read the item, every query listing it in `itemsToSubmit`, and one `refreshes` entry `{ "items": ["P30_STATUS"], "regions": ["status-cards", "signups"] }`. The emitter generates the select list, both regions and the change dynamic action that refreshes them. It was verified on APEX 26.2.0 (`specs/dashboard.json` shape: 3 regions, 1 item, 1 dynamic action).

### Write contract and CRUD recipes

`edit` is `{ "operations": ["add","update","delete"], "rowVersionColumn"?: "ROW_VERSION" }`:

- Concurrency: lost updates are checked by the row version column, or by APEX row values when it is omitted. APEX only compares the row version; the table must increment it on every update (for example, a `before update` trigger).
- Authorization: an editable form or grid needs `authorizationScheme` on the region or page.
- Transaction: native DML runs in the page submit transaction, so an error rolls the request back.

The recipes:

- **Report with modal create/edit.** Two pages:
  - Report page: an `interactiveReport` with a column `link` to the dialog page (`items: { "P41_ID": "#ID#" }`) and `refreshOnDialogClose: true`, plus a `redirectToPage` button for create.
  - Dialog page: `mode: "modalDialog"` with an editable `form` and one `primaryKey` item. The emitter adds Cancel, Delete, Apply Changes and Create with native database actions, form processing, and close-dialog.
- **Editable grid.** An `interactiveGrid` with `edit` and one `primaryKey` column; the emitter adds the grid row processing.
- **Master–detail.** Two grids: the detail sets `master` and a `masterColumn` on its foreign-key column.
- **Faceted search.** A `facetedSearch` over a `classicReport` whose columns include every facet column.

Dialog pages stay out of the navigation menu unless `navigation: true`. All four were verified on APEX 26.2.0: compiler, import and dictionary readback.

## Items and server behavior

Pages have `id`, `name`, optional `alias` and `navigation` (default true), plus regions and the optional arrays below. Editors can set `navigation:false` and expose links from their report pages.

| Array         | Fields                                                                                                                                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`       | `name`, `region`, `type` of `selectList`, `datePicker`, `numberField`, `textField`, `textarea`, `hidden` or `displayOnly`. Optional `label`, `required`, `defaultValue`, `formatMask`. Select lists require `lov`, either `[{label,value}]` or `{sql}`. Native form items also use `sourceColumn`, optional `dataType` and `primaryKey`. |
| `buttons`     | `id`, `label`, `region`. A `target` redirects to its page. A submit button may explicitly set `action:submitPage`. Optional `confirmation` supplies `message` and a native `style`.                                                                                                                                                      |
| `processes`   | `id`, authored `plsql`, optional `point`, `sequence`, `button`, `successMessage`. Points are `beforeHeader`, `afterSubmit`, `processing` or `ajaxCallback`. Use `button` to restrict a submit process to that button.                                                                                                                    |
| `validations` | `id`, Boolean function body in `plsql`, `errorMessage`, optional associated `item` and submit `button`.                                                                                                                                                                                                                                  |
| `branches`    | `id`, `target`, optional submit `button`. Branches run after processing.                                                                                                                                                                                                                                                                 |
| `refreshes`   | Triggering `items` and affected region IDs in `regions`. Every affected query or chart series must include these item names in `itemsToSubmit`.                                                                                                                                                                                          |

Use `staticContent` containers with native items and authored PL/SQL processes for collection- or API-backed editing. A `form` with `sql` initializes a read-only query row; a `form` with `table` and `edit` writes it through native DML.

Top-level `applicationProcesses` hold session initialization with `id`, `plsql` and optional `point` (default `beforeHeader`). Initialize each absent collection independently so recovery preserves members already present. Reserve truncation for an explicit reset. Supply the actual server validation, mutation, reset and redirect logic required by the task. An item's `required` flag supplements business validation on the server.

Prefer one complete PL/SQL block per Execute Code process. Enclose adjacent complete blocks in an explicit outer `begin ... end;` so the supplied source also forms one standalone Oracle parse unit. Keep local declarations and exception handlers inside their original blocks.

The emitter allocates process mappings and protects hidden items. Name each form item with its full page prefix, such as `P11_ID`. Keep record existence, uniqueness and other business rules in host-authored SQL/PLSQL; native DML regions use their `edit` contract for optimistic locking.

For a Number Field's server value, use `apex_session_state.get_number('P10_AMOUNT')`, which uses the item's format mask. Convert other numeric text with Oracle `to_number` and a matching format/NLS contract. JavaScript uses `apex.locale.toNumber`. See [Oracle's numeric item contract](https://docs.oracle.com/en/database/oracle/apex/26.1/apxdc/working-data-values-numbers.html).

Pages and their components accept optional `authorizationScheme`, `buildOption` and `condition`. Conditions support `always`, `never`, `userIsAuthenticated`, `userIsPublicUser`, `itemIsNull`/`itemIsNotNull` with `item`, `item=value`/`item!=value` with `item` and `value`, `request=Value`/`request!=Value` with `value`, or `expression` with `plsqlExpression`.

## Materialize and verify

```text
apexrest_project action:scaffold project:/abs/project specFile:application-spec.json
```

The operation returns generated files and staged before/after source. Regeneration checks ownership and hashes. Resolve a human-edited page through normal source editing before replacing its generated structure. The emitter uses the starter's metadata, theme, authentication and existing navigation.

Run `apexrest_preview action:check` for requested local control. Validate the complete application once with `apexrest_apex_validate`, or continue to `apexrest_ship mode:apply` when the task includes deployment. Fix actionable diagnostics and repeat the necessary step. Source-only benchmark instructions assign deployment to the operator. Preview identifies JavaScript and native APEX features requiring host-browser observation. Treat `notAppliedLocally` as a coverage limit: preserve required native behavior and record browser behavior as unobserved until requested and performed.

For independently requested server observations, an exact `env` can return a target-bound `readback.sqlFile` on the supported release. After import the operator can execute that private script with the authorized saved connection and compare its metadata/query observations to the task. The release-specific observation helper supplies its compatibility checks.

## Entity contracts

A reviewed, reusable data binding for page recipes lives in `entities/<id>.json` next to `apexrest.json` (JSON schema `entity-contract` in `resources/schemas`). It holds `schemaVersion: 1`, `id` (the file name), `label`, `pluralLabel`, `read` (`{sql}` or `{table, owner?}`), the ordered `key`, typed and labelled `fields` (`type` `varchar2`/`number`/`date`/`timestamp`, `required`, `readOnly`, `maxLength`, `formatMask`, `lov` `{shared}` or `{values}`), `authorization` (`read`: `{scheme}` or `{public: true}`; `write`: `{scheme}`), and optional `write` (`table`, `operations`, `lostUpdate` `{rowVersion}` or `"rowValues"`). Nothing is inferred from table names; SQL is reviewed text and never run by the contract.

`apexrest_project action:entities` lists the contracts with their digest and diagnostics (duplicate fields, invalid keys, incomplete write contracts). Fix diagnostics before generating from a contract.

`apexrest_project action:entity_check entity:"customer"` validates one contract offline: structure, shared LOVs in the sources, and the list of `assumptions` it cannot verify (no database call). Add `env` (DEV/QA/TEST) to compare the referenced tables' columns, types, lengths and primary key with the target through the metadata service; diagnostics such as `ENTITY_COLUMN_MISSING`, `ENTITY_TYPE_CHANGED` or `ENTITY_KEY_CHANGED` never rewrite the contract. A connected result is bound to the contract `digest` and the `target`; pass `expectedDigest` to refuse a contract changed since review.

## Pages from a recipe and an entity

For a repeatable page, send a compact request instead of a full specification: `apexrest_project action:recipe request:{"recipe":"report-form","entity":"customer","pages":{"report":30,"form":31}}` (an interactive report with an editable modal form, or a read-only form when the contract has no `write`), or `{"recipe":"filtered-dashboard","entity":"customer","pages":{"dashboard":40}}` (a filter item on a field with static LOV values driving cards and a count chart). `overrides` accepts only `reportTitle`, `formTitle`, `columns`, `emptyMessage`, `createLabel` (report-form) or `title`, `filter`, `cardTitle`, `cardBody` (dashboard). Pass `entityDigest` to bind the request to the contract you reviewed. The request expands deterministically into a scaffold specification (returned as `spec`) and runs through the normal scaffold. Contracts with diagnostics are refused; fields with a shared LOV come back as text fields with a `warnings` entry to bind them with a `bindLov` edit. Anything a recipe does not cover uses the full specification.
