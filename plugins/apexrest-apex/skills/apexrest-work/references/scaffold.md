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
| `form`                               | `sql` for a native read-only query form and items with `sourceColumn`.                                                                                                                 |

Targets have `page`, optional `items` mapping full target item names to values, and optional `clearCache` page IDs. Use the native substitution for the component, such as `#TASK_ID#` in a report column and `&TASK_ID.` in a calendar. The emitter creates structured links. Supply `initialDate` when the task specifies a calendar date. Its JavaScript retains the preview's local-coverage diagnostic.

### Filtered dashboard recipe

A filter item in a `staticContent` region, `cards` and a `line` chart whose queries read the item, every query listing it in `itemsToSubmit`, and one `refreshes` entry `{ "items": ["P30_STATUS"], "regions": ["status-cards", "signups"] }`. The emitter generates the select list, both regions and the change dynamic action that refreshes them. It was verified on APEX 26.2.0 (`specs/dashboard.json` shape: 3 regions, 1 item, 1 dynamic action).

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

Use `staticContent` containers with native items and authored PL/SQL processes for collection- or API-backed editing. The `form` variant initializes a read-only query row and its `sourceColumn` items.

Top-level `applicationProcesses` hold session initialization with `id`, `plsql` and optional `point` (default `beforeHeader`). Initialize each absent collection independently so recovery preserves members already present. Reserve truncation for an explicit reset. Supply the actual server validation, mutation, reset and redirect logic required by the task. An item's `required` flag supplements business validation on the server.

Prefer one complete PL/SQL block per Execute Code process. Enclose adjacent complete blocks in an explicit outer `begin ... end;` so the supplied source also forms one standalone Oracle parse unit. Keep local declarations and exception handlers inside their original blocks.

The emitter allocates process mappings and protects hidden items. Name each form item with its full page prefix, such as `P11_ID`. Keep record existence, uniqueness, optimistic locking and other business rules in host-authored SQL/PLSQL.

For a Number Field's server value, use `apex_session_state.get_number('P10_AMOUNT')`, which uses the item's format mask. Convert other numeric text with Oracle `to_number` and a matching format/NLS contract. JavaScript uses `apex.locale.toNumber`. See [Oracle's numeric item contract](https://docs.oracle.com/en/database/oracle/apex/26.1/apxdc/working-data-values-numbers.html).

Pages and their components accept optional `authorizationScheme`, `buildOption` and `condition`. Conditions support `always`, `never`, `userIsAuthenticated`, `userIsPublicUser`, `itemIsNull`/`itemIsNotNull` with `item`, `item=value`/`item!=value` with `item` and `value`, `request=Value`/`request!=Value` with `value`, or `expression` with `plsqlExpression`.

## Materialize and verify

```text
apexrest_project action:scaffold project:/abs/project specFile:application-spec.json
```

The operation returns generated files and staged before/after source. Regeneration checks ownership and hashes. Resolve a human-edited page through normal source editing before replacing its generated structure. The emitter uses the starter's metadata, theme, authentication and existing navigation.

Run `apexrest_preview action:check` for requested local control. Validate the complete application once with `apexrest_apex_validate`, or continue to `apexrest_ship mode:apply` when the task includes deployment. Fix actionable diagnostics and repeat the necessary step. Source-only benchmark instructions assign deployment to the operator. Preview identifies JavaScript and native APEX features requiring host-browser observation. Treat `notAppliedLocally` as a coverage limit: preserve required native behavior and record browser behavior as unobserved until requested and performed.

For independently requested server observations, an exact `env` can return a target-bound `readback.sqlFile` on the supported release. After import the operator can execute that private script with the authorized saved connection and compare its metadata/query observations to the task. The release-specific observation helper supplies its compatibility checks.
