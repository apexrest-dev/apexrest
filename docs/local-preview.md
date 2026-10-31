# Local APEXlang preview

`apexrest preview` runs an APEXlang application on Node.js without an Oracle database. It exists for fast design and UX iteration: page layout, Universal Theme styling and components, navigation, reports and grids, faceted search, charts, forms, page items, dynamic actions and the server logic behind them. It is a simulation. It never replaces `apexrest_apex_validate`, an import, or browser verification on a real APEX target, and its results are not Oracle evidence.

[Watch the explainer video (MP4, 1:37)](assets/apexrest-local-preview.mp4) · [Captions](assets/apexrest-local-preview.srt): live screens of Oracle's HR demo app running in the preview, from report and modal form to validation, save and hot reload.

## How it works

- **Assets.** `preview setup` downloads the official APEX 26.2 distribution (`apex_26.2_en.zip`, about 255 MB) once, or uses a local copy passed with `--zip`. It extracts only the browser runtime (about 70 MB: `libraries/apex`, jQuery, Font APEX, Oracle fonts, FullCalendar, marked, Cropper.js, the carousel plug-in, `themes/theme_42/26.2`, `app_ui`; Oracle JET is not extracted) and evaluates the Universal Theme export `core/themes/f8842.262.sql` into page, region, label, button, list, report and breadcrumb templates. Nothing from the distribution is stored in this repository. The cache lives in `~/.apexrest/preview/26.2`, or in `APEXREST_PREVIEW_ASSETS` when set.
- **Rendering.** Pages are rendered with the genuine 26.2 templates, display points (`slot` → `#PLACEHOLDER#`), template options, the 12-column grid and theme style. The genuine `desktop_all.min.js` and `theme42.min.js` run in the browser, so modal dialogs, side navigation and messages use Oracle's own client code.
- **Submit protocol.** The server implements `wwv_flow.accept` for `apex.page.submit` (`p_json`, `{ redirectURL }` or `{ errors }`), so validation errors appear inline and in the page notification exactly as `apex.message` shows them.
- **Data.** SQLite (`node:sqlite`) stands in for Oracle. On first start the database `<sourceDir>/.apex-local/preview.sqlite` is seeded from `.apex-local/*.sql` in name order, or best effort from `supporting-objects/*.sql`. Common Oracle syntax is translated or provided as functions: `nvl`, `nvl2`, `decode`, `to_char`, `to_date`, `to_number`, `trunc`, `initcap`, `lpad`/`rpad`, `add_months`, `months_between`, `regexp_like`, `listagg`, `sysdate`, `from dual`, `fetch first … rows only`, identity columns and `v('ITEM')`. Bind variables use session state.
- **Sample tables.** A table that a page uses but the database lacks is created automatically with sample rows. Column types, keys and lengths come from form items anywhere in the application; columns referenced later are added on demand. Each such action is reported. Put real DDL and data in `.apex-local/*.sql` (add `.apex-local/` to `.gitignore` if the data is private).
- **Extensions.** Feature modules under `packages/core/src/preview/extensions/` register region, item, column, process, condition, validation and code handlers, server routes and browser code with the renderer; see `extensions.ts`.
- **Hot reload.** `.apx` changes are picked up on the next request; no restart is needed. Use `--reset` to rebuild the database.

## Commands

```sh
apexrest preview setup                      # once; or: --zip /path/apex_26.2_en.zip [--sha256 HEX]
apexrest preview check --project /abs/app   # render every page; list unsupported features
apexrest preview start --project /abs/app   # serve on 127.0.0.1 and print page URLs (Ctrl+C stops)
apexrest preview start --source-dir src --port 8765 --reset
```

`--source-dir` overrides `application.sourceDir` from `apexrest.json`; a folder that directly contains `application.apx` also works without a project file. In MCP hosts the same actions are available as `apexrest_preview action:setup|start|check|stop|status`; the started server lives as long as the MCP process and only listens on the loopback interface.

The page shows a small toolbar with the diagnostics for the current page and a theme-style picker (for example Vita, Vita - Dark or Redwood Light) to compare designs; `GET /__apex/diagnostics` returns all diagnostics as JSON. Legacy `f?p=APP:PAGE:SESSION:REQUEST:DEBUG:CLEAR:ITEMS:VALUES` links redirect to the friendly page URLs.

## Supported locally

### Pages, theme and navigation

All Universal Theme 26.2 page templates (standard, side columns, marquee, modal dialog, drawer, wizard, login) with their slots and grid, navigation menus and bars, breadcrumbs, the theme style of the application or the toolbar picker, and success/error messages through the genuine `apex.message` templates.

### Reports and grids

