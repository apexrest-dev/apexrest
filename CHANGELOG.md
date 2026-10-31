# Current changes

## 2.4.0

- Add a database-free local APEXlang preview: `apexrest preview setup|start|check|stop|status` and the `apexrest_preview` MCP tool, bringing the catalog to eleven tools with six skills.
- Download the official APEX 26.2 distribution once, extract only its browser runtime and evaluate the Universal Theme export into templates; render pages with genuine 26.2 templates and JavaScript.
- Cover most APEX UI/UX locally through feature modules: interactive reports and grids with editing and save, faceted search and smart filters, cards, Universal Theme template components and directives, tabs/carousel/region display selector/inline dialogs, SVG charts, FullCalendar calendars, offline maps, genuine page item widgets (date picker, popup LOV, combobox, shuttle and more), a PL/SQL subset interpreter for processes, validations, conditions and computations, and a wider dynamic action runtime.
- Add interactive report Actions-menu views and saved reports, richer grid editors, tree regions with `connect by`, search regions, wizards and legacy regions, file uploads, BLOBs and data loading, `apex_collection`, generated APEX dictionary views, a local e-mail outbox, REST fixtures, and a developer toolbar with session state, debug log, view-as roles and viewport switching.
- Implement the `wwv_flow.accept` submit protocol and SQLite data with Oracle SQL shims, `.apex-local/*.sql` seeding and on-demand sample tables. Unsupported features are reported as diagnostics; the preview is not compiler, import or Oracle evidence.
- Keep the 2.3.0 optional OpenAI Decisions component selection unchanged. Align package and Codex/Claude Code source versions to 2.4.0; registry publication remains a separate outcome.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
