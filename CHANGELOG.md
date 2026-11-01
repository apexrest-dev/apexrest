# Current changes

## 2.5.0

- Give the local preview Oracle data semantics: empty items bind as NULL, real division, Oracle number text, date arithmetic on any date expression, ANSI date literals and `DEFAULT sysdate` in seeds, `json_value`/`json_query`/`json_exists`, nested LISTAGG, POSIX regular expressions and ISO date storage for form DML.
- Run page submits, server-side code and grid saves in one transaction: unhandled process errors stop processing, are shown to the user and roll back. Add interactive grid row validations, `#LABEL#`/`#COLUMN_HEADER#` substitution, lost-update detection, region items to submit on refresh, `clearCache` lists and synchronous Cancel Event.
- Render 26.2 report and card syntax: show-all pagination, card actions, `&COLUMN.` substitution, list view features, calendar views, template directives in HTML expressions, template component format masks, FILESIZE/SINCE_SHORT masks, interactive report aliases and integer chart ticks.
- Fix switch styling, floating labels, grid column offsets and label spans, native date pickers, button static IDs, the region display selector, and map height, row assignment, styles, heat maps and info windows. Warn about unknown APEXlang properties and values; Oracle's 1,350 public sample pages produce no findings.
- Rewrite the README around the Codex and Claude Code plugin and its three feature videos, adding a tour of the local preview on a 22-page showcase application. Align package and Codex/Claude Code source versions to 2.5.0; registry publication remains a separate outcome.

## 2.4.0

- Add a database-free local APEXlang preview: `apexrest preview setup|start|check|stop|status` and the `apexrest_preview` MCP tool, bringing the catalog to eleven tools with six skills.
- Download the official APEX 26.2 distribution once, extract only its browser runtime and evaluate the Universal Theme export into templates; render pages with genuine 26.2 templates and JavaScript.
- Cover most APEX UI/UX locally through feature modules: interactive reports and grids with editing and save, faceted search and smart filters, cards, Universal Theme template components and directives, tabs/carousel/region display selector/inline dialogs, SVG charts, FullCalendar calendars, offline maps, genuine page item widgets (date picker, popup LOV, combobox, shuttle and more), a PL/SQL subset interpreter for processes, validations, conditions and computations, and a wider dynamic action runtime.
- Add interactive report Actions-menu views and saved reports, richer grid editors, tree regions with `connect by`, search regions, wizards and legacy regions, file uploads, BLOBs and data loading, `apex_collection`, generated APEX dictionary views, a local e-mail outbox, REST fixtures, and a developer toolbar with session state, debug log, view-as roles and viewport switching.
- Implement the `wwv_flow.accept` submit protocol and SQLite data with Oracle SQL shims, `.apex-local/*.sql` seeding and on-demand sample tables. Unsupported features are reported as diagnostics; the preview is not compiler, import or Oracle evidence.
- Keep the 2.3.0 optional OpenAI Decisions component selection unchanged. Align package and Codex/Claude Code source versions to 2.4.0; registry publication remains a separate outcome.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
