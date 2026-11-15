# Current release notes

## Source bundle 2.8.0

The repository bundle supports Codex and Claude Code with six skills and twelve MCP tools. It includes APEX 26.1 full imports, [APEX 26.2 partial imports and routine page generation](apex-26.2.md), pinned release profiles and guarded deployment. Use the repository installation for this source version; registry packages are a separate distribution path.

Application verification uses the host in-app browser when requested. The bundle has no automated application test runners, saved browser-authentication state or browser installation. Client dependencies are Node.js, Java and SQLcl. Compiler, target, backup, drift, coordination and readback protections remain in the deployment path.

## Changes

- Generate native 26.2 interactive reports, KPI cards, bar charts and navigation with `project scaffold`, using one bounded JSON specification. Keep Oracle metadata/security and refuse replacement of unowned or manually edited pages. See [routine page generation](apex-26.2.md#generate-routine-pages).
- Generate a private target-bound observation SQL file when an identified task requests metadata/query observations. The caller runs it manually after import; neither scaffold nor ship executes it or adds an application-test gate.
- Route supported patterns through scaffold and one guarded ship. Improve bar-chart retrieval and input handling to avoid repeated lookup and validation failures.
- Fix CLI-owned SQLcl connections whose MCP connect tool enabled JDBC auto-commit when the saved connection omitted the setting. `CONNECT -name` retains normal SQLcl transaction behavior without changing saved connection properties. Rollback and identity checks remain; explicit MCP transport retains its advertised connect tool.
- Read source inventories with bounded concurrency, plan pending database scripts when application files are unchanged, reuse the new/full-plan identity observation, and validate exact staged bytes including borrowed Oracle metadata.
- Preserve unknown-outcome classification when a descendant outlives its launcher; cancel stale output-drain timers after normal process completion.
- Align package, workspace and native plugin versions to 2.8.0.

## Measured verification

Three optimized and three classic native Codex CLI trials used the same four-page Box task, starter, schema snapshots, GPT-6.1 Sol/high and independent Oracle audit. Median time was 335.44 seconds with classic skills versus 99.39 seconds with the optimized plugin (70.4% less); reported aggregate tokens were 1,770,625 versus 274,796 (84.5% less, cached input counted once). Every final app passed the audit, preserved its metadata/security files and, for the optimized arm, used integrated shipping without failing MCP calls or manual deployment fallback.

The timed build was the optimized 2.7.0 development bundle before the version increment; 2.8.0 contains the same functional implementation. This local Linux/APEX 26.2/SQLcl 26.3 experiment has three samples per arm with unflushed caches. It does not establish a universal speed SLA, browser quality, arbitrary components, real update performance, remote targets, Windows, Claude or native marketplace discovery. See [implementation status](implementation-status.md) for evidence and limits.

## Upgrade a working copy

Working copies bind their runtime/toolchain version. Reconcile local edits and unresolved outcomes, then explicitly refresh a clean checkpoint with `apexrest apex sync --env dev --action refresh --json` and create new plans. Never edit stored runtime versions or clear unknown ownership to bypass safeguards.

## Distribution and verification

Repository release and Oracle integration workflows remain disabled. The retained publisher local-evidence exception is bound to 2.2.0 and does not apply to 2.8.0. Publication requires its applicable authorization and current source-bound gates. CI runs on pushes to `main` only. Local packaging does not publish npm, create a Git tag or deploy a website.

See [acceptance](acceptance.json), [open checks](next-actions.md) and [publishing](publishing.md). Repository fixtures remain separate from connected Oracle and native-host evidence.
