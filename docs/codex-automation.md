# Programmatic automation for the agent surface

The plugin targets Codex (desktop and CLI) and Claude Code with the same skills and the same MCP tools. Its [11 MCP tools](../packages/core/src/operations.ts) execute ordinary program code; mechanical compilation, metadata reads, planning, backups, imports, tests and status need no model. The host model supplies task understanding, source changes and assessment in the current conversation.

## What runs without AI

Names below omit the `apexrest_` MCP prefix. Programmatic execution still requires appropriate authorization for writes.

| Tool                   | Programmatic responsibility                                                                                                                                         | What the model contributes                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `project`              | `init` scaffolds a project and generates the starter application with the Oracle generator; `adopt`, `inspect`, `connection_add/list/test` manage identity          | Choose template, alias and target; ask only for missing non-secret values |
| `reference`            | Rank, cache, paginate and read pinned Oracle references, component and pattern recipes (offline)                                                                    | Select applicable syntax and resolve design choices                       |
| `metadata_read`        | Validate scope, verify target, execute allowlisted paginated queries                                                                                                | Select objects and interpret their business meaning                       |
| `apex_validate`        | Run the Oracle compiler in-process on a staging copy and return structured `diagnostics[]` (code, file, line, column, type, hint, validValues)                      | Repair the named file and line                                            |
| `ship`                 | Validate, resolve `auto`/`files`/`full` import scope, create an immutable plan, record a plan-bound grant, back up, import, verify, run required suites and remove the grant | Review selected files, fallback reasons, target and risks; assess completion |
| `apex_sync`            | Establish and manage an existing application's trusted local checkpoint (init, status, refresh, invalidate)                                                        | Select the target and reconcile changes requiring explicit refresh         |
| `test_run`             | Execute configured suites and collect evidence                                                                                                                      | Choose relevant checks, author assertions and assess coverage             |
| `browser_open`         | Resolve the configured URL and browser handoff                                                                                                                      | Use the host browser controls and assess visible behavior                 |
| `job`, `artifact_read` | Wait with `phase` reporting, cancel, and read bounded sanitized artifacts                                                                                           | Interpret the result; reconcile an unknown outcome before retrying writes |
| `status`               | `doctor` probes local tools; `project` aggregates settings, connections, sync, jobs, deployments and grants                                                         | Interpret missing prerequisites                                           |

The CLI keeps its granular commands (`project init|adopt|inspect`, `connection ...`, `apex validate|export|sync|diff`, `deploy plan|apply|status|restore-plan`, `compose ...`, `test ...`, `jobs status|cancel`, `panel status`, plus `ship` and `status`). Composer and `apex export/generate` are CLI-only.

## Partial imports through the agent surface

The source checkout supports [APEX 26.2 partial imports](apex-26.2.md) through the same `apexrest_ship` MCP tool used by Codex and Claude Code, and through the CLI. APEX 26.1 sources use full imports. Direct SQLcl CLI transport is required inside the runtime, with the reviewed SQLcl `26.3.0.260.1620` / MMD `26.2.0+3479` tuple and a compatible 26.2 target. This does not prevent the host from calling APEXREST over MCP.

For an existing dev/test application, initialize a trusted checkpoint with `apexrest_apex_sync` `action: "init"`, edit a page and its shared LOV, then pass one of these selections to both the plan and apply calls:

| `apexrest_ship` inputs | Behavior |
| --- | --- |
| `importMode: "auto"` | Default; select eligible local changes or explain why a full plan is needed. |
| `importMode: "files", files: ["pages/p00001-home.apx", "shared-components/lovs/status.apx"]` | Import only the selected eligible files; retain other local work. Paths are relative to the application source directory. |
| `importMode: "full"` | Plan a complete application import. |

The model reviews `importSelection.requestedMode`, `resolvedMode`, `files`, `dependencies` and `reasons`; the saved plan holds the complete lists if the preview is truncated. The program compares checkpoint/local/fresh-server inventories, preserves remote-only edits and blocks unequal edits to the same component before fallback. It validates the effective tree, so selected pages must have their required components on the server or included explicitly. `files` never adds dependencies or becomes `full`; observed remote changes must be reconciled before an automatic full fallback. Partial apply takes a fresh full SQL backup, verifies a complete server export and advances to that actual server checkpoint while leaving unselected local edits dirty. Browser verification remains a separate host action. See [deployment safeguards](deployment-safety.md#apex-262-partial-imports).

## Round trips

A typical work cycle uses the following operations; actual calls depend on the change and required repairs:

| Task                     | Calls                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Edit an existing page    | `project inspect` → ≤3 `reference` → edit files → `apex_validate` (×1–2) → `ship plan` → `ship apply` → `browser_open` = 8–10 |
| Create a new application | `project init` → ≤3 `reference` → edit files → `apex_validate` (×1–2) → `ship plan` → `ship apply` → `browser_open` = 8–10    |

Reference files load on demand. Validation repairs, authorization requirements and browser observations can add steps.

## Implemented reductions

- `apex_validate` runs in-process (no job, no polling) and returns up to 50 structured diagnostics without truncation; a compacted result keeps the first five complete. Domain faults carry `nextActions` (for example `VALIDATION_FAILED`, `SOURCE_DRIFT`, `DEPLOY_APPROVAL_REQUIRED`, `PROJECT_TRUST_REQUIRED`).
- `ship` folds validate, plan, grant, apply, verify and tests into one call. `mode:plan` runs in-process; `mode:apply` validates and plans in-process, then runs the apply phase in a detached worker so a database write survives host termination, waiting up to `waitSeconds` (default 25, maximum 120). Job status carries `phase` (`validating`, `planning`, `backing_up`, `migrating`, `importing`, `verifying`, `testing`).
- Jobs for `apex_sync` and local `test_run` suites run inside the MCP process (same `state.json` and heartbeat, so `job` observes them identically) and reuse one `OracleAdapter` per managed-home settings digest, keeping the SQLcl session pool and capability cache warm. Remote test suites and the ship apply phase keep the detached worker.
- `metadata_read` accepts `requests` containing 1–8 scoped requests; `project inspect` defaults to `detail: "summary"`.
- Tool annotations: `destructiveHint` only for `ship` and `job`; `readOnlyHint`/`idempotentHint` for `reference`, `apex_validate`, `metadata_read`, `artifact_read` and `status`; `openWorldHint` only for tools that can reach the database, a browser or the network.

## Authorization recorded by ship

An explicit user request to create, update or import an identified development/test application authorizes that import. `ship apply` requires `userRequest` (the user's literal instruction) and records it in the user policy as a grant bound to the canonical project root, target digest and plan digest, deploy only, expiring with the plan and marked `grantedBy: "ship"`. The grant is removed after the attempt whether it succeeded or failed; a removal failure is reported in `grant.removed`. Production targets (`kind: production` or listed in the administrator-owned production trust file) and plans with unreviewed risks are refused before any grant is written. Trust, backup, identity, drift, coordination and unknown-outcome protections are unchanged.
