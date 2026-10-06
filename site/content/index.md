# Build Oracle APEX applications with Codex or Claude Code

> The repository is now `apexrest-dev/apexrest` (renamed from `apexrest-codex`; GitHub redirects the old URLs).

APEXREST brings application source, Oracle compilation, controlled imports and runtime verification into one plugin for coding agents.

**Open source · Apache-2.0 · Version {{version}}**

[APEX 26.2 partial imports](../../docs/apex-26.2.md) · [Install](install.md) · [Get started](../../docs/getting-started.md) · [Explore the source](https://github.com/apexrest-dev/apexrest)

## APEX 26.2: ship a page without re-importing the whole app

Change a page and its shared list of values, then import just those `.apx` files. **Automatic selection** finds eligible local changes; **explicit file selection** keeps the import limited to your list. A three-way comparison preserves remote-only changes and blocks conflicts, with a fresh SQL backup and server readback around each partial import.

Verified on local APEX 26.2: a page-plus-LOV import preserved **21 unselected files**, including a separate client's edit, and the changed page worked in the browser. [Inspect the evidence](../../docs/evidence/apex262-connected.json).

> **Available in the 2.0.0 source bundle; not yet published to npm.** Requires an existing development/test app, a trusted sync baseline, 26.2 sources/target and reviewed SQLcl 26.3 using a direct connection. The APEXREST CLI and MCP tool both support it; 26.1 keeps full imports.

[Get started with partial imports](../../docs/apex-26.2.md#quick-start-from-an-updated-checkout) · [Compare import modes](../../docs/apex-26.2.md#choose-an-import-mode)

Install the plugin in Codex (`codex plugin marketplace add apexrest-dev/apexrest`) or Claude Code (`claude plugin marketplace add apexrest-dev/apexrest`), let it install Java and SQLcl, connect a development target and describe the change you want. The source repository provides five skills and eleven MCP tools over a persistent SQLcl engine, plus the `apexrest` CLI. Published packages: stable 1.3.0 (npm `latest`) with the redesigned surface and the older 1.3.0-beta.1 (npm `beta`) with the previous 21-tool, 14-skill surface; [release notes](../../docs/release-notes.md) track distribution and evidence.

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

Plans bind sources, toolchain and target and expire after 30 minutes. Apply re-checks identity and drift, backs up an existing application and records migration history locally; a clean APEX installation needs no service tables. Production is refused by `apexrest_ship` and requires a signed external approval. Read [deployment safeguards](../../docs/deployment-safety.md).

## Evidence you can inspect

The current source has [direct SQLcl full/partial import and browser evidence](../../docs/evidence/apex262-connected.json) for an isolated local APEX 26.2 test app, plus [offline compiler checks for both releases](../../docs/evidence/apex262-compatibility-local.json). Earlier native Codex installation checks retain their original scope. A [Claude Code session](../../docs/evidence/claude-code-session-200-native.json) passed discovery, read-only calls and offline validation; current Codex sessions, Claude Code ship/browser checks and other platforms remain unqualified. Use the [support matrix](versions.md), [implementation status](../../docs/implementation-status.md) and [release process](releases.md) to assess your environment. APEXREST is independent tooling, not an official Oracle, OpenAI or Anthropic product.
