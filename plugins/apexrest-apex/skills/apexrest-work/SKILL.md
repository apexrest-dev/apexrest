---
name: apexrest-work
description: "Create or change Oracle APEX applications: references, APEXlang, compiler validation, DEV/QA/TEST import and requested browser checks. Excludes Salesforce Apex."
---

# APEX work

Use the current host session (Codex or Claude Code). `project` is the absolute directory with `apexrest.json`.

1. New app: `apexrest_project action:init` with `directory` and `template` (`blank-app` or `customer-crm`). Existing app: `action:inspect`; `apexrest_apex_sync action:status` reads the working copy; `action:changes` lists server edits. Tools resolve SQLcl and connections: no shell checks; `apexrest_metadata_read` gives columns, `runtime-errors`, `page-timings`.
2. At most 3 lookups. `apexrest_reference mode:select` once with `project` and a short UI-only `request` naming every component by its APEX name (regions, page items, buttons, processes, list/breadcrumb entries). On 26.2 adapt each component's `example` (working Oracle block), `pageExamples` (whole pages) and `skeleton` outlines. `mode:search`/`mode:read` only for gaps. Never read plugin files or sources from disk. See [apexlang](../apexrest-apexlang/SKILL.md).
3. Edit `.apx` files, preserving Oracle metadata/IDs and security. Include changed dependencies, no placeholders. Enum values come from the select result or a diagnostic's `validValues`, never display labels or guesses. Each page process needs its own `advanced { executionMappingIdentifier: <unique 20-digit number> }`.
4. Optional: `apexrest_preview action:check` renders every page; `env` runs SQL/PL/SQL in that DEV/QA/TEST database, rolled back. Fix its findings on changed pages before shipping. `notAppliedLocally` lists skipped init JavaScript: check it in APEX.
5. Run `apexrest_apex_validate` once on new pages, apply every `Fix:` hint (no lookups), then ship without revalidating: one `apexrest_ship mode:apply` compiles, plans, grants, imports, verifies. Passing results still carry advisory findings (validate `staticAnalysis` CodeScan, preview check): on pages the task created or changed, fix security ones (authorization, session state protection, escaping, duplicate submission); fix the rest or report why not. Never change authentication or other pages.
6. Review when needed: `mode:plan` with `env` and `userRequest` (literal human instruction). Production is forbidden. Remote dangerous changes need exact-plan confirmation ([safety](../apexrest-safety/SKILL.md)); local targets do not.
7. Smallest scope: `importMode:auto` picks changed 26.2 pages/shared files; `files` binds listed paths; `full` covers global metadata or DB changes; `none` runs DB scripts only. Resolve same-component conflicts; never widen scope to hide one. Separate machines/homes: serialize externally.
   7a. Peer review: if `peerReview.mode` is set or the user asks, follow [peer review](references/peer-review.md) after `mode:plan`.
8. The task authorizes its import on the identified DEV/QA/TEST target; do not ask again. Wait (`waitSeconds` default 25); if running, `apexrest_job action:status` with the job ID. Never restart ship to fetch results.
9. Failed ship: follow its diagnostic. `mode:recover` takes `data.deploymentRunId` from the failed result, not its `runId` or a job ID.
10. Browser check only on request: `apexrest_browser_open` for `env`, then the host browser. Never expose secrets or cookies. Report compiler, import and browser results separately.

Unknown outcomes: [safety](../apexrest-safety/SKILL.md). Connections/tools: [setup](../apexrest-setup/SKILL.md). Upgrades: [upgrade](references/upgrade.md).
