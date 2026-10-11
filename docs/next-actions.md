# Next actions and verification limits

## Connected and host qualification

- The APEX 26.1.5 read-only P0/P1 comparison passed 20 samples plus one excluded warm-up for metadata and planning. Metadata median improved from 9.62 to 5.42 seconds; plan from 6.86 to 3.13 seconds. The common full working-copy apply uses four connected sessions in fake-runner tests. Its estimated saved session time is 12.45 seconds; actual apply speed remains unmeasured on Oracle. A connected import benchmark needs a separately authorized target/plan and recovery scope. Preserve fresh identity/drift/post-import observations and discard-after-connected-batch policy; the same-session guard remains deferred until transport error-stop behavior is proven.
- Reuse the [APEX 26.1 server test catalog](../tests/plugin-server/README.md) (49 baseline cases plus the `A261-050`–`A261-067` quality/performance definitions), nine host-browser shell/session cases, current-build MCP runner and host time/token checkpoints. The authorized 26.1.5 title-import/reset and exact 21-file final audit passed; retain their private evidence and baseline. Extend metadata object/signature fixtures, separately planned backup restore, real fault recovery, Composer runtime and fresh host/platform scenarios with their required targets and authorization. Use the separate 20-repetition read-only benchmark for cold/warm latency; model-driven workflow and historical regression comparisons require their own controlled baseline. Refresh the installed plugin and open a fresh native session to verify the hyphenated-workspace fix currently confirmed only in the current build.
- Reuse the implemented [qualification harness](plugin-qualification-harness.md). W1 Claude usage has synthetic and independently summed real transcript evidence. W2 read-only distributions, W3 offline compiler/reference checks and W5 thirty native sessions are recorded separately. Resolve missing error next steps/MCP–CLI workspace parity and the four failed compiler-fault checks; review the 26.2 golden list and its four retrieval misses before claiming reference quality. Repair the local 26.2 saved connection/ORDS availability during an authorized setup task before connected parity or cost comparisons.
- Finish definition-specific write/setup/readback/reset/byte-audit fixtures for 26.2 and agent cases, AGT-012's Composer oracle, P2/prewarm measurement bodies and native connected-session limit accounting. Flags currently gate but do not implement these scenarios. Read-only plan jobs expose no completion timestamp; A261-060 and apply-only expiry/tamper checks remain unexecuted. AGT-006/013 still need correctly staged human operator coordination. Do not substitute generic resets or imports.
- Review AGT-007 technical answers independently and strengthen dictionary answer parsing. Native postchecks passed 8/15 Codex and 5/15 Claude runs; retain failures and exclude them from successful latency statistics. Pin model/effort and bind the exact active native plugin payload before host speed comparisons; the current Claude runs contain different observed models and recorded native time excludes postchecks. Broader `HCX-*`/`HCL-*`, operator and dashboard cases remain unexecuted. Keep all 26.2 results and CodeScan findings separate from the 26.1 baseline; remediation requires its own scope.

- Exercise the shared six-skill/ten-tool bundle in fresh Codex and Claude Code sessions: skill/tool discovery and the one-call scoped ship/job flow. Manifest-driven subprocess parity and managed binding checks are local evidence only; request browser verification separately when needed. Confirm a shared managed home or externally serialize independent homes.
- On an explicitly authorized development/test target, verify full and selected-file imports, source preservation, authenticated browser CRUD, denied actions, stale versions and narrow screens. Record compiler, import and browser observations separately.
- Qualify Linux/Windows/WSL2 native installations and connected SQLcl/ORDS behavior. Hosted build tests do not establish native host or Oracle behavior.
- Qualify native selected export for shared-component files; current isolated component imports disclose full APEXlang observation. The local page/LOV/dashboard and selected-page restore checks passed; broader families, independent machines and target builds remain separate qualification.
- Exercise current server-first recovery under real interrupted/lost-response imports, backup/restore and externally serialized runners. Retain unknown ownership until the outcome is reconciled.

