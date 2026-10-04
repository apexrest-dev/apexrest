---
name: apexrest-work
description: Create or change an Oracle APEX application end to end - project, references, APEXlang edits, compiler validation, shipping to a dev/test environment and browser verification. Use for any APEX build or change request. Excludes Salesforce Apex.
---

# APEX work

Work in the current host session (Codex or Claude Code). Every project-scoped tool takes `project`: the absolute directory containing `apexrest.json`, never the plugin directory.

1. Project. New app: `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`); it generates real Oracle sources, no separate generate call. Existing app: `action:inspect` (summary) for source directories and environments; `apexrest_apex_sync` `action:status` shows a working copy.
2. References, at most 3 lookups per change: `apexrest_reference` `mode:search` with short English terms, `kind` and `limit:3`, then `mode:read` the chosen ID. Routes and contracts: [apexlang](../apexrest-apexlang/SKILL.md).
3. Edit `.apx` files under the application source directory. Keep `.apex/apexlang.json`, Oracle IDs, authentication and authorization. Edit related components together; never leave placeholders.
4. `apexrest_apex_validate` until `diagnostics` is empty: fix the named file and line, rerun. Never ship with errors.
5. `apexrest_ship` `mode:plan` with `env` and `userRequest` (the user's literal instruction). Review `risks`, `sources` and `target`.
6. `apexrest_ship` `mode:apply` with the same `userRequest` when the user asked for the change in that dev/test environment. That explicit request to create, update or import an identified dev/test app is the authorization: do not ask again. The runtime records a grant bound to this plan and removes it afterwards. Wait for the result (`waitSeconds` default 60); if still running, `apexrest_job` `action:status` with the returned `jobId`. Never rerun ship to fetch results.
7. Verify visibly changed pages: `apexrest_browser_open` for `env`, then open the returned URL with the selected browser's controls (`codex` host browser or `external` system browser). Check rendering, navigation and the changed interaction; opening a page is not verification.
8. Report files changed, validation result, ship status and runId, pages verified in the browser, and anything not verified with its reason.

Blocked, failed or unknown outcomes: [safety](../apexrest-safety/SKILL.md). Missing tools or connections: [setup](../apexrest-setup/SKILL.md).
