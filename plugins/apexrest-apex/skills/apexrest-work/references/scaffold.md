# Scaffold routine APEX 26.2 pages

Use `apexrest_project action:scaffold` with `project` and `specFile` (project-relative JSON). It writes native APEXlang from fixed component emitters; the host supplies the SQL, labels and column meanings. It does not import or execute SQL. The emitters use the generated Universal Theme template references. Use it for interactive reports, KPI cards and bar charts, including several pages in one call. No reference selection or syntax lookup is needed for these supported properties.

Read the relevant source and batch table columns once with `apexrest_metadata_read` before choosing SQL. If the task supplies verified columns, reuse them. Environment inputs use the exact configured key (for example `dev`), not the workspace (`DEV`).

Write a compact spec file like this; use real verified tables/columns instead of the illustrative names:

```json
{
  "applicationName": "Catalog Monitor",
  "pages": [
    {
      "id": 1,
      "name": "Home",
      "regions": [
        {
          "type": "cards",
          "name": "Catalog totals",
          "sql": "select 'Products' title, to_char(count(*)) value from PRODUCTS",
          "titleColumn": "TITLE",
          "bodyColumn": "VALUE"
        },
        {
          "type": "barChart",
          "name": "Products by state",
          "sql": "select state label, count(*) value from PRODUCTS group by state order by state",
          "labelColumn": "LABEL",
          "valueColumn": "VALUE",
          "xTitle": "State",
          "yTitle": "Products"
        }
      ]
    },
    {
      "id": 10,
      "name": "Products",
      "regions": [
        {
          "type": "interactiveReport",
          "name": "Products",
          "sql": "select code, name, weight_kg from PRODUCTS order by name, code",
          "columns": [
            { "name": "CODE", "heading": "Code", "dataType": "varchar2" },
            { "name": "NAME", "heading": "Name", "dataType": "varchar2" },
            { "name": "WEIGHT_KG", "heading": "Weight (kg)", "dataType": "number", "formatMask": "FM999G990D000" }
          ],
          "emptyMessage": "No products found. Clear filters or add source data."
        }
      ]
    }
  ]
}
```

Reports accept `varchar2`, `number`, `date` and `timestamp`; `formatMask` and `emptyMessage` are optional. Columns/mappings use uppercase SQL aliases. Cards accept any SELECT returning the two mapped columns; UNION ALL can supply several KPI cards. Charts are bar charts with their axes and column mappings emitted together. Page IDs are unique, 1–9998. Navigation entries are added, preserving existing entries.

On a blank generated Home page, the emitter adds regions while retaining Oracle's page header and hero. Other existing pages are protected. Re-running a spec may update its unchanged generated pages; an intervening human edit blocks replacement. Backups and outputs live in `.apexrest/scaffolds/`. For custom layouts/components or a human-edited page, edit APEXlang normally and use targeted references.

After scaffolding, call `apexrest_ship mode:apply` once. It performs the mandatory compiler validation and exact deployment checks. Fix diagnostics and retry only as directed. A separate validate, plan or preview is unnecessary for routine scaffold output; use preview for custom visual behavior or when requested. Never bypass ship with a raw import after an unknown outcome. Check additional metadata/SQL only when the task requests it; batch metadata requests and use one read-only SQLcl session for remaining SQL observations.

## Requested server observations

When the task also requests imported metadata and SQL checks, pass the exact `env` key to `action:scaffold`. It returns `readback.sqlFile`, a target-bound SQLcl script in private `.apexrest/` storage. After successful ship, run it once with the task's authorized saved connection, in a noninteractive batch:

```sh
"$SQLCL_BIN" -S -L -name "AUTHORIZED_SAVED_NAME" @"RETURNED_SQL_FILE"
```

The script uses the reviewed 26.2 dictionary columns, checks database/service/schema/workspace/application identity, and reads the imported pages, regions, report columns, chart mappings and navigation. It executes the selected pages' stored report/card/chart SELECT sources in a read-only transaction, returning row counts and bounded samples. Queries needing bind values or APEX session context need separate explicit observations. At most 10,000 rows are fetched per source; `allRowsFetched` reports truncation. Compare the actual observations with the task's requirements. There are no expected business values or application-test verdicts in this artifact.

Scaffold and ship never execute this file. Use it only for explicitly requested observations, without adding a deployment gate. Keep it outside the app source. Reuse it instead of discovering dictionary fields or writing another verification script. It does not establish browser behavior.
