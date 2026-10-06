# Documentation

![APEXREST pencil and ruler symbol](assets/apexrest-logo.svg)

APEXREST is a plugin for Codex and Claude Code that builds, ships and verifies Oracle APEX applications: five skills, eleven MCP tools and the `apexrest` CLI over one runtime that runs Oracle SQLcl. The current source bundle is 2.0.0 and supports APEX 26.2 partial imports. [Implementation status](implementation-status.md) separates implemented behavior from remaining connected, host and platform qualification.

## APEX 26.2: partial imports

**Import only the changed page and supported shared components.** Choose automatic selection or an explicit file list, preserve unrelated server changes and review conflicts before applying. Full imports remain available, including the existing 26.1 workflow.

[Start the partial-import guide](apex-26.2.md) for prerequisites, matching plan/apply examples, `auto` / `files` / `full` modes and [verification requirements](implementation-status.md#verification). This source feature requires a qualified 26.2 application and a direct SQLcl CLI connection; it is available through both the APEXREST CLI and MCP tools.

## Start here

| Goal                                                           | Guide                                             |
| -------------------------------------------------------------- | ------------------------------------------------- |
| Install in Codex or Claude Code and connect a target           | [Getting started](getting-started.md)             |
| Run the CLI in a Codex Cloud container with ORDS               | [Codex Cloud](codex-cloud.md)                     |
| Implement an APEX change in the current conversation           | [Work in the current session](chat-workflow.md)   |
| Find a component, parameter contract and APEXlang recipe       | [Component catalog](component-catalog.md)         |
| Reuse a UX composition across components                       | [Pattern catalog](pattern-catalog.md)             |
| Understand the product and examples                            | [README](../README.md)                            |
| Bring an existing application into source control              | [Existing applications](existing-app.md)          |
| Configure environments, connections and policy                 | [Configuration](configuration.md)                 |
| Connect over HTTP(S) when the Oracle listener is unavailable   | [SQL through ORDS](ords.md)                       |
| Learn the plan, grant, import and recovery model               | [Deployment safety](deployment-safety.md)         |
| Read the read-only development status snapshot                 | [Development status](status.md)                    |
| Deploy without service tables                                  | [Clean APEX deployment](clean-apex-deployment.md) |
| Select the checks appropriate to a change, verify in a browser | [Testing](testing.md)                             |
| Resolve setup, compiler, ship or job failures                  | [Troubleshooting](troubleshooting.md)             |
| Compose source from experimental blocks (CLI only)             | [Composer](composer.md)                           |

## Understand and extend

- [Architecture](architecture.md): packages, the persistent SQLcl engine, jobs and durable state.
- [Host integration](codex-integration.md): Codex and Claude Code manifests, ownership and verification scope.
- [Programmatic automation](codex-automation.md): what each tool executes without a model.
- [Contributing](../CONTRIBUTING.md): local workflow, validation and review requirements.
- [Security and privacy](../SECURITY.md): credentials, code trust, reports and recovery.

## Current status

- [Implementation status](implementation-status.md): implemented capabilities and verification limits.
- [Acceptance matrix](acceptance.json): implementation, verification, evidence and blockers for each requirement.
- [Next actions](next-actions.md): open qualification and implementation work.
- [Changelog](../CHANGELOG.md) and [release notes](release-notes.md): changes, breaking changes and distribution.

## Prepare a release

Read [publisher setup](publishing.md) and [release notes](release-notes.md). A source-repository installation and a published, signed stable release are different distribution states. Local packaging never publishes, tags or provisions infrastructure.
