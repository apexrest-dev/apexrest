# Host integration: Codex and Claude Code

APEXREST targets Codex (desktop and CLI) and Claude Code with one bundle: six host-neutral skills and ten bounded MCP tools served by `runtime/mcp.mjs`. The host executes the user's task in the open conversation; APEXREST supplies deterministic Oracle/APEX operations through local stdio MCP and the equivalent CLI. Current host qualification requirements are listed in [next actions](next-actions.md).

## Ownership

- The host owns the conversation, model, permissions, browser controls and any native collaboration.
- APEXREST owns project configuration, pinned references and catalogs, Oracle adapters and the pooled SQLcl engine, deployment policy, browser handoff, recoverable jobs and the read-only status snapshot.

APEXREST does not start model sessions, choose models or maintain a parallel conversation context. There is no plugin work-start API, panel application, HTTP server or MCP UI resource. Request implementation through the [work skill](chat-workflow.md) and use the domain tools when an actual operation is needed.

## Manifests

| Host        | Manifest in the bundle                                     | Marketplace                                         | Install                                                                                          |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Codex       | `.codex-plugin/plugin.json` (`apexrest-apex`), `.mcp.json` | `.agents/plugins/marketplace.json`                  | `codex plugin marketplace add apexrest-dev/apexrest`; `codex plugin add apexrest-apex@apexrest`  |
| Claude Code | `.claude-plugin/plugin.json` (`apexrest`)                  | `.claude-plugin/marketplace.json` (repository root) | `claude plugin marketplace add apexrest-dev/apexrest`; `claude plugin install apexrest@apexrest` |

Both manifests point `skills` at the same `./skills/` directory and start the same MCP server: Codex with `cwd: "."` inside the plugin, Claude Code with `${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs`. Claude loads the root MCP file first and then its inline entry for the same server name, as specified in the [Claude plugin manifest reference](https://code.claude.com/docs/en/plugins-reference#mcpservers). `scripts/build-plugin.mjs` generates all four files from `plugins/metadata.json`; `npm run plugin:sync` copies them into the repository and `npm run plugin:check` detects drift. The Codex manifest's three starter prompts invoke `$apexrest-work`, `$apexrest-setup` and `$apexrest-safety`.

Managed setup also binds both manifests to the same Node executable and `APEXREST_HOME`, preserving Claude's cache-root expansion. Its content-addressed payload contains both marketplaces. Setup registers Codex only; Claude registration uses `claude plugin marketplace add <managed-marketplace>` and `claude plugin install apexrest@apexrest`. Direct source installs inherit `APEXREST_HOME` from the launching shell; select the same home when both hosts share connections, toolchains and coordination.

## One application workflow

Both hosts load the same [work skill](../plugins/apexrest-apex/skills/apexrest-work/SKILL.md) and use one `apexrest_ship mode:apply` call for an ordinary authorized edit. The runtime validates, plans, imports and verifies; standalone validate/plan calls serve diagnostics or explicit review. Pages use selected imports and selected exports. Supported shared-component files use selected imports with disclosed full APEXlang observation. Other/global changes use full imports. Backups use APEXlang; identity, scoped conflicts, coordination, plan expiry and server-first recovery remain host-neutral. Browser checks run only when requested. See [the application workflow](chat-workflow.md).

Every project-scoped tool takes the absolute project directory as `project` because the host launches the server from its plugin cache. The MCP server pools SQLcl sessions and in-process jobs for its lifetime and shuts them down when the host closes the transport.

## Host boundaries and verification

A listed plugin, a valid manifest or a returned URL is not proof that a host rendered a skill, loaded the tools or showed a page. Browser observations, installed-plugin CLI/stdio checks and live Oracle operations are recorded separately.
