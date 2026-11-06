---
name: apexrest-work
description: Create or change Oracle APEX applications: references, APEXlang, compiler validation, DEV/QA/TEST import and requested browser checks. Excludes Salesforce Apex.
---

# APEX work

Use the current host session (Codex or Claude Code). `project` is the absolute directory containing `apexrest.json`.

1. New app: `apexrest_project action:init` with `directory` and `template` (`blank-app` or `customer-crm`). Existing app: `action:inspect`; `apexrest_apex_sync action:status` reads the working copy. Tools resolve SQLcl and connections: no shell checks; `apexrest_metadata_read` gives columns.
2. At most 3 lookups. `apexrest_reference mode:select` once with `project` and a short UI-only `request` naming every component by its APEX name (regions, page items, buttons, processes, list/breadcrumb entries). On 26.2 each selected component has `example`, a working APEXlang block from an Oracle sample page, and `pageExamples` holds whole pages (modal form): adapt them directly. `mode:search`/`mode:read` only for gaps. Never read plugin files or sources from disk. See [apexlang](../apexrest-apexlang/SKILL.md).
3. Edit `.apx` files, preserving Oracle metadata/IDs and security. Include changed dependencies; no placeholders.
4. Optional: one `apexrest_preview action:check` renders every page (assets install on first use). With `env`, SQL and PL/SQL run in that DEV/QA/TEST database, rolled back per request.
5. Ordinary authorized edits use one `apexrest_ship mode:apply` call: it compiles, plans, grants, imports and verifies. `apexrest_apex_validate` is only for editing diagnostics; a `hint` with `Fix:` comes from the property contract: apply it without lookups. No duplicate validate/plan calls.
6. Review when needed: `mode:plan` with `env` and `userRequest` (literal human instruction). Production is forbidden. Remote dangerous changes need exact-plan confirmation ([safety](../apexrest-safety/SKILL.md)); local targets do not.
7. Smallest scope: `importMode:auto` picks changed 26.2 pages/shared files; `files` binds listed paths; `full` covers global metadata or DB changes; `none` runs DB scripts only. Resolve same-component conflicts; never widen scope to hide one. Separate machines/homes need external serialization.
   7a. Peer review: if `peerReview.mode` is set or the user asks, follow [peer review](references/peer-review.md) after `mode:plan`.
8. The task authorizes its import on the identified DEV/QA/TEST target; do not ask again. Wait for completion (`waitSeconds` default 25); if still running, `apexrest_job action:status` with the job ID. Never restart ship to fetch results.
9. Failed ship: follow its diagnostic (for `APPLICATION_ALIAS_IN_USE`, change the alias in apexrest.json and application.apx). `mode:recover` takes `data.deploymentRunId` from the failed result, not its `runId` or a job ID.
10. Browser check only on request: `apexrest_browser_open` for `env`, then the host browser. Never expose secrets or capture cookies. Report compiler, import and browser results separately.

Unknown outcomes: [safety](../apexrest-safety/SKILL.md). Connections/tools: [setup](../apexrest-setup/SKILL.md).
