---
name: apexrest-work
description: 'Create or change Oracle APEX applications: references, APEXlang, compiler validation, DEV/QA/TEST import and requested browser checks. Excludes Salesforce Apex.'
---

# APEX work

Use the current host session (Codex or Claude Code). `project` is the absolute directory with `apexrest.json`; `env` is its configured key, not the workspace.

1. New app: `apexrest_project action:init`, `directory`, `template` (`blank-app` or `customer-crm`). Existing app: `action:inspect`; sync `action:status` reads local state, `action:changes` server edits. `apexrest_metadata_read` gives columns, `runtime-errors`, `page-timings`.
2. Native 26.1/26.2 reports, cards, charts, calendars and forms use [scaffold](references/scaffold.md): write one compact JSON spec and call `apexrest_project action:scaffold`. With Decisions enabled or custom components, use one `apexrest_reference mode:select` naming the UI components. Reuse its contracts for repairs; read/search gaps only, at most 3 lookups per change. Reads: 8192 chars; follow `nextOffset`. Supply business SQL/PLSQL. Never read plugin implementation. See [apexlang](../apexrest-apexlang/SKILL.md).
3. Titles, labels, headings, formats, sequence, report SQL/columns: `action:context`, then [patch](references/patch.md). Repair exact diagnostics and dependencies; preserve Oracle metadata/IDs, security and unrelated source. Use enums from selection/diagnostics. Page processes need distinct numeric `advanced.executionMappingIdentifier`; scaffold allocates it. No placeholders.
4. Preview: `apexrest_preview action:check` renders every page (`env`: DEV/QA/TEST PL/SQL, rolled back); fix changed-page findings; `notAppliedLocally`: skipped init JS. `action:comments`: browser comments (`file:line`, `context` for `patch`); then `action:resolve` `ids`, `note`.
5. Ship once with `apexrest_ship mode:apply`: it compiles, plans, grants, imports and verifies. Use `apexrest_apex_validate` only for diagnostics. Apply every `Fix:` hint without new lookups. Advisory findings: on changed pages fix security ones (authorization, session state protection, escaping, duplicate submission); fix or explain others; skip `knownFalsePositive`. Never change authentication/other pages.
6. For review: `mode:plan` with `env` and `userRequest` (literal instruction). Production is forbidden. Remote dangerous changes need exact-plan confirmation ([safety](../apexrest-safety/SKILL.md)); local targets do not.
7. Smallest scope: `importMode:auto` picks changed 26.2 pages/shared files; `files` binds listed paths; `full` covers global metadata or DB changes; `none` runs DB scripts only. Resolve same-component conflicts; never widen scope to hide one. Separate machines/homes: serialize externally.
   7a. Peer review: if `peerReview.mode` is set or the user asks, follow [peer review](references/peer-review.md) after `mode:plan`.
8. The task authorizes its import on the identified DEV/QA/TEST target; do not ask again. Wait (`waitSeconds` 25); if running, `apexrest_job action:status` with the job ID; never restart ship.
9. Failed ship: follow its diagnostic. `mode:recover` takes `data.deploymentRunId` from the failed result, not `runId`/job ID.
10. Browser check only on request: `apexrest_browser_open` for `env`, then the host browser. Never expose secrets or cookies. Report compiler, import and browser results separately.

Unknown outcomes: [safety](../apexrest-safety/SKILL.md). Connections/tools: [setup](../apexrest-setup/SKILL.md). Upgrades: [upgrade](references/upgrade.md). Linear: [linear](references/linear.md).
