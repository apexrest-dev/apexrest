---
name: apexrest-work
description: Create or change Oracle APEX applications: references, APEXlang, compiler validation, DEV/QA/TEST import and requested browser checks. Excludes Salesforce Apex.
---

# APEX work

Work in the current host session (Codex or Claude Code). Every project-scoped tool takes `project`: the absolute directory containing `apexrest.json`, never the plugin directory.

1. Project. New app: `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`); it generates Oracle sources. Existing app: `action:inspect` (summary) for source directories and environments; `apexrest_apex_sync` `action:status` shows a working copy.
2. References, at most 3 lookups per change: `apexrest_reference` `mode:search` with short English terms, `kind` and `limit:3`, then `mode:read` the chosen ID. Routes and contracts: [apexlang](../apexrest-apexlang/SKILL.md).
3. Edit `.apx` files under the application source directory. Keep `.apex/apexlang.json`, Oracle IDs, authentication and authorization. Edit related components together; never leave placeholders.
4. `apexrest_apex_validate` until `diagnostics` is empty: fix the named file and line, rerun. Never ship with errors.
5. `apexrest_ship` `mode:plan` with `env` and `userRequest` (the user's literal instruction). Review `risks`, `databaseReview`, `sources`, `target` and `importSelection`. Production deployment is forbidden. For actual remote dangerous DB changes, use [safety](../apexrest-safety/SKILL.md) for exact-plan human confirmation; actual local targets need no separate risk prompt. `importMode:auto` selects eligible 26.2 pages/shared components using the saved baseline, local edits and a fresh server export. `files` requires an exact application-relative `files` list; `full` requests the whole app. Resolve conflicts; preserve the reviewed selection.
6. `apexrest_ship` `mode:apply` with the same `userRequest` when the user asked for the change in that DEV/QA/TEST environment. The identified application task is the authorization; do not ask again. The runtime records a grant bound to this plan and removes it afterwards. Wait for the result (`waitSeconds` default 25); if still running, `apexrest_job` `action:status` with the returned `jobId`. Never rerun ship to fetch results.
7. When the user requested browser verification, call `apexrest_browser_open` for `env` and open its URL with the built-in or user-selected browser controls. Check the requested rendering/navigation/interactions. Login may use ignored/untracked local ENV data; never expose secrets or capture cookies/profiles. No application suites or browser installation. Ordinary server deployment success requires no browser step.
8. Report files changed, validation result, ship status and runId, server completion and any requested browser observations/limitations.

Blocked, failed or unknown outcomes: [safety](../apexrest-safety/SKILL.md). Missing tools or connections: [setup](../apexrest-setup/SKILL.md).
