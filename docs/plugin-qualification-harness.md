# Plugin quality and performance harness

The repository qualification tools exercise the plugin itself. They do not add an application test runner to the shipped plugin. Reusable definitions live in [the test catalogs](../tests/plugin-server/README.md); measurements, prepared applications, exports and reports belong in Git-ignored `docs/evidence/`. APEX 26.1 is the default baseline. APEX 26.2 uses a separate catalog, explicit compiler profile and separate reports.

## Read-only execution

Build the current runtime before running the tools. Prepare a private project with its existing source, lock, environment and saved connection. Connection identity and release checks must succeed before connected measurements qualify. ENV input is read as literal data through the existing file-access checks. The qualification adapter also accepts the narrow legacy `sqlcl:`/`workspace:` colon format; it never executes or expands values.

```sh
npm run build
node scripts/test-plugin-server.mjs --project <private-project> --env test --samples 3
node scripts/test-plugin-quality.mjs --project <private-project> --env test --samples 20 --output docs/evidence/qp-harness/quality-26.1.json
node scripts/benchmark-plugin-261.mjs --project <private-project> --env test --samples 20
node scripts/sqlcl-cost-probe.mjs --project <private-project> --env test --samples 20 --output docs/evidence/qp-harness/cost-26.1.json
```

The baseline and quality runners accept `--catalog` and `--profile`. The quality runner accepts `--cases A261-050,A261-052` and `--resume`; retain the first report separately before replacing failed measurements. Successful prior cases remain in a resumed report, which records its previous runtime digest. A complete run can fail even when its latency scenarios pass.

```sh
node scripts/test-plugin-server.mjs --project <private-26.2-project> --env dev --samples 3 --catalog tests/plugin-server/apex-26.2.extensions.json --profile 26.2 --output docs/evidence/qp-harness/parity-26.2.json
node scripts/test-plugin-quality.mjs --project <private-26.2-project> --env dev --samples 20 --catalog tests/plugin-server/apex-26.2.extensions.json --profile 26.2 --output docs/evidence/qp-harness/quality-26.2.json
node scripts/test-plugin-262.mjs --project <private-26.2-project> --env dev --output docs/evidence/qp-harness/extension-26.2.json
node scripts/sqlcl-cost-probe.mjs --project <private-26.2-project> --env dev --samples 20 --output docs/evidence/qp-harness/cost-26.2.json
```

The 26.2 runner checks profile/MMD identity, reference retrieval and two generated starters containing the six bundled 26.2 recipes. Offline CodeScan advisories are recorded separately from compiler results. The golden list has traceable corpus IDs and file digests, but its feature exclusivity and expected answers still require independent review. A failed connection is not evidence of release parity or fast local database access.

## Timing and response quality

`quality-performance.json` supplies session and response budgets and historical baselines. Measurements preserve `measurements[]` and `checks[]`, with excluded warm-ups, monotonic wall time and nearest-rank p95. CLI/MCP execution alone has no model tokens. Response byte overruns are diagnostics, separate from functional assertions; stack traces are flagged.

SQLcl `SET TIMING ON` measures each existing marked batch query, including JSON serialization. The parser accepts a footer adjoining the JSON closing bracket, strips it before parsing and retains all-or-nothing batch behavior. Only `debugTimings: true` exposes `statementMs[]` and per-operation queue/process intervals. Neither SQL, bindings nor usernames belong in those timing records. Direct CLI connection setup remains inside the execution interval; `connectMs: null` is intentional.

The metadata matrix measures eight kinds and an all-kinds batch. A missing package uses an explicit empty signature probe and cannot qualify existing-package signatures. The concurrency case uses one MCP client for four metadata requests, one plan and one validation, with correctness checks and recorded queue waits. The drift case performs unchanged plans and independent exports into private directories without refreshing the working copy.

The cost probe uses `/nolog`, then the saved-connection name on stdin. Its three scenario differences include command handling, JVM/server variation and network effects. A small negative select increment is measurement noise. Vendor refusal text is checked even when SQLcl exits zero. Resource observation tracks only descendants of the harness MCP process, never kills user processes, allows bounded shutdown time, and discloses that shared stage-directory counts cannot establish exclusive ownership.

