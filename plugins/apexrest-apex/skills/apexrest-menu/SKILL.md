---
name: apexrest-menu
description: Show the APEXREST plugin menu and route the selected command or capability.
---

# All functions

Show these choices and load only the selected workflow. Opening the menu is navigation, not permission to install, deploy or run every function.

| Choice                                                                         | Workflow                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Implement APEX changes in this chat                                            | [Work](../apexrest-work/SKILL.md)                         |
| Open the development panel inside Codex                                        | [Panel](../apexrest-panel/SKILL.md)                       |
| Install/preview Node.js, Java, SQLcl, Playwright and Chromium                  | [Dependencies](../apexrest-install-dependencies/SKILL.md) |
| Diagnose tools, configure SQLcl CLI/MCP or connections, inspect installation   | [Setup](../apexrest-setup/SKILL.md)                       |
| Initialize/adopt/sync a project; inspect local source state                    | [Projects](../apexrest-project/SKILL.md)                  |
| Generate/edit/export/validate/compare APEXlang; pinned Oracle references       | [APEXlang](../apexrest-apexlang/SKILL.md)                 |
| Find and adapt a bundled component or UX pattern recipe                       | [APEXlang](../apexrest-apexlang/SKILL.md)                 |
| Add/update catalog patterns from an identified APEX application               | [Pattern catalog](../apexrest-pattern-catalog/SKILL.md)   |
| Metadata, migrations and PL/SQL                                                | [Database](../apexrest-database/SKILL.md)                 |
| Plan/apply authorized changes, deployment status and restore plans             | [Deployment](../apexrest-deploy/SKILL.md)                 |
| SQL/API/browser suites, interactive authentication and selected-browser checks | [Tests](../apexrest-test/SKILL.md)                        |
| Diagnose failures, inspect/cancel jobs and read registered artifacts           | [Debug](../apexrest-debug/SKILL.md)                       |
| Review preservation, security, deployment and release evidence                 | [Review](../apexrest-review/SKILL.md)                     |

Prefer purpose-built MCP tools; pass the user's absolute application directory as `project`. For CLI-only actions, resolve `../../runtime/apexrest.mjs` from this skill to an absolute path and invoke with Node; native installation does not add `apexrest` to PATH. Read only the selected command's `--help`. For the complete command inventory, read [CLI catalog](references/cli-catalog.md).

Menu selection supplies no missing target identity, Oracle license acceptance or production approval. Preserve named local connection references, source, backup/drift/coordination and unknown-outcome protections. Never request passwords in chat. Distinguish fixtures, native discovery, Oracle results and browser observations.

For application composition from reusable executable blocks, route to `apexrest-compose`.
