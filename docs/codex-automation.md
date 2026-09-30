# Programmatic automation for Codex

English | [Українська](codex-automation.uk.md)

The plugin targets Codex desktop and CLI. Its [19 MCP handlers](../packages/core/src/operations.ts) execute ordinary program code; mechanical compilation, metadata reads, tests and deployment steps need no model. Codex supplies task understanding, source changes and assessment in the current conversation.

## What runs without AI

Names below omit the `apexrest_` MCP prefix. Programmatic execution still requires appropriate authorization for writes.

| Tools                                           | Programmatic responsibility                                                                      | What Codex contributes                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `doctor`, `project_inspect`                     | Inspect capabilities and configured project; optionally hash sources                             | Interpret missing prerequisites and select relevant context               |
| `metadata_read`                                 | Validate scope, verify target, execute allowlisted paginated queries                             | Select objects and interpret their business meaning                       |
| `reference_search`, `reference_read`            | Rank, cache, paginate and retrieve pinned references                                             | Select applicable syntax and resolve design choices                       |
| `apex_generate`, `apex_export`, `apex_validate` | Run Oracle generation, staged export and compiler validation                                     | Specify the application and repair source based on diagnostics            |
| `deploy_plan`, `deploy_apply`                   | Create immutable plans; enforce identity, authorization, backup, drift, lease and outcome checks | Explain the proposed change and act within existing user authorization    |
| `test_run`                                      | Execute configured suites and collect actual evidence                                            | Choose relevant checks, author assertions and assess coverage             |
| `job_status`, `job_cancel`, `artifact_read`     | Wait, track cancellation and read bounded sanitized artifacts                                    | Interpret the result; reconcile an unknown outcome before retrying writes |
| `browser_open`                                  | Resolve the configured URL and browser handoff                                                   | Use available Codex browser controls and assess visible behavior          |
| `panel_open`, `panel_status`, `panel_action`    | Serve local UI, aggregate state and dispatch validated actions                                   | Select the relevant Oracle/APEX action or settings change                 |

None of these handlers needs another model merely to format a report, poll a worker, enumerate files or look up an exact reference. Domain interpretation, application design, nontrivial edits and substantive review still require Codex reasoning. Passing deterministic gates does not establish that an application meets the user's needs.

## Implemented reductions in model round trips

- Six long MCP tools (`apex_generate`, `apex_export`, `apex_validate`, `deploy_plan`, `deploy_apply`, `test_run`) start a job once and wait inside the same call. `waitSeconds` accepts 0–30 and defaults to 25. Completion returns the existing job and its nested result, with the actual outcome also exposed in outer `ok`, `status`, `exitCode` and MCP `isError`; timeout returns the same `jobId` for `job_status`. Use 0 for immediate acknowledgement. Cancelling the MCP wait does not cancel the underlying job; explicit job cancellation retains existing safeguards.
- `metadata_read` accepts either its existing single request or `requests` containing 1–8 requests. Every request is validated before SQL; the batch verifies the target once, then executes scoped queries sequentially. Each query retains pagination and untrusted-content marking. Invalid batches do not become partial successes.
- `project_inspect` accepts `detail: "summary"` for project paths and environment settings; full inspection remains the default. The summary reads no application sources and makes no Oracle call. Configured target values are not verified target identity.
- Bounded MCP output preserves actionable nested failure diagnostics, artifact identifiers and deployment-plan safety details, with the complete sanitized result available through the artifact reader.

## Current evidence and scope

[Historical 1.0.0 evidence](evidence/current-session-100-local.json) records its tool catalog and validation; [1.1.0 catalog evidence](evidence/component-catalog-local.json) records the new component corpus. The [earlier automation measurement](evidence/codex-automation-runtime.json) retains its original version: a synthetic 50-file project summary used 659 UTF-8 bytes versus 4,494 for full inspection. It is historical response-size evidence, not current host token accounting.

Work starts directly in the Codex conversation without a plugin registration call. Retrieve only relevant skills/references, reuse summaries and existing job IDs, and open the panel when useful. Codex owns models and collaboration. APEXREST owns recoverable operation state, with no duplicate conversational context.

These changes preserve authorization, target identity, backup, drift, coordination, required suites and unknown-outcome recovery. Local call-count and UTF-8 measurements do not establish native end-to-end latency, billed-token savings or live Oracle correctness. Those require separately recorded matched host tasks and authorized connected checks.
