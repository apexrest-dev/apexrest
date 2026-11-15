---
name: apexrest-work
description: "Create or change Oracle APEX applications: references, APEXlang, compiler validation, DEV/QA/TEST import and requested browser checks. Excludes Salesforce Apex."
---

# APEX work

Use the current host session (Codex or Claude Code). `project` is the absolute directory with `apexrest.json`; `env` is its configured key, not the workspace.

1. New app: `apexrest_project action:init`, `directory`, `template` (`blank-app` or `customer-crm`). Existing app: `action:inspect`; sync `action:status` reads local state, `action:changes` server edits. Tools resolve SQLcl/connections; skip shell discovery. `apexrest_metadata_read` gives columns, `runtime-errors`, `page-timings`.
2. Routine 26.2 reports, KPI cards and bar charts: follow [scaffold](references/scaffold.md), write one compact JSON spec, call `apexrest_project action:scaffold`, then ship. Custom components: at most 3 lookups, starting with `apexrest_reference mode:select` and a short UI-only `request` naming every component. Adapt its `example`, `pageExamples` and `skeleton`; read/search only gaps. Read limit is 8192 characters; follow `nextOffset`. Never read plugin implementation files. See [apexlang](../apexrest-apexlang/SKILL.md).
3. Edit `.apx` preserving Oracle metadata/IDs, security and changed dependencies. Use enums from selection or diagnostics, never labels or guesses. Each page process needs its own `advanced { executionMappingIdentifier: <unique 20-digit number> }`. No placeholders.
4. Optional: `apexrest_preview action:check` renders every page; `env` runs SQL/PL/SQL in that DEV/QA/TEST database, rolled back. Fix its findings on changed pages before shipping. `notAppliedLocally` lists skipped init JavaScript: check it in APEX.
5. Ship once with `apexrest_ship mode:apply`: it compiles, plans, grants, imports and verifies. A separate validate/plan adds a round trip; use `apexrest_apex_validate` for diagnostic work before a custom change if needed. Apply every `Fix:` hint without new lookups. Passing results can carry advisory findings: on changed pages fix security ones (authorization, session state protection, escaping, duplicate submission); fix others or report why not. Never change authentication or other pages.
6. For review: `mode:plan` with `env` and `userRequest` (literal instruction). Production is forbidden. Remote dangerous changes need exact-plan confirmation ([safety](../apexrest-safety/SKILL.md)); local targets do not.
7. Smallest scope: `importMode:auto` picks changed 26.2 pages/shared files; `files` binds listed paths; `full` covers global metadata or DB changes; `none` runs DB scripts only. Resolve same-component conflicts; never widen scope to hide one. Separate machines/homes: serialize externally.
   7a. Peer review: if `peerReview.mode` is set or the user asks, follow [peer review](references/peer-review.md) after `mode:plan`.
8. The task authorizes its import on the identified DEV/QA/TEST target; do not ask again. Wait (`waitSeconds` default 25); if running, `apexrest_job action:status` with the job ID. Never restart ship to fetch results.
9. Failed ship: follow its diagnostic. `mode:recover` takes `data.deploymentRunId` from the failed result, not its `runId` or a job ID.
10. Browser check only on request: `apexrest_browser_open` for `env`, then the host browser. Never expose secrets or cookies. Report compiler, import and browser results separately.

Unknown outcomes: [safety](../apexrest-safety/SKILL.md). Connections/tools: [setup](../apexrest-setup/SKILL.md). Upgrades: [upgrade](references/upgrade.md).
