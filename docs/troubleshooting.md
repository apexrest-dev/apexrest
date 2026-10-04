# Troubleshooting

English | [Українська](troubleshooting.uk.md)

Start with `apexrest doctor --json`, then use the reported capability or error code. A detected executable, a validated compiler, native Codex discovery and a working database connection are separate states.

## The apexrest command is missing or the menu is outdated

**Install plugin** and managed setup create the launcher in the managed `bin` directory; installing tools alone and direct `codex plugin add` do not. Follow [PATH setup](getting-started.md#use-the-cli), or open the bundled runtime from a checkout:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs
```

If a local checkout still shows category menus or **Preview only**, rebuild it with `npm run plugin:sync` and reopen the TUI. Make sure you are invoking that checkout. The current menu has six actions; Enter on **Review** executes installation/removal. Other workflows use explicit CLI commands and the Codex plugin.

If managed plugin files were removed, their launcher no longer has runtime code to start. Use the checkout command to install the plugin again. Before removal, **Keep plugin files** lets you retain a working launcher.

## Saved connections are missing or fail their test

The TUI reads the local SQLcl store. `connection add` creates only an APEXREST reference and does not add a connection to SQLcl. Save the connection in SQLcl, then press Ctrl+R in the picker. From the CLI, use `connection list --saved` to read that same store.

Check `APEXREST_SQLCL`, `APEXREST_JAVA_HOME` and `APEXREST_HOME` if tools were installed elsewhere. Select the exact saved name, including case and spaces. Repair missing or expired credentials in SQLcl; successful TUI startup does not establish database connectivity.

## The plugin is installed but tools are missing

Start a new Codex task after registration or update. Check native plugin listing and enablement in the same Codex profile. The tested Codex 0.154.0 host requires the compatibility package: the portable manifest passed schema validation and discovery but did not expose MCP tools on that host.

Use the [repository installation guide](getting-started.md#install-the-plugin) for the supported registration path. Do not add a second global MCP server to conceal a failed native installation. `needs-user-action` after setup can mean registration succeeded while connection onboarding or Oracle license consent is still missing.

## SQLcl is present but compilation fails

The reviewed local combination is SQLcl 26.1.2.132.1334 with Java 21. The system Java can differ; managed setup or `APEXREST_JAVA_HOME` selects the intended JRE. Inspect exact compiler diagnostics rather than relying only on process exit code: SQLcl can print an error and still exit zero. Validation therefore requires a success marker and no error indication; otherwise it reports `VALIDATION_UNCONFIRMED` with the compiler output.

Preserve Oracle-generated `.apex/apexlang.json` and component IDs. Never invent an MMD version or edit internal APEX tables to work around a compiler incompatibility. Use the references for the selected toolchain version and make a focused source correction.

## The target or policy check fails

| Symptom                                       | Action                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PROJECT_TRUST_REQUIRED`                      | Review executable project code and add its canonical path to the private user policy.               |
| Missing environment or identity mismatch      | Check the selected `--env`, connection, database/service, workspace, schema and application ID.     |
| Expired or mismatched plan                    | Create a new plan from the intended current source and target; do not edit a plan in place.         |
| Missing service tables in ordinary deployment | Use the default local mode; only explicitly selected database coordination requires control tables. |
| A required suite is empty or blocked          | Supply its real tests/dependency or resolve its authorized scope; do not count it as passed.        |
| `DEPLOY_APPROVAL_REQUIRED`                    | Record a deploy grant with this plan's exact `planDigest` and an expiry no later than the plan.     |
| `PLAN_TAMPERED`                               | The plan no longer matches the live target, history or sources; create and review a new plan.       |
| `RECOVERY_REVIEW_REQUIRED`                    | Remove SQLcl client commands or destructive/authentication changes, or use a reviewed workflow.     |
| `PRODUCTION_TRUST_*` or `APPROVAL_*`          | Ask the runner administrator to check `production-trust.json`, the approval key and attestation.    |
| `PASSWORD_FILE_UNSAFE`                        | Use a regular, non-symlink password file readable only by its owner (`chmod 600`).                  |

Connection credentials belong in SQLcl's local store. Do not put them in an issue or prompt. See [configuration](configuration.md).

## Browser authentication or charts do not work

Complete login locally and check that the actual application page is accessible. Automated browser auth and a Codex in-app session are separate contexts; success in one does not prove the other is authenticated. Explicitly allow required SSO/CDN origins for automated tests.

Wait for asynchronous APEX chart regions to finish loading before judging an empty chart. After a filter action, verify that the relevant page items were submitted and every affected region refreshed. Use the native dashboard guidance in the plugin when designing AJAX refresh. A loading overlay or an old tab with a pending navigation may require a fresh page inspection before changing source.

## Offline, proxy or download errors

Preload the exact SHA-keyed vendor artifacts and required npm/browser caches. `--offline` never falls back to the network; a cache miss is a dependency blocker and a corrupt artifact fails integrity. Inspect disk space, proxy/CA settings and platform-specific browser dependencies separately. Each download attempt fails after 60 seconds without new data and is retried up to three attempts in total. `PROXY_UNSUPPORTED` means a proxy is configured but the running Node cannot apply it: run with `NODE_USE_ENV_PROXY=1` on Node 24 or later, or preload the offline cache. `UNSAFE_CACHE_DIRECTORY` means the download cache is not owned by the current user or is group/world writable.

`--install-os-deps` explicitly requests Playwright's system package installation and may require elevation. Oracle license acceptance remains separate from technical setup consent. No dependency download runs during MCP startup.

## Setup is locked or interrupted

Concurrent setup reports `LOCKED`. A proven dead process on the same host can be recovered through the dedicated recovery gate. Unknown ownership, another host or an interrupted recovery gate requires inspection; do not guess that a live lock is stale.

`LOCK_CORRUPT` reports a lock file without a readable owner that is older than 30 seconds, usually left by an interrupted process. Confirm that no apexrest operation is running on any host, then delete the lock file named in the message and retry. There is no automated recovery command for this case.

Native packages are copied through staging and atomic rename. A rerun probes completed components. Preserve unrelated plugins and the private managed state; deleting everything is not a normal repair step.

## A deployment reports `OUTCOME_UNKNOWN`

Do not repeat apply or clear a writing lease merely because its TTL expired. Oracle DDL or an application import may have committed before the connection was lost. Inspect the deployment state, journal, current target history and SQL backup; reconcile with the target administrator before choosing a recovery action.

Use `apexrest deploy status --project PROJECT --run RUN_ID` for the recorded deployment run. Restore has its own plan and exact approval, and restores APEX metadata only. Business-data and schema recovery require their own procedure. See [deployment and recovery](deployment-safety.md).

## Report a reproducible problem

Include the plugin version, OS/architecture, Codex version, exact sanitized command, error code and the smallest source example that reproduces the issue. Distinguish local fixture results from Oracle or native-host observations. Review diagnostics for paths, credentials and business data before attaching them to [an issue](https://github.com/apexrest-dev/apexrest-codex/issues). Use [private reporting guidance](../SECURITY.md) for sensitive findings.
