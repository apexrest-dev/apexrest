# Codex integration

English | [Українська](codex-integration.uk.md)

APEXREST targets Codex desktop and CLI. Beta 1.3.0-beta.1 contains 14 focused skills and 21 bounded MCP tools, including the experimental [Composer](composer.md) skill; stable 1.2.0 contains 13 skills and 18 MCP tools, including the [pattern-catalog skill](pattern-catalog.md). See [release notes](release-notes.md) for publication status. Codex executes the user's task in the open conversation; APEXREST supplies deterministic Oracle/APEX operations through local stdio MCP and the equivalent CLI.

## Ownership

- Codex owns the conversation, model, permissions and any native collaboration.
- APEXREST owns project configuration, pinned references, Oracle adapters, deployment policy, test execution and recoverable operation jobs.
- The optional development panel shows project/connection settings and Oracle/APEX operations. Open its private local URL in the Codex in-app browser; the verification-browser preference applies separately to application checks.

APEXREST does not start Codex model sessions, choose models or maintain a parallel conversation context. There is no plugin work-start API. Request implementation through the [current-chat skill](chat-workflow.md), and use the domain tools when an actual operation is needed.

## Host boundaries and verification

The native manifest declares skills and MCP resources. The loopback panel and its MCP UI resource are separate surfaces: a valid resource or returned URL is not proof that a host rendered it. Browser observations, installed-plugin CLI/stdio checks and live Oracle operations are recorded separately.

The [historical 1.0.0 evidence](evidence/current-session-100-local.json) retains its source checks; [1.1.0 catalog evidence](evidence/component-catalog-local.json) records the current component corpus. Older native-host reports retain their original host versions, source digests and scope; they do not verify this release's desktop rendering. See [implementation status](implementation-status.md) and [open checks](next-actions.md).

The original [build specification](../APEXREST_CODEX_PLUGIN_BUILD_SPEC.md) is preserved as historical input. It is not the current product contract; the [acceptance matrix](acceptance.json) records the current scope and superseded requirements.
