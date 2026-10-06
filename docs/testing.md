# Testing and verification

Choose checks that establish the behavior being changed, then record what actually ran. Unit fixtures, compiler validation, connected Oracle results, host plugin discovery and browser observations are different evidence classes. This page is the canonical home of the browser verification rule applied by the [work skill](../plugins/apexrest-apex/skills/apexrest-work/SKILL.md) (step 7) and required by the project rules in `AGENTS.md`.

## Local development checks

| Command                   | What it establishes                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run lint`            | Repository formatting and source conventions                                                       |
| `npm run typecheck`       | TypeScript consistency                                                                             |
| `npm run test:unit`       | Core behavior and labelled failure/concurrency fixtures, including the SQLcl session pool          |
| `npm run test:contracts`  | Real CLI and stdio MCP contract behavior (11-tool catalog, `ship`, `job`, `status`) without Oracle |
| `npm run test:installers` | Download, archive, integrity and platform fixtures                                                 |
| `npm run test:packaging`  | Built package schemas, containment, runtime, Codex and Claude Code manifests, site checks          |
| `npm run docs:check`      | Local links, anchors and documented `node scripts/...` and `npm run` commands                      |
| `npm run plugin:check`    | The checked-in bundle matches a fresh build                                                        |
| `npm run site:build`      | Local documentation site generation                                                                |

Build with `npm run build` before checks that consume `dist/`. When the `claude` CLI is installed, the packaging tests also run `claude plugin validate --strict` on the plugin and the marketplace. The [implementation status](implementation-status.md) records dated results; this command list does not imply that every current release platform or Oracle scenario has passed.

## Host and Oracle checks

`npm run test:repository-plugin` installs the bundled plugin into an isolated Codex profile and checks registration plus installed CLI/stdio MCP behavior. It does not invoke a model or prove that a host loaded the skills or tools in a conversation; those observations require a real Codex or Claude Code session.

`node scripts/oracle-smoke.mjs` runs generation and validation with installed SQLcl, without connecting to a database. It records real compiler and MMD output for the blank and CRM templates. It does not establish a successful database import.

`npm run test:integration` requires all of the following:

- `APEXREST_INTEGRATION_PROJECT` and `APEXREST_INTEGRATION_ENV` identifying a reviewed test project.
- Existing named SQLcl connections and explicit project trust and target policy.
- A supported APEX 26.1 full-import target or the reviewed [APEX 26.2 profile](apex-26.2.md#requirements), plus dependencies required by the selected suites, including utPLSQL for the SQL suite.
- `APEXREST_INTEGRATION_ALLOW_WRITES=true` before any apply, with independently authorized mutation scope.
- Local interactive browser authentication and a dedicated test user when E2E is required.

The integration harness refuses production. Remote test suites are also refused for any target classified as production, including targets listed in the administrator's `production-trust.json`. Missing prerequisites produce blocked evidence and exit code 3; they do not count as passing skips. Deployment coordination is local and requires no service tables. The full release matrix also includes recovery and fault-injection scenarios beyond the happy-path harness.

## Application-only changes

For a page or dashboard change, validate with the real Oracle compiler (`apexrest_apex_validate` until `diagnostics` is empty), reconcile the source queries through authorized read-only checks (`apexrest_metadata_read`) and inspect the imported page in the selected verification browser. `apexrest_ship` validates again when planning, so a separate identical compilation immediately before it is unnecessary unless you are diagnosing a change.

CRUD and utPLSQL are required when the change or the configured suite scope calls for them. An explicitly authorized isolated application-only profile can declare no automated suites and record its source/browser checks separately. Preserve the established profile and historical failures; changing an established required-suite scope needs user authorization. Do not install utPLSQL or add empty suites just to import a page. No configured suites means no automated SQL/E2E tests ran.

## Browser verification

This rule applies to every user-visible application change.

1. **Select the browser.** The project preference `.apexrest/panel/preferences.json` (`browserMode: host|codex|external`, default `codex`, the legacy alias of `host`) selects the host's in-app browser (Codex, or Claude Code's built-in browser or Claude in Chrome) or the external system browser; `apexrest_browser_open` accepts `browserMode` for one call. The development status snapshot stays inside the host; only application pages open in the selected browser.
2. **Resolve the page.** After a successful ship, call `apexrest_browser_open` with `env`. In `host`/`codex` mode it returns the configured URL for the host browser controls; in `external` mode it launches the system browser. The resolved URL is a handoff, not evidence.
3. **Inspect the affected page.** Open it with the browser controls, complete login in that browser if needed, wait for the relevant asynchronous regions to finish loading, then exercise the changed controls and navigation. For dashboards, check date ranges, filter submission, chart refresh, reconciled values and a real empty state. For forms, check the relevant validation, save and cancel behavior. Inspect layout at the viewports relevant to the change. Opening a page is not verification; a login screen or a transient chart-loading state is not evidence that the feature works or is broken.
4. **Record observations separately.** Report what was observed per page, apart from automated suite results and compiler output. Record missing browser controls, incomplete authentication, an unavailable deployed change or an unreachable target as missing verification with its reason; never describe it as passed.
5. **Keep evidence sanitized.** Screenshots and page text can contain business data, URLs and session identifiers; review them before attaching them to a report or issue.

Automated browser authentication (`apexrest test auth`) and the verification browser are separate contexts; success in one does not prove the other is authenticated.

## Automated application tests

`apexrest_test_run` (CLI `apexrest test unit|sql|api|e2e|all --env NAME`) runs the configured suites. `unit` runs locally inside the MCP server process; `sql`, `api`, `e2e` and `all` can mutate data, run in a detached worker and need an environment listed in `tests.mutationAllowedEnvironments` plus a user test grant. Required suites fail when absent, empty, skipped or blocked.

The SQL runner reads real utPLSQL JUnit output and counts executed test cases. Missing utPLSQL is `dependency_missing`. SQL test files may contain SQL and PL/SQL only: before any Oracle call, a line that SQLcl could interpret as a client command, such as `host`, `@`, `spool` or `connect`, blocks the run with `SQL_TEST_SCRIPT_CONTROL`. In CLI mode each test script runs in a SQLcl session started with `-R 2`. The CRM fixture checks accepted customers, missing name, invalid email/status and duplicate email.

The browser fixture uses a unique synthetic record, tests invalid input, exercises create/read/update/delete and cleans up its own data. Its selectors must be verified against the deployed app. API suites use Playwright request tests and the guarded testkit helper with explicit allowed origins. There is no mock HTTP endpoint presented as a live APEX test.

Authenticate locally with `apexrest test auth --project ./crm --env dev`. Auth state is private and expires after eight hours. Interactive login uses an ordinary browser without recording. Saving state does not prove that it works: required E2E still has to verify the application marker and its assertions. Origin checks are a guardrail, not an OS network sandbox for trusted test code.

### Sessions ended by a full import

A full application import (`apex import`, the path for any plan with migrations or packages) replaces the APEX application and ends its existing sessions. Saved E2E state then opens the login page even though it has not expired. Before the E2E specs run, a read-only probe opens the base URL with the saved state; it enters nothing and records no screenshots, traces or cookies. When the configured `expectedMarker` is absent and a password field is visible, E2E is `blocked` with `reason: "reauth_required"` (`TEST_REAUTH_REQUIRED` from `test e2e`) and the specs do not run. If the probe sees the marker or cannot decide, the specs run and decide the result as before.

This never passes the gate: a required E2E suite must still be `passed`. During `ship --mode apply` or `deploy apply`, when re-authentication is the only gap (every other required suite passed), the deployment stops in `awaiting_reauth` with `POST_DEPLOY_REAUTH_REQUIRED` (exit code 4, status `blocked`) instead of `POST_DEPLOY_TEST_FAILED`. It is not succeeded, its working-copy checkpoint is not advanced and local ownership is released. Then:

1. The user runs `apexrest test auth --project ./crm --env dev` in a local interactive terminal. The agent never handles the password.
2. Run `apexrest deploy verify --project ./crm --run <runId>`. It confirms that the target identity, application update metadata and local migration history are exactly as the import left them (otherwise `TARGET_DRIFT`), reruns all configured suites against the same gate and records `succeeded`, `failed` or `awaiting_reauth` again. It never imports.

Do not reapply the plan to retry: another full import ends the renewed session again. A failing SQL suite, a failing spec or missing/expired state remain ordinary failures or blocks. Only a run in `awaiting_reauth` can resume.

## Diagnose and rerun

Classify the failure, read its bounded diagnostic artifact (`apexrest_artifact_read`) and inspect the affected source or dependency. Make one focused repair, rerun the affected compiler/test check, then the required gate. Do not repeat discovery, export or full imports without evidence that they are needed.

After three unsuccessful repairs of the same cause, report the evidence and unresolved dependency. Do not loosen authorization, remove required suites or replace meaningful assertions to produce a passing result. For a write with an unknown outcome, follow [reconciliation](deployment-safety.md) before any retry.
