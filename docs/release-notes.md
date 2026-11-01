# Current release notes

## Source bundle 2.5.0

The repository bundle supports Codex and Claude Code with six skills and twelve MCP tools. It includes APEX 26.1 full imports and [APEX 26.2 partial imports](apex-26.2.md), pinned release profiles, advisory scanner/upgrade diagnostics and read-only capability checks. Use the repository installation for this source version; registry packages are a separate distribution path.

Application verification uses the host in-app browser. The bundle has no automated application test runners, saved browser-authentication state or browser installation. Client dependencies are Node.js, Java and SQLcl. Compiler, target, backup, drift and readback protections remain in the deployment path. Full imports can end the interactive session; sign in again in the host browser when needed.

## Changes in 2.5.0

- Add [cross-vendor peer review](configuration.md#cross-vendor-peer-review): `apexrest_peer_review` / `apexrest peer review` asks the other agent CLI (Codex from Claude Code, Claude Code from Codex) for a read-only review of a saved ship plan under the user's own sign-in. The verdict is bound to the plan digest; optional `peerReview.mode` `advisory` reports it at apply and `required` blocks apply without an approving review. Without a plan it reviews the local sources instead, for local-only work with no Oracle target; that source-bound verdict is advisory and never unlocks `required` apply. The MCP catalog grows to twelve tools; its byte budget rises to 14,700 bytes.
- The [local preview](local-preview.md) follows Oracle semantics more closely: NULL for empty items, real division and Oracle number text, date arithmetic, ANSI date literals and `DEFAULT sysdate` in seed scripts, JSON functions, nested LISTAGG, POSIX regular expressions and ISO dates in form DML.
- Page submits, server-side code and grid saves are transactional; an unhandled process error is shown to the user and rolls back the page's DML. Interactive grid row validations mark failing cells, validation messages substitute labels, forms detect lost updates and region refreshes submit their page items.
- APEX 26.2 syntax for show-all pagination, card actions, `&COLUMN.` substitution, list views and calendar views is rendered; template components apply format masks; chart ticks no longer show spurious decimals.
- Items and layout match APEX more closely (switches, floating labels, grid offsets, native date pickers, static button IDs, region display selector, maps). The preview warns about unknown APEXlang property names and values.
- The README now presents APEXREST as a Codex and Claude Code plugin with three feature videos, including a new tour of a 22-page showcase application running in the preview.
- Align package, workspace and Codex/Claude Code source versions to 2.5.0. Registry distribution and full native/Oracle qualification remain separate outcomes.

## Changes in 2.4.0

- Add the [local preview](local-preview.md): `apexrest preview` and `apexrest_preview` run APEXlang sources on Node.js without an Oracle database for fast design iteration. Pages render with Universal Theme 26.2 templates and JavaScript extracted once from the official distribution.
- Cover most APEX UI/UX locally: interactive reports and editable interactive grids saved to SQLite, faceted search and smart filters on Oracle's own widget, cards and list views, Universal Theme template components with full template directives, tabs, carousel, region display selector and inline dialogs, SVG charts, FullCalendar calendars, offline maps, genuine page item widgets, a PL/SQL subset interpreter wired into processes, validations, conditions, computations and dynamic actions, and a theme-style picker. Each area is a registered feature module.
- Extend the preview with interactive report Actions-menu views, saved reports and .xlsx downloads, more interactive grid editors, tree and search regions, wizard and legacy features, file uploads, BLOBs and data loading, `apex_collection`, APEX dictionary views generated from the source, a local e-mail outbox, REST data from JSON fixtures, and a developer toolbar with session state, debug log, "view as" roles and tablet/phone viewports.
- Serve the APEX submit protocol, inline validation messages, modal dialogs, reports, forms, cards, lists and simple dynamic actions against SQLite, with Oracle SQL shims, `.apex-local/*.sql` seeding and on-demand sample tables. PL/SQL beyond plain DML, `APEX_*` views, authentication and several region types are reported as unsupported.
- The MCP catalog grows to eleven tools; its byte budget rises to 13,600 bytes. The preview is a design aid and does not replace compiler validation, an authorized import or browser verification on DEV/QA/TEST.
- Optional [OpenAI Decisions selection](component-catalog.md#optional-openai-decisions-selection) from 2.3.0 is unchanged.
- Align package, workspace and Codex/Claude Code source versions to 2.4.0. Registry distribution and full native/Oracle qualification remain separate outcomes.

## Upgrade a working copy

Working copies bind their runtime/toolchain version. Reconcile local edits and unresolved outcomes, then explicitly refresh a clean checkpoint with `apexrest apex sync --env dev --action refresh --json` and create new plans. Never edit stored runtime versions or clear unknown ownership to bypass these checks.

## Distribution and verification

Repository release and Oracle integration workflows remain disabled. The retained publisher local-evidence exception is bound to 2.2.0 and does not apply to 2.5.0. Publication requires its applicable authorization and current source-bound gates. CI runs on pushes to `main` only. Local packaging does not publish npm, create a Git tag or deploy a website.

See [implementation status](implementation-status.md), [acceptance](acceptance.json), [open checks](next-actions.md) and [publishing](publishing.md). Fixtures and offline compilation do not establish connected Oracle, authenticated application browsing or native model-host execution.
