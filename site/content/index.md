# Build Oracle APEX applications with Codex or Claude Code

APEXREST brings application source, Oracle compilation, controlled imports and runtime verification into one plugin for coding agents.

**Open source · Apache-2.0 · Version {{version}}**

[APEX 26.2 partial imports](../../docs/apex-26.2.md) · [Install](install.md) · [Get started](../../docs/getting-started.md) · [Explore the source](https://github.com/apexrest-dev/apexrest)

## APEX 26.2: ship a page without re-importing the whole app

Change a page and its shared list of values, then import just those `.apx` files. **Automatic selection** finds eligible local changes; **explicit file selection** keeps the import limited to your list. A three-way comparison preserves remote-only changes and blocks conflicts, with a scoped APEXlang backup and readback around each partial import. Pages use native partial exports; shared files disclose full APEXlang observation through the same Codex and Claude Code runtime.

> **Available in the 2.0.0 source bundle.** Requires an existing development/test app, a trusted sync baseline, 26.2 sources/target and reviewed SQLcl 26.3 using a direct connection. The APEXREST CLI and MCP tool both support it; 26.1 keeps full imports.

[Get started with partial imports](../../docs/apex-26.2.md#quick-start-from-an-updated-checkout) · [Compare import modes](../../docs/apex-26.2.md#choose-an-import-mode)

Install the plugin in Codex (`codex plugin marketplace add apexrest-dev/apexrest`) or Claude Code (`claude plugin marketplace add apexrest-dev/apexrest`), let it install Java and SQLcl, connect a development target and describe the change you want. The source repository provides six skills and ten MCP tools over a persistent SQLcl engine, plus the `apexrest` CLI. Use the current source bundle for the features described here; see [release notes](../../docs/release-notes.md).

![APEXREST connects an agent to native APEX source, Oracle validation, controlled deployment and verification](../../docs/assets/overview.svg)

## Create, change and verify

| Your task              | The plugin workflow                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Start an application   | `apexrest_project` generates a blank application or CRM from native APEXlang templates.                                  |
| Change an existing app | Adopt it as a working copy, make a focused edit and validate with the real Oracle compiler (`apexrest_apex_validate`).   |
| Ship the change        | `apexrest_ship` selects `auto`, `files` or `full`, then plans, backs up, imports and verifies under the authorized plan. |
| Check the result       | `apexrest_browser_open` resolves the page; the agent verifies the changed behavior in the selected browser.              |

## Offline catalogs

The bundled [component catalog](../../docs/component-catalog.md) covers 109 Universal Theme component families with 138 compiler-checked APEXlang recipes; the [pattern catalog](../../docs/pattern-catalog.md) adds 58 reusable UX patterns with 84 recipes (69 compiler-checked, 15 explicit gaps). Both are searched with `apexrest_reference` without a database connection. Compiler readiness does not imply SQL, import or browser verification.

## Deployment boundary

Plans bind sources, toolchain and target and expire after 30 minutes. Apply re-checks identity and drift, backs up an existing application and records migration history locally; a clean APEX installation needs no service tables. Production deployment and restore are always refused by the plugin; approval or signatures cannot override the classification. Read [deployment safeguards](../../docs/deployment-safety.md).

## Verification

[Implementation status](../../docs/implementation-status.md) and the [acceptance matrix](../../docs/acceptance.json) distinguish current implementation, local checks and missing connected or host qualification. A local build does not prove a deployed application works.
