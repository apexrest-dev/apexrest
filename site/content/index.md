# Build Oracle APEX applications with Codex or Claude Code

> The repository is now `apexrest-dev/apexrest` (renamed from `apexrest-codex`; GitHub redirects the old URLs).

APEXREST brings application source, Oracle compilation, controlled imports and runtime verification into one plugin for coding agents.

**Open source · Apache-2.0 · Version {{version}}**

[Install](install.md) · [Get started](../../docs/getting-started.md) · [Explore the source](https://github.com/apexrest-dev/apexrest)

Install the plugin in Codex (`codex plugin marketplace add apexrest-dev/apexrest`) or Claude Code (`claude plugin marketplace add apexrest-dev/apexrest`), let it install Java and SQLcl, connect a development target and describe the change you want. The source repository provides five skills and eleven MCP tools over a persistent SQLcl engine, plus the `apexrest` CLI. Published packages: stable 1.3.0 (npm `latest`) with the redesigned surface and the older 1.3.0-beta.1 (npm `beta`) with the previous 21-tool, 14-skill surface; [release notes](../../docs/release-notes.md) track distribution and evidence.

![APEXREST connects an agent to native APEX source, Oracle validation, controlled deployment and verification](../../docs/assets/overview.svg)

## Create, change and verify

| Your task              | The plugin workflow                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Start an application   | `apexrest_project` generates a blank application or CRM from native APEXlang templates.                                |
| Change an existing app | Adopt it as a working copy, make a focused edit and validate with the real Oracle compiler (`apexrest_apex_validate`). |
| Ship the change        | `apexrest_ship` plans, records your explicit request as a plan-bound grant, backs up, imports and verifies.            |
| Check the result       | `apexrest_browser_open` resolves the page; the agent verifies the changed behavior in the selected browser.            |

## Offline catalogs

The bundled [component catalog](../../docs/component-catalog.md) covers 109 Universal Theme component families with 138 compiler-checked APEXlang recipes; the [pattern catalog](../../docs/pattern-catalog.md) adds 58 reusable UX patterns with 84 recipes (69 compiler-checked, 15 explicit gaps). Both are searched with `apexrest_reference` without a database connection. Compiler readiness does not imply SQL, import or browser verification.

## Deployment boundary

Plans bind sources, toolchain and target and expire after 30 minutes. Apply re-checks identity and drift, backs up an existing application and records migration history locally; a clean APEX installation needs no service tables. Production is refused by `apexrest_ship` and requires a signed external approval. Read [deployment safeguards](../../docs/deployment-safety.md).

## Evidence you can inspect

Native Codex installation and real Oracle template compilation were exercised on macOS arm64 for earlier builds; the Claude Code manifests pass `claude plugin validate --strict`. Automated local tests, compiler results, host checks and connected Oracle results are recorded separately, and the redesigned surface has not yet been exercised against a live database. Use the [support matrix](versions.md), [implementation status](../../docs/implementation-status.md) and [release process](releases.md) to assess your environment. APEXREST is independent tooling, not an official Oracle, OpenAI or Anthropic product.
