# Local APEXlang preview

`apexrest preview` runs an APEXlang application on Node.js without an Oracle database. It exists for fast design iteration: page layout, Universal Theme styling, navigation, reports, forms and simple dynamic actions. It is a simulation. It never replaces `apexrest_apex_validate`, an import, or browser verification on a real APEX target, and its results are not Oracle evidence.

[Watch the explainer video (MP4, 1:37)](assets/apexrest-local-preview.mp4) · [Captions](assets/apexrest-local-preview.srt): live screens of Oracle's HR demo app running in the preview, from report and modal form to validation, save and hot reload.

## How it works

- **Assets.** `preview setup` downloads the official APEX 26.2 distribution (`apex_26.2_en.zip`, about 255 MB) once, or uses a local copy passed with `--zip`. It extracts only the browser runtime (about 70 MB: `libraries/apex`, jQuery, Font APEX, Oracle fonts, `themes/theme_42/26.2`, `app_ui`) and evaluates the Universal Theme export `core/themes/f8842.262.sql` into page, region, label, button, list, report and breadcrumb templates. Nothing from the distribution is stored in this repository. The cache lives in `~/.apexrest/preview/26.2`, or in `APEXREST_PREVIEW_ASSETS` when set.
- **Rendering.** Pages are rendered with the genuine 26.2 templates, display points (`slot` → `#PLACEHOLDER#`), template options, the 12-column grid and theme style. The genuine `desktop_all.min.js` and `theme42.min.js` run in the browser, so modal dialogs, side navigation and messages use Oracle's own client code.
- **Submit protocol.** The server implements `wwv_flow.accept` for `apex.page.submit` (`p_json`, `{ redirectURL }` or `{ errors }`), so validation errors appear inline and in the page notification exactly as `apex.message` shows them.
- **Data.** SQLite (`node:sqlite`) stands in for Oracle. On first start the database `<sourceDir>/.apex-local/preview.sqlite` is seeded from `.apex-local/*.sql` in name order, or best effort from `supporting-objects/*.sql`. Common Oracle syntax is translated or provided as functions: `nvl`, `nvl2`, `decode`, `to_char`, `to_date`, `to_number`, `trunc`, `initcap`, `lpad`/`rpad`, `add_months`, `months_between`, `regexp_like`, `listagg`, `sysdate`, `from dual`, `fetch first … rows only`, identity columns and `v('ITEM')`. Bind variables use session state.
- **Sample tables.** A table that a page uses but the database lacks is created automatically with sample rows. Column types, keys and lengths come from form items anywhere in the application; columns referenced later are added on demand. Each such action is reported. Put real DDL and data in `.apex-local/*.sql` (add `.apex-local/` to `.gitignore` if the data is private).
- **Hot reload.** `.apx` changes are picked up on the next request; no restart is needed. Use `--reset` to rebuild the database.

## Commands

```sh
apexrest preview setup                      # once; or: --zip /path/apex_26.2_en.zip [--sha256 HEX]
apexrest preview check --project /abs/app   # render every page; list unsupported features
apexrest preview start --project /abs/app   # serve on 127.0.0.1 and print page URLs (Ctrl+C stops)
apexrest preview start --source-dir src --port 8765 --reset
```

`--source-dir` overrides `application.sourceDir` from `apexrest.json`; a folder that directly contains `application.apx` also works without a project file. In MCP hosts the same actions are available as `apexrest_preview action:setup|start|check|stop|status`; the started server lives as long as the MCP process and only listens on the loopback interface.

The page shows a small toolbar with the diagnostics for the current page; `GET /__apex/diagnostics` returns all of them as JSON.

## Supported locally

| Area | Behavior |
| --- | --- |
| Page templates | All Universal Theme 26.2 page templates, including modal dialog, drawer and login |
| Regions | Static content, classic report (generic and named-column templates), interactive report (search, link column, saved-report column order, pagination), form, cards, list, breadcrumb, sub-regions |
| Items | Text, number, password, textarea, date, select list, radio/checkbox group, checkbox, switch, display only, hidden, file; shared, SQL and static LOVs; defaults |
| Buttons | Submit with request and confirmation, redirect, hot/template options, region and page slots |
| Processing | Form initialization, automatic row processing (insert/update/delete), close dialog, clear session state, branches, success messages, required/length/numeric item validation and simple validation types |
| Dynamic actions | Client events and conditions; execute JavaScript, refresh, show/hide, enable/disable, set value, clear, focus, CSS classes, alert/confirm, submit, dialog close/cancel |
| PL/SQL | Only bodies consisting of plain `insert`/`update`/`delete`/`merge` statements run, in processes and in Execute Server-side Code |

## Not simulated

General PL/SQL and packages, APEX dictionary views (`APEX_*`), collections, authentication and authorization schemes (every page is accessible; any login succeeds and sets `APP_USER`), session state protection, interactive grid editing (rendered read-only), Oracle JET charts (drawn as simple bars), faceted search, calendar, maps and plug-in regions (dashed placeholders), REST sources, translations and plug-in Ajax calls. These appear as diagnostics instead of silent omissions.

## Verification boundary

Repository tests use a synthetic theme export and a generated zip. The real 26.2 distribution was exercised manually against the three public Oracle example applications; that is local evidence only. Confirm final behavior with the Oracle compiler, an authorized import and browser verification on DEV/QA/TEST.
