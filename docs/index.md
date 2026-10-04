# Documentation

![APEXREST pencil and ruler symbol](assets/apexrest-logo.svg)

APEXREST is a plugin for Codex and Claude Code that builds, ships and verifies Oracle APEX applications: five skills, eleven MCP tools and the `apexrest` CLI over one runtime that runs Oracle SQLcl. The published packages are `apexrest@1.2.0` (npm `latest`) and `apexrest@1.3.0-beta.1` (npm `beta`), which still carry the previous 21-tool surface; the redesigned surface described here is implemented in the source repository and verified locally only. [Implementation status](implementation-status.md) and [next actions](next-actions.md) track the remaining checks.

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
| Read the read-only development status snapshot                 | [Development status](panel.md)                    |
| Deploy without service tables                                  | [Clean APEX deployment](clean-apex-deployment.md) |
| Select the checks appropriate to a change, verify in a browser | [Testing](testing.md)                             |
| Resolve setup, compiler, ship or job failures                  | [Troubleshooting](troubleshooting.md)             |
| Compose source from experimental blocks (CLI only)             | [Composer](composer.md)                           |

## Understand and extend

- [Architecture](architecture.md): packages, the persistent SQLcl engine, jobs and durable state.
- [Host integration](codex-integration.md): Codex and Claude Code manifests, ownership and verification scope.
- [Programmatic automation](codex-automation.md): what each tool executes without a model.
- [Optimization review](optimization-review.md) and [APEXlang optimization](apexlang-optimization.md): historical measurements.
- [Contributing](../CONTRIBUTING.md): local workflow, validation and review requirements.
- [Security and privacy](../SECURITY.md): credentials, code trust, reports and recovery.
- [Research](research.md): reviewed upstream material and compatibility decisions.
- [Architecture decisions](adr/): the rationale for supported implementation choices.

## Inspect the evidence

- [Implementation status](implementation-status.md): what exists and what was actually exercised.
- [Acceptance matrix](acceptance.json): implementation, verification, evidence and blockers for each requirement.
- [Next actions](next-actions.md): open gates and follow-up phases.
- [Changelog](../CHANGELOG.md) and [release notes](release-notes.md): changes, breaking changes and distribution.

Historical reports retain their original source digest and scope. A later success does not relabel an earlier blocked run, and an earlier blocked run does not erase a separately recorded later result.

## Prepare a release

Read [publisher setup](publishing.md) and [release notes](release-notes.md). A source-repository installation and a published, signed stable release are different distribution states. Local packaging never publishes, tags or provisions infrastructure.
