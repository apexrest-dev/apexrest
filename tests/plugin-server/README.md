# APEXREST plugin tests for APEX 26.1

This is the reusable **APEX 26.1.x baseline**. [The case catalog](apex-26.1.cases.json) defines stable `A261-*` IDs, steps, expected results, authorization boundaries, metrics and mappings to [the acceptance matrix](../../docs/acceptance.json). Every acceptance criterion has at least one case; a mapping is coverage intent, not evidence that the criterion passed. Generated results and private application sources belong in ignored `docs/evidence/plugin-server/`.

APEX 26.2 uses a **separate extension catalog**, [apex-26.2.extensions.json](apex-26.2.extensions.json), with `A262-*` IDs, its own target/compiler/MMD identity and reports. Its cases are definitions; no 26.2 case is qualified by this catalog. Never count selected-file import, 26.2-specific APIs or a 26.2 scaffold as a passed 26.1 case. Criteria with 26.2 IDs map here only to release isolation, common prerequisites or refusal behavior.

## Prepare the exact target

1. Read local `test.env` as literal data. The current local file uses `sqlcl:` / `workspace:` sections with `name:` fields and `test-app:` for the application ID. It also contains browser `user:` / `password:` fields. Never source the file, echo credentials, interpolate its contents into shell commands or copy them into test reports. `test.env` must remain ignored and untracked. The SQLcl saved connection supplies database credentials; browser credentials are not needed for this harness.
2. Use `apexrest_status detail:doctor`, `apexrest_project action:connection_list saved:true`, then `action:connection_test name:<saved connection> saved:true`. Record actual database/service/schema identity. A saved connection's name is not its identity.
3. Read `APEX_WORKSPACES`, `APEX_APPLICATIONS` and `APEX_RELEASE` through that saved connection. Confirm the exact app ID, workspace, parsing schema, alias and **26.1.x** release. Use `set sqlformat json` and read-only SELECTs. Resolve workspace capitalization from Oracle; workspace names may contain a hyphen.
4. Create an empty private `existing-app` project via `apexrest_project action:init`. Add a scoped connection reference via `action:connection_add sqlclName:<saved connection>`. Populate its `test` environment from the observed identity, `kind:test` and the verified base URL. Set `toolchain.profile:26.1` and retain the pinned 26.1 lock. Do not relabel a production target or copy another application's sources.
5. Serialize this target with other agents. Preserve the shared managed home and its durable coordination/history. Empty migration/package directories are required for application-only tests. Keep the initial export, `.apex` metadata/MMD and backup; do not clean unknown journals.

The harness consumes this configured project; it does not parse credentials or silently discover a different database. For the first read-only run:

```sh
npm run build
node scripts/test-plugin-server.mjs \
  --project docs/evidence/plugin-server/project --env test \
  --initialize-baseline --samples 3 \
  --output docs/evidence/plugin-server/read-only.json
```

The harness launches the current build's real stdio MCP, tests discovery, doctor, project summary, live identity and batched/paginated metadata, schema denials, all five reference corpora, bounded reads, working-copy baseline, Oracle compiler and full-import plan, URL handoff and missing job/artifact errors. It waits on the same durable job ID. No browser is opened. `--initialize-baseline` is an explicit read-only export into local working storage; do not repeat it over local changes.

An unchanged-source application ship requires the identified test-application task and its literal authorization text:

```sh
node scripts/test-plugin-server.mjs \
  --project docs/evidence/plugin-server/project --env test --samples 3 \
  --allow-app-writes --user-request 'The actual human instruction authorizing this test application.' \
  --output docs/evidence/plugin-server/authorized-noop.json
```

This optional case applies only the adopted baseline; it does not prove changed-import behavior. Execute changed full imports, restore, negative compiler tests, contention and recovery using the separate catalog cases. Inspect exact plans before dangerous remote database operations and obtain their required exact-plan confirmation. The general plugin test request does not authorize unrelated business DML, authentication changes, production, destructive fault injection or another target.

For `A261-028`, the companion harness stages one page-title marker and creates a reviewable full-import plan without server writes:

```sh
node scripts/test-plugin-imports-261.mjs \
  --project docs/evidence/plugin-server/project --env test --mode plan
```

