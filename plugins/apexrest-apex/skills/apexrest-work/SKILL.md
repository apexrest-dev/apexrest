---
name: apexrest-work
description: Create or change Oracle APEX applications: references, APEXlang, compiler validation, DEV/QA/TEST import and requested browser checks. Excludes Salesforce Apex.
---

# APEX work

Use the current host session (Codex or Claude Code). `project` is the absolute directory containing `apexrest.json`.

1. New app: `apexrest_project action:init` with `directory` and `template` (`blank-app` or `customer-crm`). Existing app: `action:inspect`; `apexrest_apex_sync action:status` reads local working-copy status.
2. At most 3 reference lookups per change: `apexrest_reference mode:search`, short English terms, `kind`, `limit:3`; `mode:read` the chosen ID. Contracts: [apexlang](../apexrest-apexlang/SKILL.md).
3. Edit application `.apx` files, preserving Oracle metadata/IDs and security. Include required changed dependencies; no placeholders.
4. Ordinary authorized edits use one `apexrest_ship mode:apply` call. It compiles, plans, records the grant, imports and verifies. Standalone `apexrest_apex_validate` is for editing diagnostics; omit duplicate validate/plan calls. Fix compiler errors before import.
5. When review is needed, use `mode:plan`, `env` and `userRequest` (literal human instruction). Review target, selection, risks and database operations. Production is forbidden. Remote dangerous changes require exact-plan confirmation through [safety](../apexrest-safety/SKILL.md); actual local targets need no separate risk prompt.
6. Choose the smallest sufficient scope. `importMode:auto` selects changed 26.2 pages/shared files; `files` binds literal application-relative paths; `full` covers global metadata, unsupported mappings or database changes. Pages use native partial export. Shared files bind a full APEXlang observation; backups/readback retain selected files only. New pages need a collision check, not an export of absent source. Dependency context is local; unselected server freshness is not proved. Resolve same-component conflicts; never widen to hide a conflict. Shared managed-home runners are serialized; independent machines/homes need external serialization.
7. Apply with the same request on the identified DEV/QA/TEST target. The task authorizes its necessary import; do not ask again. The runtime creates and removes an exact-plan grant. Wait for completion (`waitSeconds` default 25); if running, use `apexrest_job action:status` with returned job ID. Never restart ship to fetch results.
8. If browser verification was requested, use `apexrest_browser_open` for `env`, then built-in or selected browser controls. Inspect requested rendering/actions. Ignored local ENV login data may be used; never expose secrets or capture cookies/profiles. No application suites or browser installation. Report compiler, import and actual browser results separately.

Unknown/failed outcomes: [safety](../apexrest-safety/SKILL.md). Connections/tools: [setup](../apexrest-setup/SKILL.md).
