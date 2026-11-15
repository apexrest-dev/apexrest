# Build Oracle APEX applications with Codex or Claude Code

APEXREST brings application source, Oracle compilation, controlled imports and runtime verification into one plugin for coding agents.

**Open source · Apache-2.0 · Version {{version}}**

[APEX 26.2 partial imports](../../docs/apex-26.2.md) · [Install](install.md) · [Get started](../../docs/getting-started.md) · [Explore the source](https://github.com/apexrest-dev/apexrest)

## How to start

1. Install the plugin in Codex (`codex plugin marketplace add apexrest-dev/apexrest`) or Claude Code (`claude plugin marketplace add apexrest-dev/apexrest`).
2. Let it install Java and SQLcl.
3. Connect a development target.
4. Describe the change you want.

The source repository provides six skills and twelve MCP tools over a persistent SQLcl engine, plus the `apexrest` CLI. Use the current source bundle for the features described here; see [release notes](../../docs/release-notes.md).

![APEXREST connects an agent to native APEX source, Oracle validation, controlled deployment and verification](../../docs/assets/overview.svg)

## Create, change and verify

| Your task              | The plugin workflow                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Start an application   | `apexrest_project` generates a blank application or CRM from native APEXlang templates.                                  |
| Change an existing app | Adopt it as a working copy, make a focused edit and validate with the real Oracle compiler (`apexrest_apex_validate`).   |
| Ship the change        | `apexrest_ship` selects `auto`, `files` or `full`, then plans, backs up, imports and verifies under the authorized plan. |
| Preview the design     | `apexrest_preview` serves the pages locally on Node.js and SQLite, with genuine Universal Theme assets and no database.  |
| Check the result       | `apexrest_browser_open` resolves the page; the agent verifies the changed behavior in the selected browser.              |

## APEX 26.2: ship a page without re-importing the whole app

Change a page and its shared list of values, then import only those `.apx` files.

- **Automatic selection** finds eligible local changes.
- **Explicit file selection** keeps the import limited to your list.
- A three-way comparison preserves remote-only changes and blocks conflicts.
- A scoped APEXlang backup and readback surround each partial import.
- Pages use native partial exports; shared files disclose full APEXlang observation through the same Codex and Claude Code runtime.

> **Available since the 2.4.0 source bundle.** Requires an existing development/test app, a trusted sync baseline, 26.2 sources/target and reviewed SQLcl 26.3 using a direct connection. The APEXREST CLI and MCP tool both support it; 26.1 keeps full imports.

[Get started with partial imports](../../docs/apex-26.2.md#quick-start-from-an-updated-checkout) · [Compare import modes](../../docs/apex-26.2.md#choose-an-import-mode)

## Offline catalogs

Both catalogs are searched with `apexrest_reference` without a database connection.

| Catalog                                              | Contents                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Component catalog](../../docs/component-catalog.md) | 118 Universal Theme component families with 269 compiler-checked APEXlang recipes |
| [Pattern catalog](../../docs/pattern-catalog.md)     | 58 reusable UX patterns with 84 recipes (69 compiler-checked, 15 explicit gaps)   |

Compiler readiness does not imply SQL, import or browser verification.

## Deployment boundary

- Plans bind sources, toolchain and target and expire after 30 minutes.
- Apply re-checks identity and drift, backs up an existing application and records migration history locally.
- A clean APEX installation needs no service tables.
- Production deployment and restore are always refused by the plugin; approval or signatures cannot override the classification.

Read [deployment safeguards](../../docs/deployment-safety.md).

## Verification

[Implementation status](../../docs/implementation-status.md) and the [acceptance matrix](../../docs/acceptance.json) distinguish current implementation, local checks and missing connected or host qualification. A local build does not prove a deployed application works.
