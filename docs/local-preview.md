# Local APEXlang preview

`apexrest preview` runs an APEXlang application on Node.js without an Oracle database, or, with `--env`, against the application's own DEV/QA/TEST Oracle database ([connected mode](#connected-oracle-mode)). Use it for fast design and UX iteration: page layout, Universal Theme styling and components, navigation, reports and grids, faceted search, charts, forms, page items, dynamic actions and the server logic behind them.

The preview is a simulation. It never replaces `apexrest_apex_validate`, an import, or browser verification on a real APEX target, and its results are not Oracle evidence.

## When to use

| You want to                                                                   | Use                                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| See and click through pages without a database                                | `apexrest preview start` (data in SQLite)                                                          |
| List the features of an application that the preview does not run             | `apexrest preview check`                                                                           |
| Preview pages that depend on project packages, procedures, views or real rows | [Connected mode](#connected-oracle-mode): `--env <name>`, every request rolled back                |
| Use the connected preview as a working application on a local database        | Commit mode: `--env <name> --commit`                                                               |
| Confirm how the application behaves in Oracle APEX                            | Not the preview: the Oracle compiler, an authorized import and browser verification on DEV/QA/TEST |

## Quick start

1. Download and extract the APEX 26.2 browser runtime once:

   ```sh
   apexrest preview setup
   ```

2. Render every page and list the unsupported features:

   ```sh
   apexrest preview check --project /abs/app
   ```

3. Start the preview and open one of the printed page URLs:

   ```sh
   apexrest preview start --project /abs/app
   ```

4. Edit the `.apx` sources. Open pages reload themselves; no restart is needed.

## Commands

```sh
apexrest preview setup                      # once; or: --zip /path/apex_26.2_en.zip [--sha256 HEX]
apexrest preview check --project /abs/app   # render every page; list unsupported features
apexrest preview start --project /abs/app   # serve on 127.0.0.1 and print page URLs (Ctrl+C stops)
apexrest preview start --source-dir src --port 8765 --reset
apexrest preview start --project /abs/app --env dev   # connected mode: data and PL/SQL from Oracle
apexrest preview start --project /abs/app --env dev --commit   # working mode on a local database: successful requests are committed
apexrest preview status                     # every running preview, from any APEXREST process
apexrest preview stop --project /abs/app    # stop the project's previews, also from another terminal
apexrest preview stop --port 8765           # or select by --source-dir, --port; --all stops every preview
```

### Select the application

- `--source-dir` overrides `application.sourceDir` from `apexrest.json`.
- A folder that directly contains `application.apx` also works without a project file.
- In MCP hosts the same actions are available as `apexrest_preview action:setup|start|check|stop|status`. The started server lives as long as the MCP process and only listens on the loopback interface.

### Status and stop

Every running preview is recorded in `APEXREST_HOME/preview/servers/` (process ID, port, URL and source folder) and removed when it stops. Entries whose process has exited or whose port is closed are pruned when read. `preview status` and `preview stop` therefore see previews started by other processes and accept the same selectors:

| Selector       | Selects                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `--source-dir` | One application folder                                                  |
| `--project`    | Every preview inside the project                                        |
| `--port`       | The preview on that port                                                |
| `--all`        | Every preview (stop only)                                               |
| None           | Status lists everything; stop targets the current project's application |

- A foreground `apexrest preview start` is stopped with SIGTERM, and stop waits until its port closes.
- A preview hosted by an MCP process is listed but never signalled from another process; stop it from that session.
- A stop that finds nothing to stop fails with `PREVIEW_NOT_RUNNING` (status `not_found`, exit code 2) and names the running previews.

### Request safeguards

Displaying a page can run its SQL and PL/SQL before it renders. The preview checks where a request came from:

- It refuses requests with a foreign `Host`, a foreign or `null` `Origin`, or a `Sec-Fetch-Site` value of `cross-site` or `same-site`. This includes top-level GET and HEAD navigation.
- Execute Server-side Code and SQL/PL/SQL Set Value actions run only the code of the rendered page: the browser sends a reference, never code, and only the declared Items to Submit and Items to Return pass. As in APEX, that code takes values through bind variables, not `&ITEM.` substitution.
- Open the printed `127.0.0.1` URL or `localhost` on the same port. If a link from another website receives a 403 response, paste the preview URL directly into a browser tab. Direct navigation and links within the preview are supported.
- URL parameters set page and application items, but never APEX built-ins such as `APP_USER`, `APP_ID` or `APP_SESSION`. Use the developer toolbar's view-as roles to preview other authorization outcomes.

### Developer toolbar

The developer toolbar at the bottom of every page follows APEX's runtime developer toolbar. With it you can:

- read the page diagnostics;
- view and edit session state;
- read a debug log of recent requests (computations, processes, validations, branches, authorization checks and timings);
- open any page;
- preview the page at tablet or phone size;
- reset the local database from its seed scripts;
- open the local e-mail outbox;
- pick a theme style (for example Vita, Vita - Dark or Redwood Light);
- leave review comments on components for an agent (see [Review comments](#review-comments)).

### Review comments

**Review** on the toolbar (or **Alt+Shift+C**) lets you point at what should change and leave a comment for an agent, independent of Codex or Claude Code:

1. Press **Select on page**. Hovering highlights the component under the pointer: a report column, a page item, a button, a region, or any element.
2. Click it. The form offers every target from the exact element up to the page, an optional kind of change (`change`, `rename`, `move`, `remove`, `add`, `style`, `bug`, `question`) and the comment text. **Ctrl/Cmd+Enter** saves; **Esc** closes the form, a second **Esc** stops selecting.
3. Numbered pins mark commented components. The panel lists the comments of the page (or of all pages); you can edit, resolve, reopen or delete them, and **Copy** puts the open ones on the clipboard as text.

Comments are stored in `<project>/.apexrest/review/comments.json`, Git-ignored local state. Each comment names the page, the APEXlang component, the source folder, file and line, the selected element and your text.

The preview binds each selection to its source revision. It records the component's `project patch` target (for example `region:orders` or `column:orders.TITLE`), the page whose file declares it (0 for the global page) and the SHA-256 of that file at selection time. The preview never edits source or data for a comment.

**Edit** in the same form changes properties in the source instead of leaving a comment:

| Component     | Properties                |
| ------------- | ------------------------- |
| Page          | title                     |
| Region        | title, sequence           |
| Item          | label, sequence           |
| Button        | label, sequence           |
| Report column | heading, format, sequence |

The edit goes through the same digest-bound patch service as `project patch` and `apexrest_project action:patch`:

- **Add to changes** collects a change and lets you pick another component or property of the same page file; the list shows every proposed change before you save. **Save** writes them all, with the field you are editing, as one atomic change.
- It changes only those values in the page file, and the preview reloads once with them.
- If any change is invalid, nothing is written and the failing change is marked in the list.
- If the file changed after the page loaded, nothing is written; your proposed changes stay in the form so you can reload and save them on the newer version.
- While the form is open, a source change from elsewhere shows a **Reload** notice instead of discarding your draft.

The preview never writes APEX metadata: an edit is an ordinary source change for Git, validation and ship. Edits are available only in the developer preview with a project.

Agents read and close them without a running preview:

```bash
apexrest preview comments --json
apexrest preview resolve --ids rc-... --note "Renamed the column heading"
```

The MCP equivalents are `apexrest_preview action:comments` and `action:resolve`. Ask the agent to "apply the preview review comments".

`comments` adds a `context` to each comment whose selection maps to a source component:

- `target` and `digest`: the patch target and the page file's current digest, which is the `expectedDigest` for `project patch`;
- `changedSinceSelection`: whether that file changed after the comment was left;
- `component`: the component's current editable values, as `project context` returns them.

Other comments keep `file:line` only.

"View as" is off by default, so every authorization scheme allows access. When you choose a set of ACL roles, role checks and authorization schemes are enforced, denied pages show an access error and denied components are hidden.

`GET /__apex/diagnostics` returns all diagnostics as JSON. Legacy `f?p=APP:PAGE:SESSION:REQUEST:DEBUG:CLEAR:ITEMS:VALUES` links redirect to the friendly page URLs.

## How it works

- **Assets.** `preview setup` downloads the official APEX 26.2 distribution (`apex_26.2_en.zip`, about 255 MB) once, or uses a local copy passed with `--zip`.
  - It extracts only the browser runtime (about 70 MB: `libraries/apex`, jQuery, Font APEX, Oracle fonts, FullCalendar, marked, Cropper.js, JointJS+, the carousel plug-in, `themes/theme_42/26.2`, `app_ui`; Oracle JET is not extracted).
  - It evaluates the Universal Theme export `core/themes/f8842.262.sql` into page, region, label, button, list, report and breadcrumb templates.
  - Nothing from the distribution is stored in this repository.
  - The cache lives in `~/.apexrest/preview/26.2`, or in `APEXREST_PREVIEW_ASSETS` when set.
- **Rendering.** Pages are rendered with the genuine 26.2 templates, display points (`slot` → `#PLACEHOLDER#`), template options, the 12-column grid and theme style. The genuine `desktop_all.min.js` and `theme42.min.js` run in the browser, so modal dialogs, side navigation and messages use Oracle's own client code.
- **Submit protocol.** The server implements `wwv_flow.accept` for `apex.page.submit` (`p_json`, `{ redirectURL }` or `{ errors }`), so validation errors appear inline and in the page notification exactly as `apex.message` shows them.
- **Data.** SQLite (`node:sqlite`) stands in for Oracle.
  - **Project application.** When the preview runs a project's own application (`apexrest.json`), nothing is written into the deployed source tree. The database is `<project>/.apexrest/preview/preview.sqlite`. On first start it is seeded from the project migrations followed by `<project>/.apex-local/*.sql` (data); PL/SQL units in them are kept for the [application database code](#application-database-code).
  - **Folder without a project, or a legacy `<sourceDir>/.apex-local`.** The database is `<sourceDir>/.apex-local/preview.sqlite`, seeded from `.apex-local/*.sql` in name order, or from the supporting objects' install scripts in the order `supporting-objects/install-scripts.apx` declares (`execution.sequence`).
  - **Translation.** Common Oracle syntax is translated or provided as functions: `nvl`, `nvl2`, `decode`, `to_char`, `to_date`, `to_number`, `trunc`, `initcap`, `lpad`/`rpad`, `add_months`, `months_between`, `regexp_like`, `listagg`, `sysdate`, `from dual`, `fetch first … rows only`, identity columns and `v('ITEM')`. Bind variables use session state.
  - **Character references.** `UTL_I18N.UNESCAPE_REFERENCE` decodes HTML 4 names and decimal/hexadecimal character references in SQL and local PL/SQL, including values escaped by APEX. Empty input returns NULL. Invalid references retain the original string.
  - **Install scripts.** Install scripts written for Oracle load as Oracle would run them: statements without a local meaning (`COMMENT ON`, `ALTER TRIGGER`, grants, `ALTER SESSION`, domain indexes, foreign key and check constraints added later) are skipped, `ALTER TABLE … ADD PRIMARY KEY/UNIQUE` becomes a unique index, identity options, time zones, `NUMBER(*,0)` and storage clauses are dropped, and SQL\*Plus commands such as `SHOW ERRORS` are ignored.
- **Sample tables.** A table that a page uses but the database lacks is created automatically with sample rows. Column types, keys and lengths come from form items anywhere in the application; columns referenced later are added on demand. Each such action is reported. Put real DDL and data in `.apex-local/*.sql` (add `.apex-local/` to `.gitignore` if the data is private). The root-level `<sourceDir>/.apex-local/` directory is preview state, not application source: source inventories, compiler validation, plan and peer-review source digests, working-copy checks, import bundles, snapshots and backups skip it, so a running preview never causes `SOURCE_DRIFT` or changes a plan digest. It must still be a regular directory; a symlink there is rejected.
- **Extensions.** Feature modules under `packages/core/src/preview/extensions/` register region, item, column, process, condition, validation and code handlers, server routes and browser code with the renderer; see `extensions.ts`.
- **Hot reload.** `.apx` changes are picked up on the next request; no restart is needed. Open pages reload themselves over the [live connection](#live-updates-over-websocket). Use `--reset` to rebuild the database.

## Live updates over WebSocket

Every page with the developer toolbar keeps a WebSocket to the preview server (`<app>/__apex/live`). It is a preview feature for design work; APEX itself does not push changes to open pages.

- **Data regions follow their tables.**
  - When the page renders, each data region is mapped to the local tables its SQL, table or PL/SQL source reads. Views resolve to their base tables, chart series and map layers count as part of their region, and static HTML or text is not read as SQL.
  - When any request writes one of those tables (a page submit, an interactive grid save, Execute Server-side Code, Set Value, the toolbar's data reset), every open page refreshes the affected regions in place through `apex.region().refresh()`.
  - This covers classic and interactive reports, interactive grids, cards, list views, template components, trees, charts, calendars, maps, and faceted search and smart filter counts (through the region they filter).
  - The page that made the change refreshes its other regions quietly; other tabs and sessions show who changed which tables. Refreshed regions are briefly outlined.
- **Safeguards.**
  - A grid with unsaved edits is not refreshed; it shows a notice.
  - Form regions are never refreshed; they show a notice with a Reload button.
  - Refreshes of one region are coalesced to at most one every 800 ms.
  - Region refreshes and Ajax reads do not publish changes, so two pages cannot keep refreshing each other.
- **Source edits.**
  - The preview keeps each parsed `.apx` file and re-reads only files whose size or modification time changed. A rename or restore with an older timestamp is still detected. While the file watcher is healthy, requests do not rescan the source tree, except for a scan at most every two seconds in case an event was missed.
  - Each successful load increases the source revision; pages ignore older or repeated notifications.
  - Only the pages a change affects reload: the edited page itself, or the pages that reference a changed shared component. A change to the application, the global page, a theme or an unknown file reloads every page.
  - When an edit changes only static content, classic or interactive report, or cards regions in place, those regions are replaced without a reload, through their normal refresh. Any other change reloads the page and keeps its scroll position.
  - A changed CSS static file replaces its stylesheet link without a reload.
  - A page with unsaved changes gets a Reload button instead.
  - A source that does not parse keeps the last good version, marked "Stale preview" with the error, until a valid change.
- **Presence and control.** The toolbar's **Live** button shows the connection state and how many tabs view the same page, and as which users. Clicking it turns live updates off or on for the browser. After a server restart, a page offers a reload instead of reconnecting with a session the server no longer knows.
- **Scope.**
  - The socket accepts only same-origin pages with a known preview session on the loopback server.
  - Write tracking uses the SQLite authorizer (Node.js 24.10 or later).
  - Writes made outside the preview, for example with the `sqlite3` CLI, are not seen.
  - In [connected mode](#connected-oracle-mode) only source reloads and presence are pushed, also in commit mode.
  - Dialog pages and pages without the toolbar do not connect.

## Connected Oracle mode

Without a database the preview simulates data in SQLite and interprets a subset of PL/SQL. When the project has an Oracle DEV/QA/TEST environment with a SQLcl saved connection, `--env <name>` (MCP: `env`) on `start` or `check` runs the application's data and server logic in that database instead. Rendering stays in Node.js. Choose this when a page depends on project packages, procedures, functions, views or real rows.

```sh
apexrest preview start --project /abs/app --env dev
apexrest preview start --project /abs/app --env dev --commit
```

The toolbar's Session panel and the `start` result name the environment and target. Connected results come from a real database, but rendering, session handling and transaction scope are still the preview's. They are not compiler, import or browser evidence.

### Target and session

- **Target guard.**
  - The environment comes from `apexrest.json` and uses its `readConnectionRef`.
  - Production is refused: either `kind: production` or a target registered in `production-trust.json` (see [deployment safety](deployment-safety.md)).
  - The connection must be a SQLcl saved connection; ORDS-only connections cannot hold one transaction and are refused.
  - On connect the database unique name, service, parsing schema and workspace must match the environment exactly, as for deployment.
- **Session.** The preview opens one SQLcl MCP server in a worker thread and keeps its session for the life of the preview. The renderer waits synchronously for each batch. The session starts with `exitcommit` and `autocommit` off and `ALTER SESSION DISABLE COMMIT IN PROCEDURE`.
- **Named connections.** In CLI transport, the owned server connects through SQLcl's `CONNECT -name` command. This retains normal transaction settings when the saved connection omits `autoCommit`; SQLcl 26.3's MCP `connect` tool enables JDBC auto-commit in that case. Explicit MCP transport retains its advertised connect tool. A rollback probe still refuses a session whose JDBC auto-commit is on, before application queries run. No saved connection properties are changed.
- **Warm-up.** Before `start` (or `check`) returns, the session reads column, primary-key and key-default metadata for all tables and views of the parsing schema in two dictionary queries and, when the application is installed, creates one APEX session. Both are rolled back. The first page therefore does not pay one dictionary round trip per table or the first APEX initialization; tables of other schemas are still looked up on first use. A warm-up failure is ignored and the per-request lookups remain.

### Transactions

- **Every request is rolled back.** Each HTTP request ends with `ROLLBACK`, whatever it changed. Because nothing persists, a row inserted by a form is gone on the next page.
- **Commit mode (working mode).** `start --env <name> --commit` (MCP: `commit: true` with `action: start`) uses the connected preview as a working application.
  - A request that ends without an error status and without failed page processing is committed; a submit or Ajax call that fails is rolled back, as APEX does.
  - The session then allows COMMIT in stored code, and page code with `COMMIT`, `ROLLBACK`, dynamic SQL or autonomous transactions is sent to Oracle instead of being skipped.
  - The tripwire is off.
  - The APEX session that each unit creates is deleted before the commit.
  - Commit mode is refused (`PREVIEW_COMMIT_REMOTE_REFUSED`) unless the saved connection is confirmed local by the same endpoint and server-identity check as deployment (see [deployment safety](deployment-safety.md)); production is refused as always, and JDBC auto-commit must be off.
  - `check` never commits.
  - DDL from the preview itself is still never sent.
- **What cannot commit.** Oracle blocks COMMIT only inside stored code, not in anonymous blocks or dynamic SQL.
  - Page code that contains `COMMIT`, `ROLLBACK` (other than `ROLLBACK TO SAVEPOINT`), `EXECUTE IMMEDIATE`, `DBMS_SQL` or `PRAGMA AUTONOMOUS_TRANSACTION` is therefore never sent; it is skipped with a diagnostic.
  - DDL from the preview itself (sample tables, schema repair, seeding, data-load targets) is never sent either.
  - Page code and region SQL containing a line SQLcl acts on regardless of quoting — only `/`, only `.`, a leading `#`, or in SQL a line ending with `;` — are refused the same way, because SQLcl would run the rest as separate statements; bind values are sent without raw line breaks.
- **Tripwire.** Every unit records `DBMS_TRANSACTION.LOCAL_TRANSACTION_ID` before and after it runs. If a package still ends the transaction, the unit fails with an error diagnostic that says earlier work may have been committed.
- **Not undone.** Autonomous transactions in stored code (they are listed as a warning at start), sequence numbers and side effects outside the database (mail, HTTP calls, jobs).

### Data and PL/SQL in Oracle

- **Data.**
  - Region, LOV, report, grid, chart, card, facet, tree and form SQL runs in Oracle untranslated, with page items as binds.
  - Forms let Oracle fill keys (identity, default or trigger) instead of the local max + 1.
  - Preview-internal state stays in an in-memory SQLite database: session tables, collections, files, mail outbox and the generated `APEX_APPLICATION_*` views. File, BLOB and data-load features therefore remain local and do not reach Oracle tables.
- **PL/SQL.** Processes, validations, conditions, computations, item sources, authorization schemes and dynamic content run as whole anonymous blocks in Oracle. They are not interpreted locally. Referenced binds are IN OUT session state, so assignments to `:P1_X` come back to the page.
  - Function bodies and expressions are first wrapped as values. When Oracle reports the wrong type, the preview retries once as a boolean condition and remembers the result.
  - When the application ID is installed in the target workspace, each request also creates an APEX session (`apex_session.create_session`) and copies installed item values into it, so `v()` and `apex_util` work inside packages. Page items are read back afterwards. Without an installed application, or if the session cannot be created, database code runs with binds only and `v()` returns NULL.
  - `htp` output is captured for dynamic content. `DBMS_OUTPUT` lines go to the diagnostics. `raise_application_error` messages appear as APEX errors.
- **Not covered.** `apex_error.add_error` inline errors raised inside Oracle code, REST-enabled SQL processes, BLOB columns, LOB values larger than 32 KB and binds longer than 32,767 bytes are not supported in connected mode.

## Supported locally

### Pages, theme and navigation

- **Page templates.** All Universal Theme 26.2 page templates (standard, side columns, marquee, modal dialog, drawer, wizard, login) with their slots and grid.
- **Navigation.** Navigation menus and bars, and breadcrumbs.
- **Theme style.** The theme style of the application or the toolbar picker, including the theme's own styles: a subscribed style uses its master's files, and a Theme Roller style loads its `outputCssFileUrl`, with `#THEME_DB_IMAGES#` served from the theme's `static-files` folder.
- **Messages.** Success/error messages through the genuine `apex.message` templates.
- **Dynamic lists.** Dynamic lists (`source.type: sqlQuery`) run their query, locally or in Oracle in connected mode, and read the columns by position as APEX does: level, label, target, is_current_list_entry (`YES`/`NO`, or decided from the target page when empty), image, image_attribute, image_alt_attribute and attribute1–10. Rows nest by level in query order. A failing query renders an empty list with a warning; other list source types are reported as not simulated.
- **APEX-generated page URLs.** Page URLs that Oracle APEX generated — `http://:/r/ws/app/page?…&session=…&cs=…` in PL/SQL dynamic content, or `/ords/r/ws/app/page?…` in list targets and report values — open the matching preview page: dynamic content and list targets are rewritten, and such requests are redirected. `session` and `cs` are dropped; other parameters are kept.

### Reports and grids

**Interactive reports**

- They use the real Universal Theme markup for search, column-heading menus, the Actions menu (columns, filter, rows per page, sort, reset, CSV/HTML download) and filter chips, starting from the primary saved report.
- They also simulate the Actions menu views: control breaks, highlights, computed columns (SQL over column identifiers, evaluated in SQLite), aggregates, Group By, Pivot and Chart views (drawn by the local SVG renderer), and the single row view, both from APEXlang saved reports and from the menu dialogs.
- Primary, alternative and public saved reports appear in the reports select list, and named private reports are kept per preview session.
- Downloads produce CSV, HTML, a real .xlsx workbook, and a labelled print page in place of PDF.

**Interactive grids**

- They run APEX's own grid, toolbar and model JavaScript over local data, with inline editing, add/duplicate/delete rows, master-detail and filters.
- Save, or a page submit with "Interactive Grid - Automatic Row Processing (DML)", writes the changes to SQLite.
- With a PL/SQL Code target (`target.targetType: plsqlCode`) the row processing runs that code once per changed row instead, with the row's columns and `:APEX$ROW_STATUS` (C, U or D) as binds — locally in the interpreter, or in Oracle in connected mode; a failing row undoes the rows before it and its message is shown.
- `apex.region(id)` of a grid region is an Interactive Grid region interface, so page JavaScript can use `call("getViews", "grid").model`, `call("getCurrentView")`, `call("getActions").invoke("save")` or `invoke("refresh")`, `call("getSelectedRecords")`, `widget()` with the `interactivegridsave` event after a save, and `refresh()`; other `call` methods throw a "not simulated" error.
- They add popup LOV, radio and checkbox groups, switch, star rating, color and date editors, edit authorization under the "view as" policy, and saved-report control breaks, highlights and aggregates.

**Classic reports**

- They support sortable headings, the pagination types, rows per page, break formatting and CSV links.

**All reports**

- Report settings are kept per preview session, and anything not simulated (charts, group by, pivot, highlights, single-row view, PDF/Excel) appears as a diagnostic.

### Search, cards and lists

- **Faceted Search and Smart Filters** run Oracle's own `apex.facets` widget. The preview answers its count requests locally and filters the bound region (classic report, interactive report, cards or list view) on the server, so counts, chips, "show all", clear and live refresh behave as in APEX. Supported facets are checkbox and radio groups, ranges, select lists, input fields, search, star ratings and facet groups, with distinct, static, SQL or shared LOVs.
- **Cards** render the native `a-CardView` markup with icons, badges, media, card actions, ordering items and pagination.
- **List View** is supported too.
- **Search regions** use the genuine `apex.search` widget over search configurations with local SQL, table or list sources.

### Trees, wizards and legacy regions

- **Trees.** Tree regions run on Oracle's own treeView widget, built from pre-computed level/status columns or from node and parent key columns. Oracle `start with … connect by prior` queries (with `level`, `connect_by_isleaf`, `sys_connect_by_path`, `connect_by_root` and `order siblings by`) are translated to SQLite recursive CTEs in any region.
- **Wizards.** Wizards work through Next/Previous/Reset Page and Trigger Action buttons, Form Pagination, Reset Pagination and legacy Automatic Row Fetch/Processing, with Stop and Start Grid Layout items.
- **Legacy regions.** Tabular forms, reflow and column toggle reports, the legacy calendar, legacy charts and the jQuery date picker are mapped onto modern renderers, each with a diagnostic.

### Universal Theme components and region behavior

- **Template components.** Template components (`themeTemplateComponent/…`, such as Content Row, Media List, Metric Card, Badge, Avatar, Comments, Timeline and Flexbox Container) render with the genuine partial and report templates from the theme export, including Single, Multiple and Region Only display, attribute groups, grouping, pagination, and row actions and menus; they also work as report column types.
- **Template directives.** Template directives (`{if}`, `{case}`, `{loop}`, `{with/}{apply/}` and escape filters) are evaluated as `apex.util.applyTemplate` does.
- **Region behavior.** Tabs and Carousel containers, the Region Display Selector, collapsible regions, and inline dialogs, drawers and popups (opened by Open/Close Region dynamic actions) use Oracle's own widgets.

### Charts, calendars and maps

- **Charts.** Charts are drawn by a local SVG renderer styled after Oracle JET's Redwood theme: bar, line, area, combination, pie, donut, scatter, bubble, funnel, pyramid, status meter gauge, radar and polar charts, with legends, axis titles, value labels, links and hover tooltips, redrawn at the region's real width. A Refresh dynamic action updates a chart without reloading the page; `source.pageItemsToSubmit` from every series is combined with region declarations and used for both refresh and width redraws.
- **Calendars.** Calendar regions use the genuine FullCalendar shipped with APEX (month, week, day and list views), fed from the region SQL.
- **Maps.** Map regions plot their layers on an offline canvas without background tiles, with a layer and feature list. Layers read longitude/latitude columns, GeoJSON text or a JSON representation of Oracle `SDO_GEOMETRY`. Supported shapes include points, lines and polygons with straight edges, optimized rectangles and their multi forms. Arcs and compound elements are omitted.
- **Not Oracle JET.** None of this is Oracle JET. Initialization JavaScript functions (`componentAdvanced` or `advanced.initJavaScriptFunction`) are not run: a chart that has one shows a visible note under it and a warning, and `start`, `check` and `status` list every such function in `notAppliedLocally`. Check its axes, formats and tooltips on the imported application.

### Page items

- Page items render with the genuine APEX 26.2 item widgets: the `a-date-picker` web component, the popup LOV dialog with search and multi-column grids, Select One/Many and combobox, shuttle, switch, star rating, color picker, markdown editor, file drop zones, QR codes and percent graphs, plus text, number, textarea and list items with their format masks, pre/post text, icons and template options.
- Cascading LOV refreshes, popup LOV search and paging, combobox lookups and item help are answered from the APEXlang source and SQLite.
- Read-only conditions on items or regions render display-only markup.

### Application database code

The application's own PL/SQL runs locally. Packages (specification and body), standalone functions and procedures and anonymous blocks are read from the seed and install scripts:

- **Calls.** Page processes, computations, conditions, authorization schemes, dynamic content, plug-ins and triggers call package routines by name, with overloads chosen by their arguments, default parameters and OUT parameters. Package variables and constants (`pkg.g_x`) can be read and assigned.
- **Package state.** A package starts in its initialization section the first time a request uses it and keeps its state for that request, like a reset pooled APEX database session.
- **From SQL.** Package and standalone functions are also SQL functions, so `select pkg.fn(col) from t` in regions, LOVs, lists and PL/SQL cursors runs the function per row.
- **Install blocks.** Anonymous blocks of the install scripts run once, after every unit is known, on a new local database.
- **Triggers.** `BEFORE INSERT/UPDATE … FOR EACH ROW` triggers that fill columns (`:new.id := seq.nextval`, `:new.created := sysdate`, `:new.row_version := nvl(:old.row_version, 0) + 1`, `IF INSERTING/UPDATING`, `SELECT … INTO :new.x FROM dual`) become SQLite triggers. Statements of a trigger without a SQL meaning (package calls, DML on other tables) are reported once and skipped. AFTER, statement-level and compound triggers do not run.
- **SQL.** Oracle outer joins with `(+)` become LEFT JOINs, `START WITH … CONNECT BY PRIOR` becomes a recursive CTE in every statement (not only region SQL), and `#OWNER#.`, `sys.` prefixes, `SELECT UNIQUE`, `INTERVAL '2' HOUR`, `ora_hash`, `numtodsinterval`, `dbms_random.value` and `TO_NUMBER(SYS_GUID(), 'XXXX…')` work.
- **Dictionary.** `USER_TABLES`, `USER_TAB_COLUMNS`, `USER_VIEWS`, `USER_INDEXES`, `USER_OBJECTS`, `USER_SOURCE`, `USER_SEQUENCES`, their `ALL_` and `DBA_` forms, `SESSION_PRIVS`, `USER_ROLE_PRIVS`, `V$TIMEZONE_NAMES`, `V$VERSION` and `DUAL` describe the local schema (named `APEX_LOCAL`). The APEX dictionary also reports region `SOURCE_TYPE` and `SOURCE_TYPE_CODE` as APEX does (`Interactive Report`, `NATIVE_IR`), and adds `APEX_APPLICATION_PAGE_TREES`.

Legacy package names (`htmldb_lang`, `wwv_flow_utilities`, `wwv_flow_collection`, …) map to their `APEX_` packages in PL/SQL and SQL. Connected mode runs the application's packages in Oracle instead.

### Plug-ins

Region and item plug-ins written in PL/SQL (`shared-components/plugins/<kind>/<name>/plugin.apx` with `source.plsqlCode`) run their render callback:

- **Records.** `p_region`/`p_item` and `p_plugin` records come from the component, its `settings` and the plug-in's custom attributes with their defaults (substituted when the plug-in asks for it).
- **Output.** The HTML the callback prints with `htp` is the region body or item.
- **Callback styles.** Both callback styles work (function with `p_is_printer_friendly`, procedure with `p_param`/`p_result`).
- **Files.** The plug-in's declared CSS and JavaScript files and `apex_javascript`/`apex_css` calls are added to the page, and its `static-files` are served as `#PLUGIN_FILES#`.
- **Data and Ajax.** `apex_plugin_util.get_data`/`get_data2` read the region source, and `apex.server.plugin` calls with `apex_plugin.get_ajax_identifier` run the ajax callback, whose `apex_json` output is the response.

Dynamic action and process plug-ins are reported as not simulated.

### Server logic

#### PL/SQL interpreter

- The preview interprets a subset of PL/SQL: anonymous blocks, variables, IF/CASE, loops including cursor FOR loops, SELECT INTO, DML with RETURNING, exceptions, `raise_application_error`, local and package subprograms, records and collections accessed through chains such as `list(i).value_list(j).varchar2_value`.
- A statement the interpreter cannot express (an assignment to an unsupported target) is reported when it runs instead of failing the whole unit.
- Control flow runs in Node.js and every expression and SQL statement runs in SQLite through the Oracle shims (also sequences, MERGE, ROWNUM, `connect by level`, ordered LISTAGG and date masks).
- Processes, validations, server-side conditions, computations, item defaults and sources, branches, PL/SQL dynamic content regions, dynamic actions, and application processes and computations use it.
- Common APEX APIs (`apex_util`, `apex_error`, `apex_page`, `apex_string`, `apex_escape`, `apex_lang`, `htp`, `v()`) are stubbed; other package calls are reported and skipped.
- Authorization schemes are evaluated and reported, but every page stays accessible.

#### Oracle semantics in SQLite

The SQL shims follow Oracle semantics where SQLite differs:

- Empty item values bind as NULL.
- `/` is real division.
- `||` and implicit number-to-text conversion print numbers as Oracle does (`15`, `.5`).
- Date ± number and date - date work on any date expression.
- ANSI `date '…'`/`timestamp '…'` literals, `DEFAULT sysdate`/`seq.nextval` and identity columns work in seed DDL.
- `json_value`/`json_query`/`json_exists` take Oracle paths.
- `regexp_*` functions and regular-expression validations accept POSIX classes and match parameters.
- Form processing stores date items in canonical date form and shows them in the item's format mask.
- When an inserted form row has no primary key value and the local schema declares no identity, default or `before insert` trigger for it, the preview generates max + 1 and reports a warning, because Oracle would need a key.

#### Transactions and validations

- Page submits, Execute Server-side Code, grid saves and Set Value calls run in one SQLite transaction: an unhandled process, branch or row-processing error stops processing, is shown to the user like an APEX error and rolls back the page's DML.
- PL/SQL `COMMIT`, `ROLLBACK` and savepoints work; autonomous transactions are reported, not simulated.
- Validation messages substitute `#LABEL#` and `#COLUMN_HEADER#`; interactive grid row validations (`editableRegion`) run per changed row on Save and on submit and mark the failing cells.
- Form regions detect lost updates by row version column or row checksum.
- Region refreshes submit the region's page items to submit.

#### Source checks against the component catalog

When the application loads, property paths and enumerated values are checked against the APEXlang component catalog (Oracle MMD 26.1 metadata and the native plug-in declarations) for pages, regions, items, buttons, dynamic actions and their actions, validations, computations, branches, report and grid columns, and chart/map parts.

- Each component is checked against the component type the compiler uses for it: a classic report column against classic report column properties, an interactive grid column against the settings of its item type.
- A property whose display condition is false is reported too, as the compiler rejects it (a legend position on a pyramid chart, the first hour of a calendar without time display, a selector that depends on an invalid selection type).
- Further checks:
  - link targets with a `url` need `type: url`;
  - native plug-in link attributes, including calendar create and view/edit links, need structured targets. Scalar URLs and row substitutions can pass the offline compiler and fail Oracle import with `ORA-40441`.
  - APEX 26.1 interactive report column data types use native codes such as `NUMBER`, `DATE` and `STRING`. Lowercase codes and the SQL datatype `VARCHAR2` are reported with their native replacement when the source declares 26.1 metadata.
  - `advanced.staticId` is rejected because the component identifier is the static ID;
  - page items need `layout.slot`;
  - report columns need `layout.sequence`;
  - public saved reports need `settings.appUser`;
  - interactive report computations are named `C01`, `C02`…;
  - shared component files the compiler does not read (`shared-components/lists-b.apx` instead of `lists.apx`, a REST data source outside `rest-data-sources/`) are reported because references to their components do not resolve.
- Values added in 26.2, such as the classic report pagination `showAll`, are accepted unless `.apex/apexlang.json` declares an earlier `mmdVersion`.
- All findings are warnings in `preview check` and the toolbar; the SQLcl compiler remains the authority.
- Not checked: process groups and values (they depend on the process type), saved report views and their children other than the rules above, plug-in and template component settings, minimum child counts (a template component report without columns, a chart without axes), and display conditions that depend on plug-in features (a column span on a hidden item).

### Files and data

- **Uploads.** Page submits with files arrive as multipart requests and are stored in SQLite: in `APEX_APPLICATION_TEMP_FILES` or `APEX_APPLICATION_FILES`, or in the form's BLOB column; item values hold the generated file name, as in APEX.
- **Downloads.** Display Image items, Display Image and Download BLOB report columns, the Download process and action, and `wpg_docload`/`apex_http.download` serve stored BLOBs with their MIME type.
- **Data load.** Data load definitions and `apex_data_parser`/`apex_data_loading` parse CSV, TSV, JSON, XML and XLSX and insert into local tables, reporting processed and error rows.
- **Printing.** Report printing opens a print-friendly HTML page, not a PDF.

### Platform services

- **Collections.** `apex_collection` and the `APEX_COLLECTIONS` view live in SQLite per preview session.
- **Dictionary views.** APEX dictionary views (`APEX_APPLICATION_*`, `APEX_APPL_ACL_*`, `APEX_ACTIVITY_LOG`, `APEX_TEAM_FEEDBACK`, `APEX_APPL_AUTOMATIONS`, `APEX_TASKS`, `APEX_WORKFLOWS`, …) are generated from the APEXlang source on every reload and filled by the preview's own page views, feedback and ACL changes, so generated administration pages show real data.
- **E-mail.** E-mail from `apex_mail`, Send E-Mail processes and e-mail templates goes to a local outbox; nothing is sent.
- **Recorded locally.** Execution chains, user preferences, application settings and workflow/task processes are recorded locally.
- **REST.** REST Data Sources, Invoke API processes and `apex_web_service.make_rest_request` are answered from `.apex-local/rest/*.json`.
  - A fixture is either the response body or `{ "status": 200, "headers": {...}, "body": ... }`.
  - It is looked up as `<staticId>.<operation>.json`, `<staticId>.<httpMethod>.json`, then `<staticId>.json` (for URLs, the path segments joined with `_`, then the last segment).
  - Rows come from the data profile's row selector (or `items`), with columns mapped by the data profile column selectors.
  - A missing fixture gives a diagnostic and an empty result.

### Dynamic actions

| Part                   | Supported                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client events          | Client events, including custom events, event scope and debounce/throttle                                                                                                                                                                                                                                                        |
| Client-side conditions | Comparisons, lists, JavaScript expressions                                                                                                                                                                                                                                                                                       |
| Actions                | Execute JavaScript, Refresh, Show/Hide, Enable/Disable, Set Value (static, JavaScript, SQL, PL/SQL, dialog return), Clear, Set Focus, Add/Remove Class, Set Style, Open/Close Region, Alert/Confirm, success and error messages, Cancel Event, Submit Page, dialog close/cancel, Execute Server-side Code, geolocation and share |

## Not simulated

These appear as diagnostics instead of silent omissions:

- Authentication (any login succeeds and sets `APP_USER`)
- Session state protection
- `EXECUTE IMMEDIATE`
- Explicit cursors (OPEN/FETCH/CLOSE)
- AFTER, statement-level and compound triggers
- Dynamic action and process plug-ins
- TinyMCE (the rich text editor is a simple stand-in)
- Oracle JET itself (charts are SVG)
- Facet charts
- Flashback and report subscriptions
- Interactive grid pivot/group by
- Real PDF output (print pages are HTML)
- Oracle Text/vector/REST search sources
- Workflow execution (diagrams are static outlines)
- Generative AI (labelled placeholder text)
- Geocoding and push notifications
- Translations and other plug-ins

Interpreted and simulated results are a design aid, not evidence of how the application behaves in Oracle.

## Verification boundary

**Repository tests.** Repository tests use a synthetic theme export and a generated zip.

**Real 26.2 distribution, database-free.** The real 26.2 distribution was exercised manually against the three public Oracle example applications:

- Every page of all three renders with no errors or warnings.
- 43 pages of the HR demo load in Chrome without console errors.
- Report, grid, facet, form, dialog, upload, data-load and administration flows were checked in Chrome.

That is local evidence only.

**Connected mode.** Connected mode was run on 2026-11-01 against a TEST Autonomous Database (APEX 26.1.6, application 102), both from a probe script and in the built-in browser:

- **Data and binds.** Data types and IN OUT binds were correct, region SQL ran in Oracle, and the `v()` values came from a real APEX session.
- **Rollback.** A form insert showed its success message and was absent on the next page; an independent session confirmed that no row persisted.
- **COMMIT.** That run also showed that Oracle does not block COMMIT in anonymous blocks, which led to the skip rule and the tripwire above.

**Not exercised.** COMMIT and DDL inside stored code, autonomous transactions and ORDS were not exercised. Confirm final behavior with the Oracle compiler, an authorized import and browser verification on DEV/QA/TEST.

## Related

- [Testing](testing.md): which checks establish what.
- [Deployment safety](deployment-safety.md): production marks and the local-target check that commit mode uses.
