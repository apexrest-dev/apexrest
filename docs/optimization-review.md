# Plugin optimization review

This is a historical review. The dated measurements below describe earlier revisions and are not re-measured for later releases. When last updated for 1.1.0, the scope was 18 MCP tools and 12 skills, with implementation directly in the current Codex session; see [catalog evidence](evidence/component-catalog-local.json). Current counts are in the [release notes](release-notes.md). Historical counts are retained only for comparison.

## Smaller context and faster reference lookup — 2026-09-21

Revision `0.3.0-beta.1+codex.20260921165734` shortens skill instructions and MCP descriptions, makes defaulted input fields optional in the advertised schema, serializes normal MCP output once, and caches reference normalization across different searches. The same 24 tools, effective input constraints, authorization and deployment safeguards remain in place. `jobs.status` accepts optional `waitSeconds` from 0 to 30: use 25 for long operations to wait inside one MCP call; omitted/0 retains immediate status.

| Local measurement                                             |       Before |                  After |
| ------------------------------------------------------------- | -----------: | ---------------------: |
| Aggregate source of all 13 `SKILL.md` files                   | 42,003 bytes | 31,789 bytes (-24.32%) |
| Serialized 24-tool catalog                                    | 24,966 bytes |  22,499 bytes (-9.88%) |
| 24 varied reference searches, median of seven fresh processes |     12.93 ms |                3.09 ms |

[Context evidence](evidence/plugin-context-local.json) measures bytes, not tokens or billing; the skill total does not imply all skills load into each task. [Reference evidence](evidence/reference-ranking-cache-local.json) records identical full-response SHA-256 values and 12/12 fixture results before/after, with and without a version filter. Cold and identical repeated searches are essentially unchanged. Cache invalidation tests pass, including an in-place same-size corpus rewrite with restored mtime. [Local validation](evidence/plugin-efficiency-local.json) passed 194 unit, 22 contract and 14 packaging tests, typecheck, lint, 46 documentation pairs, the 30-page site build and plugin sync/integrity checks. The local plugin was reinstalled; all 246 installed file hashes match the checked bundle. Built CLI/MCP current-session responses and a one-call worker wait were verified. Native task latency, Oracle speed and billed-token savings remain unmeasured.

The sections below record the earlier 2026-09-12 runtime experiment. The subsequent [Codex APEXlang optimization](apexlang-optimization.md) expands the reference corpus and changes ranking; its measurements and limitations are separate.

Reviewed runtime startup, MCP responses, references and skills, installer downloads, package construction, source inventories, deployment checks, background jobs and test execution. Implemented changes target measured repeated work and peak memory use. The original build specification remains unchanged.

## Measured results

[Machine-readable evidence](evidence/optimization-local.json) contains before/after samples and runtime hashes. Measurements use macOS arm64, Node 25.9.0, a warm filesystem and fresh CLI/MCP processes. CLI measurements have seven samples; MCP has five sessions with twenty repeated requests each; download measurements have three separate processes. Results are descriptive medians, not CI performance thresholds or cross-platform guarantees.

| Measurement                                                      |          Before |                    After |
| ---------------------------------------------------------------- | --------------: | -----------------------: |
| Total JavaScript runtime size, all entrypoints and chunks        | 3,189,249 bytes | 1,544,253 bytes (-51.6%) |
| CLI version command startup                                      |        87.64 ms |                 70.79 ms |
| MCP connection through first tool catalog                        |        89.73 ms |                 86.78 ms |
| Repeated tool catalog request                                    |        0.473 ms |                 0.166 ms |
| First reference search                                           |         6.68 ms |                  7.98 ms |
| Repeated reference search                                        |        3.942 ms |                 0.422 ms |
| Synthetic 128 MiB download, including checksum and durable write |       205.17 ms |                118.88 ms |
| Fresh checksum of the cached 128 MiB archive                     |        77.48 ms |                 65.78 ms |
| Peak process RSS across download and cached verification         |      460.56 MiB |      144.23 MiB (-68.7%) |

The synthetic download is generated in 64 KiB chunks; it does not contact a vendor. RSS includes the benchmark process and its imports. The first reference lookup now builds an index, accounting for its extra cost; repeated lookups reuse that index. The small MCP startup difference is within normal local timing variation and is not evidence of a material startup improvement. Reference result and tool catalog hashes match before and after.