## Application verification

- Use the host in-app browser for affected interactions and relevant narrow layouts; keep observations separate from compiler/import results.
- Reconcile the nine advisory CodeScan findings in the local 26.2 CRM fixture before claiming security qualification.
- Existing projects can drop retired `tests` and `database.testsDir` settings; the loader ignores them. Regenerate old plans and reconcile unresolved deployment state rather than rewriting journals.

## APEX 26.2

- Use the [Oracle synchronization skill](../plugins/apexrest-apex/skills/apexrest-oracle-sync/SKILL.md) for source updates. Review new release directories, imported catalog/examples, licensing and compiler MMD separately; preserve 26.1 evidence and routing. Full inventory retrieval does not close runtime/provider/import/browser qualification.

- Keep the managed installer default at 26.1 until broader qualification is complete. A 26.2 project needs its explicit profile, compiler and lock.
- ORDS and SQLcl MCP-mode selected-file imports require a separate transport implementation; explicit file mode must continue refusing unsupported transports.
- Keep report-column order normalization restricted to classic reports with unique explicit sequences. Broader region types and child families need their own Oracle results and negative tests; the latest classic-report readback is session-reported, not independently repeated in the follow-up review. Selected-scope checks do not establish unselected server freshness; full audits remain separate.
- Qualify provider calls, DDS, OCI IAM/network prerequisites and workflow migration independently of offline recipes and metadata visibility.

## Runtime and Composer

- Complete Composer shared-resource ownership, typed route/consumer handling, property/fault coverage and authenticated Oracle/browser qualification. See [Composer](composer.md).
- Verify the generated save dialog over HTTP/HTTPS and the create-as-edit retry path. Materialization and compiler success do not establish runtime DML or authorization.
- Add recovery for `LOCK_CORRUPT`, clarify first-use integrity records and verify Windows launchers/rename retries.
- Qualify process-group termination of SQLcl on native Windows (`taskkill /T`) and confirm the exit-drain fallback against a real stalled `apex import`; the POSIX behavior is covered by local shell fixtures only.
- Broaden remote database dependency/operation qualification and local-transport identity coverage; production deployment remains forbidden.

## Release and repository policy

Run relevant local checks before integrating changes; CI runs only on `main`. Repository release/integration workflows remain disabled. The authorized 2.0.0 npm exception retains three mandatory current local reports and treats the six external reports as advisory for npm only. Full qualification still requires all nine reports. Do not treat absent reports as passed gates.

- Preserve the verified 2.0.0 npm publication evidence: latest=2.0.0, matching public archive integrity and a fresh registry install with CLI/MCP/current-reference checks. Future versions need their own applicable readiness decision; the local-evidence exception is bound only to 2.0.0.
- Obtain full Composer runtime/new-chat, native macOS/Linux/Windows and Oracle integration qualification during a separately requested qualification run. The current npm exception does not mark those reports passed. Keep original 26.1 records separate from the new block compiler proofs.
- Preserve the passing Windows cleanup regression, `.github/workflows/ci.yml`, all three local npm gates and the default full-qualification gate. Hosted CI is separate from native model-host qualification.
- Future native qualification needs supported config profiles with the exact current plugin and accessible dedicated Linux x64 and Windows x64 hosts. Do not copy authentication tokens or treat the existing ARM64 Podman VM as Linux x64 qualification.

Preserve functional catalog provenance, licensing and compiler bindings. Preserve private application baselines, APEXlang and legacy SQL backups, migration history and unresolved journals; repository cleanup does not authorize removing active deployment state.

## Documentation website

- Keep tracked Pages generated from the current Markdown/site sources; rerun `site:check`, documentation checks and relevant browser review after changes.
- After a separately authorized push to `main`, verify the live [GitHub Pages website](https://apexrest-dev.github.io/apexrest/), search, navigation and assets.
