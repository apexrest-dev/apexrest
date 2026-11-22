# Documentation

![APEXREST pencil and ruler symbol](assets/apexrest-logo.svg)

APEXREST is a plugin for Codex and Claude Code that builds, runs, ships and verifies Oracle APEX applications from APEXlang source: six skills, twelve MCP tools and the `apexrest` CLI over one runtime. Pick the task you have; each row leads to one guide.

## Start here

| Goal                                                 | Guide                                           |
| ---------------------------------------------------- | ----------------------------------------------- |
| Understand the product and what it can do            | [README](../README.md), [Features](features.md) |
| Install in Codex or Claude Code and connect a target | [Getting started](getting-started.md)           |
| See what the plugin changes, in a measured story     | [Field report](apex-design-race.md)             |

## Build and change an application

| Goal                                                     | Guide                                                     |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Implement an APEX change in the current conversation     | [Work in the current session](chat-workflow.md)           |
| Bring an existing application into source control        | [Existing applications](existing-app.md)                  |
| See and click through pages without an Oracle database   | [Local preview](local-preview.md)                         |
| Find a component, parameter contract and APEXlang recipe | [Component catalog](component-catalog.md)                 |
| Reuse a UX composition across components                 | [Pattern catalog](pattern-catalog.md)                     |
| Start from a public Oracle sample page                   | [Public APEXlang templates](internet-template-sources.md) |
| Select the checks for a change, verify in a browser      | [Testing](testing.md)                                     |
| Resolve setup, compiler, ship or job failures            | [Troubleshooting](troubleshooting.md)                     |

## Run and deploy

| Goal                                                          | Guide                                             |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Import only the changed pages and components on APEX 26.2     | [APEX 26.2 partial imports](apex-26.2.md)         |
| Learn the plan, grant, import and recovery model              | [Deployment safety](deployment-safety.md)         |
| Deploy without service tables                                 | [Clean APEX deployment](clean-apex-deployment.md) |
| Configure environments, connections and policy                | [Configuration](configuration.md)                 |
| Connect over HTTP(S) when the Oracle listener is unavailable  | [SQL through ORDS](ords.md)                       |
| Run the CLI in a Codex Cloud container with ORDS              | [Codex Cloud](codex-cloud.md)                     |
| Read the read-only development status snapshot                | [Development status](status.md)                   |

## Understand and extend

- [Architecture](architecture.md): packages, the persistent SQLcl engine, jobs and durable state.
- [Host integration](codex-integration.md): Codex and Claude Code manifests, ownership and verification scope.
- [Programmatic automation](codex-automation.md): what each tool executes without a model.
- [Oracle APEXlang coverage](oracle-apexlang-coverage.md): the pinned Oracle 26.2 inventory.
- [Composer](composer.md): compose source from experimental blocks (CLI only).
- [Plugin qualification harness](plugin-qualification-harness.md): how host installations are qualified.
- [Contributing](../CONTRIBUTING.md): local workflow, validation and review requirements.
- [Security and privacy](../SECURITY.md): credentials, code trust, reports and recovery.

## Current status

- [Implementation status](implementation-status.md): implemented capabilities and verification limits.
- [Acceptance matrix](acceptance.json): implementation, verification, evidence and blockers for each requirement.
- [Next actions](next-actions.md): open qualification and implementation work.
- [Changelog](../CHANGELOG.md) and [release notes](release-notes.md): changes, breaking changes and distribution.

## Prepare a release

Read [publisher setup](publishing.md) and [release notes](release-notes.md). A source-repository installation and a published, signed stable release are different distribution states. Local packaging never publishes, tags or provisions infrastructure.