## Changes and checks

- Shared ESM chunks remove duplicated CLI/MCP dependencies. Installer setup loads on demand. Both native package layouts still resolve resources and execute a synthetic unit-test background job when copied outside the repository, using either the direct MCP entrypoint or `apexrest mcp`.
- Downloads and cached checksums use bounded memory. Tests cover checksum failure, stream interruption, the 512 MiB limit and cancellation, concurrent writers, corrupted offline cache, temporary-file cleanup and preservation of an existing destination on failure.
- Reference search no longer reparses 4,875 upstream records on every call. Cache tests cover ordering, result limits, pagination, file replacement, resource-root changes, deletion/recreation, invalid JSON recovery and sync freshness. No reference content is loaded during handshake.
- MCP tool definitions are generated once per server and result envelopes are serialized once in the normal path. Output limits, strict inputs and redaction remain in place.
- The built-in deployment reference still required a database lease. It now reflects the existing clean-APEX rule: local coordination is the default, with database coordination explicitly optional.

All eight skill files remain unchanged in this review, including the in-app browser rule and its four workflow links. Their combined source size is 8,321 bytes; the serialized fourteen-tool catalog is 8,122 bytes. These are byte measurements, not a native Codex context-token measurement.

Local validation: 48 unit tests, 14 installer tests, 5 CLI/MCP contract tests and 5 packaging tests pass; typecheck, lint and build pass. No application UI changed, so no in-app browser application check was performed. This review does not refresh native Codex installation/lifecycle evidence or connected Oracle evidence.

## Remaining boundaries

Database identity, source/target drift, backup hashes, approvals, locks and migration history are still read and verified at their existing boundaries. The SQLcl workflow optimizations below are separate from these local measurements; no Oracle speedup is claimed. Deployment/test operations that may share state remain sequential. Automatic removal of staging, backups or durable history is outside this change.

The original specification still lacks a current measured native-host context-token count; the byte counts above do not fill that gap. Platform/native and connected integration gates remain open. Rebuilt local artifacts are not a published or installed upgrade.

Reproduce current measurements from the repository root with `npm run build`, then `node scripts/benchmark-optimization.mjs .apexrest/optimization-current.json`. The historical baseline is retained in the evidence report; recreating it requires the recorded original runtime bytes and original download implementation.

## SQLcl workflow optimizations

`verifyTarget` reads DB/service/schema/workspace/application in one fresh SELECT instead of opening three SQLcl sessions. Successful `help apex` results are reused within one adapter only when fresh version, executable, Java and bin/lib file identity still match. Unknown layouts bypass the cache; failed probes are not cached. Concurrent probes share only the same cancellation lifetime. Every capability check still probes the compiler version, and live target state is never cached.

Planning overlaps independent local compilation and target reads. Apply overlaps only its independent read-only preflight. Every concurrent operation settles before an error is returned; no lease or write begins after a failed check. Source/config/toolchain hashes, both target drift checks, SQL backup verification, frozen source, coordination and unknown-outcome protection remain in place. Historical `ORA-...` text inside successful JSON result rows no longer turns an activity-log query into a command failure; real process, stderr and envelope errors remain failures.

The workflow skills reuse discovery, batch coherent edits and source checks, use planning's existing compiler validation, monitor the returned job ID, and complete already-authorized test imports without duplicate permission requests. Dashboard-only guidance covers native AJAX refresh, submitted items and asynchronous chart loading. Current tools remain the same fourteen tools.

Scheduling, cache and diagnostic regression tests use explicitly labelled fixtures. Their results do not establish connected Oracle timings, successful imports or application browser behavior. See [implementation status](implementation-status.md) for local checks and outstanding integration evidence.

To measure read-only plan performance on an authorized target, build first, then run `node scripts/benchmark-oracle-workflow.mjs PROJECT ENV RUNTIME_DIR OUTPUT.json 3` with the existing `APEXREST_HOME`, connection and managed runtimes. The script never applies a plan, creates only local plan/job artifacts and stops without retrying an unknown job outcome. Keep the old runtime directory to compare versions. Record input digests, runtime identities, samples and limitations separately for each benchmark.
