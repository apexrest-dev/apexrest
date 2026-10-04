# Troubleshooting

Start with `apexrest status --detail doctor --json` (or `apexrest_status` with `detail: "doctor"` in the conversation), then use the reported capability or fault code. A detected executable, a validated compiler, plugin discovery in the host and a working database connection are separate states. Every failed result carries `nextActions`; follow them before retrying.

## The apexrest command is missing

`apexrest setup` (managed installation) and `npm install -g apexrest` create the `apexrest` command; `codex plugin add`, `claude plugin install` and installing tools alone do not. Follow [the launcher instructions](getting-started.md#managed-runtime-installation-and-the-launcher), or run the bundled runtime from a checkout:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs --help
```

`apexrest` without arguments prints help; the earlier interactive terminal menu no longer exists. If a checkout still offers menus or `tui` commands, it predates the redesign: pull the current source and run `npm run plugin:sync`. If managed plugin files were removed, their launcher has no runtime to start; install again from a checkout or npm.

## Saved connections are missing or fail their test

`connection add --sqlcl-name NAME` records an APEXREST reference; it does not create a connection in SQLcl. Save the connection interactively in SQLcl, then `apexrest connection list --saved --json` reads that store and `apexrest connection test NAME --saved --json` tests the exact saved name, including case and spaces. ORDS references are tested with `apexrest connection test REF --json` after `sqlcl configure --database-transport ords`.

Check `APEXREST_SQLCL`, `APEXREST_JAVA_HOME` and `APEXREST_HOME` if tools were installed elsewhere. Repair missing or expired credentials in SQLcl; a successful doctor run does not establish database connectivity.

## The plugin is installed but tools are missing

Start a new session after installing or updating the plugin; hosts cache the skill and tool catalog. Check that the plugin is listed and enabled in the same profile: `codex plugin list --json`, or `claude plugin list`. The MCP server is `node <plugin-root>/runtime/mcp.mjs`, started by the host from the installed plugin directory with no downloads; do not add a second global MCP server to conceal a failed installation. In Claude Code, `claude plugin validate --strict <plugin-root>` checks the manifest.

Project-scoped tools reject a missing or relative `project` argument: pass the absolute directory that contains `apexrest.json`, never the plugin directory. `PROJECT_TRUST_REQUIRED` means that path is not yet listed in `trustedProjects` of `$APEXREST_HOME/policy.json`; review the project code and add it yourself.

## SQLcl is present but compilation fails

The reviewed local combination is SQLcl 26.1.2.132.1334 with Java 21. The system Java can differ; managed setup or `APEXREST_JAVA_HOME` selects the intended JRE. `apexrest_apex_validate` returns structured `diagnostics` (file, line, column, type, message, `validValues`, hint): repair the named file and line and rerun. SQLcl can print an error and still exit zero, so validation requires a success marker and no error indication; otherwise it reports `VALIDATION_UNCONFIRMED` with the compiler output.

Offline compiler work runs on a pooled SQLcl server process that lives as long as the MCP server. A timed-out, cancelled or failed command kills its session and the next call starts a fresh one; a session idle for ten minutes is reaped. If the pool itself cannot start (for example after replacing the SQLcl installation), restart the host session so the MCP server restarts.

Preserve Oracle-generated `.apex/apexlang.json` and component IDs. Never invent an MMD version or edit internal APEX tables to work around a compiler incompatibility. Use the references for the selected toolchain version and make a focused source correction.

## Ship, target or policy checks fail

| Symptom                                                                | Action                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PROJECT_TRUST_REQUIRED`                                               | Review executable project code and add its canonical path to the private user policy.                                    |
| Missing environment or identity mismatch                               | Check the selected `env`, connection, database/service, workspace, schema and application ID.                            |
| `SOURCE_DRIFT`, `TARGET_DRIFT`, `PLAN_EXPIRED`, `SYNC_REPLAN_REQUIRED` | Run `apexrest_ship` `mode:plan` again and review the new preview; plans expire after 30 minutes.                         |
| `PLAN_TAMPERED`                                                        | The plan no longer matches the live target, history or sources; create and review a new plan.                            |
| `RECOVERY_REVIEW_REQUIRED`                                             | The plan carries destructive, privileged, authentication or SQLcl client-command risks; review them with the user first. |
| `DEPLOY_APPROVAL_REQUIRED`                                             | `ship apply` records the grant itself; for `deploy apply`, record a grant with this plan's exact `planDigest`.           |
| Production target                                                      | `ship apply` is refused by design; production uses the protected external approval path.                                 |
| `PRODUCTION_TRUST_*` or `APPROVAL_*`                                   | Ask the runner administrator to check `production-trust.json`, the approval key and attestation.                         |
| Missing service tables                                                 | None are required: coordination and migration history are local under `APEXREST_HOME`.                                   |
| A required suite is empty or blocked                                   | Supply its real tests or dependency, or resolve its authorized scope; do not count it as passed.                         |
| `PASSWORD_FILE_UNSAFE`                                                 | Use a regular, non-symlink password file readable only by its owner (`chmod 600`).                                       |

Connection credentials belong in SQLcl's store or the private ORDS credential file. Do not put them in an issue or prompt. See [configuration](configuration.md) and the [safety skill](../plugins/apexrest-apex/skills/apexrest-safety/SKILL.md).

## A job is still running, failed or has an unknown outcome

`apexrest_ship` and remote `apexrest_test_run` suites return a `jobId` when they exceed `waitSeconds`. Read `apexrest_job` `action:status` with that ID (waits up to 120 seconds and reports the `phase`: `validating`, `planning`, `backing_up`, `migrating`, `importing`, `verifying`, `testing`, `syncing`); never rerun the operation to fetch its result. A `completed` job can still carry a failed operation result: read its diagnostics. A job whose worker never started is `failed` and needs a new job after the diagnostic is resolved.

`OUTCOME_UNKNOWN`, `JOB_OUTCOME_UNKNOWN`, an expired heartbeat or a lost import response mean the database may have changed. Do not retry, cancel or clear ownership. Inspect the deployment state, journal, target history and SQL backup with `apexrest deploy status --project PROJECT --run RUN_ID`, and reconcile with the target administrator before choosing a recovery action. Cancellation never implies rollback. Restore has its own plan and exact approval and restores APEX metadata only. See [deployment and recovery](deployment-safety.md).

## Browser verification or charts do not work

`apexrest_browser_open` resolves the configured URL for the selected browser (`codex` returns a host handoff; `external` launches the system browser); opening a page is not verification. Complete login in that browser and check that the actual application page is accessible. Automated browser auth (`apexrest test auth`) and the verification browser are separate contexts; success in one does not prove the other is authenticated. Explicitly allow required SSO/CDN origins for automated tests.

Wait for asynchronous APEX chart regions to finish loading before judging an empty chart. After a filter action, verify that the relevant page items were submitted and every affected region refreshed. A loading overlay or an old tab with a pending navigation may require a fresh page inspection before changing source. Record an unavailable browser or deployed change as missing verification with a reason, following the [browser verification rule](testing.md#browser-verification).

## Offline, proxy or download errors

Preload the exact SHA-keyed vendor artifacts and required npm/browser caches. `--offline` never falls back to the network; a cache miss is a dependency blocker and a corrupt artifact fails integrity. Each download attempt fails after 60 seconds without new data and is retried up to three attempts in total. `PROXY_UNSUPPORTED` means a proxy is configured but the running Node cannot apply it: run with `NODE_USE_ENV_PROXY=1` on Node 24 or later, or preload the offline cache. `UNSAFE_CACHE_DIRECTORY` means the download cache is not owned by the current user or is group/world writable.

`--install-os-deps` explicitly requests Playwright's system package installation and may require elevation. Oracle license acceptance remains separate from technical setup consent. No dependency download runs during MCP startup.

## Setup is locked or interrupted

Concurrent setup reports `LOCKED`. A proven dead process on the same host can be recovered through the dedicated recovery gate. Unknown ownership, another host or an interrupted recovery gate requires inspection; do not guess that a live lock is stale.

`LOCK_CORRUPT` reports a lock file without a readable owner that is older than 30 seconds, usually left by an interrupted process. Confirm that no apexrest operation is running on any host, then delete the lock file named in the message and retry. There is no automated recovery command for this case.

Native packages are copied through staging and atomic rename. A rerun probes completed components. Preserve unrelated plugins and the private managed state; deleting everything is not a normal repair step.

## Report a reproducible problem

Include the plugin version, OS/architecture, host (Codex or Claude Code) and its version, exact sanitized command or tool call, fault code and the smallest source example that reproduces the issue. Distinguish local fixture results from Oracle or host observations. Review diagnostics for paths, credentials and business data before attaching them to [an issue](https://github.com/apexrest-dev/apexrest/issues). Use [private reporting guidance](../SECURITY.md) for sensitive findings.