Historical regression is `true`, `false` or `not_comparable`. A comparison requires matching quality and complete machine, SQLcl and target fingerprints. Missing fingerprints do not become an inferred speed improvement. Concurrent native sessions, server load and network conditions must be controlled for a qualified comparison.

## Native host usage and tasks

```sh
node scripts/run-agent-tasks.mjs --host codex --profile 26.1 --project <private-project> --env test --tasks AGT-001,AGT-004,AGT-007,AGT-008,AGT-011 --repeat 3 --output docs/evidence/agent-tasks/codex-26.1.json
node scripts/run-agent-tasks.mjs --host claude --profile 26.1 --project <private-project> --env test --tasks AGT-001,AGT-004,AGT-007,AGT-008,AGT-011 --repeat 3 --output docs/evidence/agent-tasks/claude-26.1.json
```

The runner verifies CLI versions/help, uses Codex `exec` or Claude `--print`, existing login and fresh private project/session copies. Claude receives the already installed plugin directory for that invocation; native profile/plugin settings are not changed. Installed-cache provenance and the current-build read-only oracle are separate. The recorded cache digest alone does not prove the exact active Codex payload. Existing model/effort defaults are observed rather than pinned, so timings remain descriptive; mixed observed models cannot qualify a host speed comparison.

Codex usage reads cumulative `token_count`. Claude usage sums unique assistant `message.id` records, keeping the last streamed usage. Normalized input includes ordinary input, cache writes and cache reads. Reasoning is an output subset only when supplied. Sidechain usage is separate. `--rollout`, `--transcript` and `--usage-source` select the usage source for the checkpoint and supported harness commands; unknown/missing/stale/reset/cross-session counters remain unavailable. Fresh native tasks use whole-session totals with no preceding model turns, not fabricated per-tool billing.

Transcript metrics read arguments/text only in memory. Persisted output contains tool names, categories, counters and safety/permission classifications. Missing permission records yield `null` with a reason. Host-owned transcripts remain in their normal locations; the harness does not export them. Supplied ENV secrets are scanned in memory and only occurrence counts are retained.

Native `wallTimeMs` measures CLI execution, excluding postchecks. New runs also record `verifiedWallTimeMs` including postchecks. Failed or unsafe runs stay in raw samples and are excluded from success statistics. Statistics under `toolCalls` and `normalizedTokens` are counts despite the shared statistics helper's historical `*Ms` field names. Diagnostic tool-call limits do not override an oracle failure. Connected-session diagnostic limits are not yet derived from native tool-result transcripts.

`scripts/reanalyze-agent-tasks.mjs` recomputes classified metrics and read-only oracles from existing sessions after a scanner fix, retaining the original assessment. It does not rerun models. Page and dictionary checks are deterministic and conservative; dictionary keyword checks are not a full semantic parser. AGT-007 cannot pass without independent technical review, even if reference/keyword checks pass.

## Unimplemented prerequisites and case extensions

Connected write requests require `--allow-app-writes --user-request '<literal human instruction>'`. These flags are necessary, but the new 26.2 and agent runners still block write cases because exact case-specific setup/readback/reset/audit fixtures are not implemented. The existing 26.1 title-import runner retains its narrower prepared-plan workflow; it does not cover those new cases. No write case was executed in this qualification work.

Connected P2 pooling/prewarm cases currently implement prerequisite classification only. Their flags-on measurement logic remains unfinished. Read-only planning returns inline and exposes no job completion timestamp, so A261-060 records `not_run`; an apply job is not substituted. Expired/tampered-plan negatives are likewise unexecuted because their checks belong to apply. Human App Builder edits, restarts, cancellation, scale fixtures and transport comparisons remain operator qualification. AGT-012's Composer oracle and the new dashboard scenario require separate implementations.

Keep failures as findings. Current error next-step/parity shortcomings, compiler semantic/line shortcomings, reference retrieval misses, unavailable local Oracle access and native task failures remain verification blockers. See [implementation status](implementation-status.md) and [next actions](next-actions.md).