After applicable authorization, use `--mode apply --user-request 'The actual human approval.'`. It runs three title-only full imports, restarts MCP between cycles, checks grant removal and returns the original title through a fresh ordinary ship. Sources/security/database inputs remain otherwise unchanged. The final title reset is a scoped restoration check; it does not qualify the separate backup-restore command in `A261-032`. Any failed or unknown outcome stops the harness and retains prepared source, baseline and original run for server-first reconciliation. Never rerun the plan stage over a prepared source without preserving the original bytes.

After reset, independently export the application through the CLI into a new private directory. Use `node scripts/plugin-test-audit.mjs --project PRIVATE_PROJECT --baseline PRIVATE_INITIAL_BACKUP --actual PRIVATE_FINAL_EXPORT` to compare every file, including hidden Oracle metadata, by SHA-256. The audit requires exact bytes and uses no normalization. It records private hashes and mismatch filenames without exporting source content.

## Time, tokens and quality

Each harness measurement records monotonic wall time through verification/completion, sample count, median, nearest-rank p95, minimum/maximum/mean, UTF-8 result bytes, case outcome and a diagnostic latency budget. The report also records total wall time, MCP calls including job observations, source/catalog/runtime digests and unexecuted cases. A failed assertion is a failed test even when the operation itself returned success. Reports are written after each case so a stopped run retains observations; do not infer success from incomplete output.

Budgets are initial diagnostic limits, **not an SLA**. Three samples describe a smoke run. For performance qualification collect at least 20 samples, a warm-up excluded from statistics, separately measured fresh-process cold runs and warm runs, fixed queries/datasets and the same machine, SQLcl, database release, model and context settings. Record network conditions and compare a source-bound baseline. Do not compare speed across runs with different quality outcomes. The harness reports budget overruns separately from functional failures; a passing operation does not imply its latency budget passed.

Use the read-only companion for `A261-046`:

```sh
node scripts/benchmark-plugin-261.mjs \
  --project docs/evidence/plugin-server/project --env test --samples 20 \
  --rollout /absolute/path/to/current-codex-rollout.jsonl \
  --output docs/evidence/plugin-server/performance-20.json
```

It measures six fixed scenarios, each with one excluded warm-up and 20 recorded repetitions: fresh MCP startup/discovery/reference search, warm reference search, warm project summary, one live metadata batch with three kinds, Oracle compiler validation, and read-only full-import planning. Assertions run inside every measured interval. Failures remain in the sample set; successful-only statistics are also identified separately. Warm compiler validation uses SQLcl's persistent offline JVM; connected metadata and planning use fresh connected vendor sessions. Fresh MCP startup does not purge operating-system caches. Planning never applies an import. This is a current-build stdio benchmark, not a fresh native Codex/Claude loading test, and no per-call model token billing is available.

Use `--scenarios live-metadata-batch-three-kinds,read-only-full-import-plan` for a bounded read-only session-reduction comparison. Each sample retains individual SQLcl timings plus median session counts and summed spawn/connect/execute intervals per invocation. Metadata timing records require `debugTimings: true`; normal responses carry only session count and total SQLcl milliseconds. CLI connect duration is `null` because the CLI runs connection setup inside its script, while MCP saved-connect calls have a separate measured interval.

For requested browser verification, use the separate [APEX 26.1 browser cases](apex-26.1.browser.cases.json) through host browser controls. These nine cases cover the existing application shell and session controls; a blank Home cannot qualify business CRUD or Composer runtime. Read credentials literally from ignored `test.env`, disable Remember username, redact session URLs and retain private screenshots and observed results. Record requested and effective viewport dimensions because an embedded panel may constrain the viewport. UI-control wall time includes automation overhead and must not be compared to browser navigation timing or MCP operation latency. No browser runner is installed or exposed by the plugin.

For an agent-led case, capture checkpoints around the complete scenario:

```sh
node scripts/plugin-test-metrics.mjs start \
  --file docs/evidence/plugin-server/case-checkpoint.json \
  --case A261-028 --rollout /absolute/path/to/current-codex-rollout.jsonl
# Perform the scenario in the host; allow the host to emit its usage event.
node scripts/plugin-test-metrics.mjs finish \
  --file docs/evidence/plugin-server/case-checkpoint.json \
  --rollout /absolute/path/to/current-codex-rollout.jsonl
```