Interactive reports use the real Universal Theme markup for search, column-heading menus, the Actions menu (columns, filter, rows per page, sort, reset, CSV/HTML download) and filter chips, starting from the primary saved report. Interactive grids run APEX's own grid, toolbar and model JavaScript over local data, with inline editing, add/duplicate/delete rows, master-detail and filters; Save, or a page submit with "Interactive Grid - Automatic Row Processing (DML)", writes the changes to SQLite. Classic reports support sortable headings, the pagination types, rows per page, break formatting and CSV links. Report settings are kept per preview session, and anything not simulated (charts, group by, pivot, highlights, single-row view, PDF/Excel) appears as a diagnostic.

### Search, cards and lists

Faceted Search and Smart Filters run Oracle's own `apex.facets` widget. The preview answers its count requests locally and filters the bound region (classic report, interactive report, cards or list view) on the server, so counts, chips, "show all", clear and live refresh behave as in APEX. Supported facets are checkbox and radio groups, ranges, select lists, input fields, search, star ratings and facet groups, with distinct, static, SQL or shared LOVs. Cards render the native `a-CardView` markup with icons, badges, media, card actions, ordering items and pagination. List View is supported too.

### Universal Theme components and region behavior

Template components (`themeTemplateComponent/…`, such as Content Row, Media List, Metric Card, Badge, Avatar, Comments, Timeline and Flexbox Container) render with the genuine partial and report templates from the theme export, including Single, Multiple and Region Only display, attribute groups, grouping, pagination, and row actions and menus; they also work as report column types. Template directives (`{if}`, `{case}`, `{loop}`, `{with/}{apply/}` and escape filters) are evaluated as `apex.util.applyTemplate` does. Tabs and Carousel containers, the Region Display Selector, collapsible regions, and inline dialogs, drawers and popups (opened by Open/Close Region dynamic actions) use Oracle's own widgets.

### Charts, calendars and maps

Charts are drawn by a local SVG renderer styled after Oracle JET's Redwood theme: bar, line, area, combination, pie, donut, scatter, bubble, funnel, pyramid, status meter gauge, radar and polar charts, with legends, axis titles, value labels, links and hover tooltips, redrawn at the region's real width. Calendar regions use the genuine FullCalendar shipped with APEX (month, week, day and list views), fed from the region SQL. Map regions plot their layers on an offline canvas without background tiles, with a layer and feature list. None of this is Oracle JET.

### Page items

Page items render with the genuine APEX 26.2 item widgets: the `a-date-picker` web component, the popup LOV dialog with search and multi-column grids, Select One/Many and combobox, shuttle, switch, star rating, color picker, markdown editor, file drop zones, QR codes and percent graphs, plus text, number, textarea and list items with their format masks, pre/post text, icons and template options. Cascading LOV refreshes, popup LOV search and paging, combobox lookups and item help are answered from the APEXlang source and SQLite. Read-only conditions on items or regions render display-only markup.

### Server logic

The preview interprets a subset of PL/SQL: anonymous blocks, variables, IF/CASE, loops including cursor FOR loops, SELECT INTO, DML with RETURNING, exceptions and `raise_application_error`. Control flow runs in Node.js and every expression and SQL statement runs in SQLite through the Oracle shims (also sequences, MERGE, ROWNUM, `connect by level`, ordered LISTAGG and date masks). Processes, validations, server-side conditions, computations, item defaults and sources, branches, PL/SQL dynamic content regions, dynamic actions, and application processes and computations use it. Common APEX APIs (`apex_util`, `apex_error`, `apex_page`, `apex_string`, `apex_escape`, `apex_lang`, `htp`, `v()`) are stubbed; other package calls are reported and skipped. Authorization schemes are evaluated and reported, but every page stays accessible.

### Dynamic actions

Client events (including custom events, event scope and debounce/throttle) and client-side conditions (comparisons, lists, JavaScript expressions) drive Execute JavaScript, Refresh, Show/Hide, Enable/Disable, Set Value (static, JavaScript, SQL, PL/SQL, dialog return), Clear, Set Focus, Add/Remove Class, Set Style, Open/Close Region, Alert/Confirm, success and error messages, Cancel Event, Submit Page, dialog close/cancel, Execute Server-side Code, geolocation and share.

## Not simulated

Authentication (any login succeeds and sets `APP_USER`), session state protection, APEX dictionary views (`APEX_*`) and `apex_collection`, `EXECUTE IMMEDIATE`, packages and explicit cursors, file upload storage, TinyMCE (the rich text editor is a simple stand-in), Oracle JET itself, interactive report chart/group by/pivot views, facet charts, REST data sources, translations and other plug-ins. These appear as diagnostics instead of silent omissions. Interpreted and simulated results are a design aid, not evidence of how the application behaves in Oracle.

## Verification boundary

Repository tests use a synthetic theme export and a generated zip. The real 26.2 distribution was exercised manually against the three public Oracle example applications: every page of all three renders without errors, and report, grid, facet, form and dialog interactions were checked in Chrome. That is local evidence only. Confirm final behavior with the Oracle compiler, an authorized import and browser verification on DEV/QA/TEST.