`finish` writes a private `.result.json` with elapsed wall time and actual cumulative host-counter deltas. Use a new checkpoint filename per case. The reader extracts only `token_count`, session ID and model; it never exports chat/tool content. Input, cached input, cache-write input, output, reasoning output, total and derived uncached input are recorded when supplied. Cached input is included in input; reasoning output is included in output. Do not add these subsets twice. Never describe total input as context-window occupancy or compute money without exact model pricing.

The delta covers **all work in that host session between usage checkpoints**, including agent reasoning and tool context. It is not billing for one MCP call. A missing host record, unchanged record, counter reset or different session yields `available:false` with a reason, not an estimated zero. An optional `--rollout` on the harness records the session-wide delta during that run; a pure CLI/MCP run has no model tokens of its own. Claude or another host must supply its own measured usage adapter; no Codex values are copied across hosts.

Quality evidence must include expected versus actual behavior, compiler diagnostics, exact source/target, error classification, preservation/containment and applicable server readback. Add retries, manual corrections and tool calls to agent-led evaluations. Record `passed`, `failed`, `blocked` or `not_run` per case; do not aggregate skipped cases as successes. Authenticated browser behavior is a separate explicitly requested scenario. Fixtures, offline Oracle compiler, connected metadata/import and actual native-host/UI results stay distinct.

## Quality and performance extension

[quality-performance.json](quality-performance.json) defines the shared metrics, statistics rules, response byte budgets, regression gate and recorded baselines for five catalogs:

| Catalog | IDs | Scope |
|---|---|---|
| [apex-26.1.cases.json](apex-26.1.cases.json) | `A261-050`–`A261-067` | Session budgets, measured apply, per-kind metadata, warm sessions and isolation, concurrency, response size, false drift, error and compiler-diagnostic quality, long-poll, cancellation, resource hygiene, regression gate, connect-cost decomposition, scaling, prewarm |
| [apex-26.2.extensions.json](apex-26.2.extensions.json) | `A262-*` | Profile isolation, read-only parity, 26.2 reference quality, selected-file import round trip/speed/conflict/recovery, recipes, Composer, local versus remote cost, qualified apply latency, ORDS versus direct, scaling |
| [agent-tasks.cases.json](agent-tasks.cases.json) | `AGT-*` | Fixed golden prompts with automated oracles, quality checks and diagnostic tool-call limits, run per host and profile |
| [host-codex.cases.json](host-codex.cases.json) | `HCX-*` | Codex install/discovery, startup context cost, usage adapter, golden-task runs, in-app browser, sandbox, tool timeout, update/uninstall |
| [host-claude.cases.json](host-claude.cases.json) | `HCL-*` | Claude Code install/validate, deferred tool loading, usage adapter (not yet implemented), golden-task runs, browser choice, permission friction, MCP output limits, tool timeout, plugin freshness, update/uninstall |

Cases marked with a `prerequisite` (for example connected session pooling or prewarm) are recorded as `not_run` with that reason until the feature exists. Agent golden tasks run in fresh native host sessions with at least three repetitions; a failed oracle or any safety violation fails the task, and its speed is excluded from comparison. Claude and Codex token counters use different input accounting; normalize them through the host catalog's `usageAdapter` mapping before comparing. Baselines are diagnostic and bound to their recorded machine, SQLcl, target and network.

## Repository checks and reporting

Run the relevant repository suites, including the metrics and workspace-name regressions:

```sh
npm run test:unit
npm run test:contracts
npm run typecheck
npm run lint
npm run docs:check
```

The JSON catalog is machine-readable and intended for other agents. The harness's `partial` result means its subset passed while broader catalog scenarios remain unexecuted. Retain first failures alongside repaired runs; update [implementation status](../../docs/implementation-status.md) and [next actions](../../docs/next-actions.md) with actual verification limits. Never publish private ENV/project/rollout contents. No publish, push, tag or native-profile modification is part of this harness.
