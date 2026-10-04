# Testing and verification

English | [Українська](testing.uk.md)

Choose checks that establish the behavior being changed, then record what actually ran. Unit fixtures, compiler validation, connected Oracle results, native Codex discovery and browser observations are different evidence classes.

## Local development checks

| Command                   | What it establishes                                                            |
| ------------------------- | ------------------------------------------------------------------------------ |
| `npm run lint`            | Repository formatting and source conventions                                   |
| `npm run typecheck`       | TypeScript consistency                                                         |
| `npm run test:unit`       | Core behavior and labelled failure/concurrency fixtures                        |
| `npm run test:contracts`  | Real CLI and stdio MCP contract behavior, without claiming Oracle connectivity |
| `npm run test:installers` | Download, archive, integrity and platform fixtures                             |
| `npm run test:packaging`  | Built package schemas, containment, runtime and site checks                    |
| `npm run site:build`      | Local documentation site generation                                            |

Build with `npm run build` before checks that consume `dist/`. The [implementation status](implementation-status.md) records dated results; this command list does not imply that every current release platform or Oracle scenario has passed.

## Native host and Oracle checks

`npm run test:repository-plugin` installs the bundled plugin into an isolated Codex profile and checks registration plus installed CLI/stdio MCP behavior. This does not invoke a model or prove desktop rendering or native tool discovery inside a conversation; those observations require a real host session.

`node scripts/oracle-smoke.mjs` runs generation and validation with installed SQLcl, without connecting to a database. It records real compiler and MMD output for the blank and CRM templates. It does not establish a successful database import.

`npm run test:integration` requires all of the following:

- `APEXREST_INTEGRATION_PROJECT` and `APEXREST_INTEGRATION_ENV` identifying a reviewed test project.
- Existing named SQLcl connections and explicit project trust and target policy.
- A supported APEX 26.1+ target and the dependencies required by its selected suites, including utPLSQL for the SQL suite.
- `APEXREST_INTEGRATION_ALLOW_WRITES=true` before any apply, with independently authorized mutation scope.
- Local interactive browser authentication and a dedicated test user when E2E is required.

The integration harness refuses production. Remote test suites are also refused for any target classified as production, including targets listed in the administrator's `production-trust.json`. Missing prerequisites produce blocked evidence and exit code 3; they do not count as passing skips. Default local deployment coordination requires no service tables. The full release matrix also includes recovery and fault-injection scenarios beyond the happy-path harness.

## Application-only changes

For a page or dashboard change, validate with the real Oracle compiler, reconcile the source queries through authorized read-only checks and inspect the imported page in the Codex in-app browser when available. Planning already performs compiler validation; avoid an identical standalone validation immediately before it unless diagnosing a source change or failure.

CRUD and utPLSQL are required when the change or configured suite scope calls for them. An explicitly authorized isolated application-only profile can declare no automated suites and record its source/browser checks separately. Preserve the established profile and historical failures. No configured suites means no automated SQL/E2E tests ran.

## In-app browser verification

For user-visible application changes, use the Codex in-app browser when it and the deployed target are available. Follow the [plugin's browser rule](../plugins/apexrest-apex/skills/apexrest-test/SKILL.md#in-app-browser-verification).

Inspect the affected page, wait for the relevant asynchronous regions to finish loading, then exercise changed controls and navigation. For dashboards, check date ranges, filter submission, chart refresh, reconciled values and a real empty state. For form changes, check the relevant validation, save and cancel behavior. Inspect layout at the viewports relevant to the change.

Keep browser observations separate from automated test results. Record missing access, incomplete authentication or an unavailable deployed change as missing verification with a reason. A login screen or a transient chart-loading state is not evidence that the final feature works or is broken.

## Automated application tests

The SQL runner reads real utPLSQL JUnit output and counts executed test cases. Missing utPLSQL is `dependency_missing`. SQL test files may contain SQL and PL/SQL only: before any Oracle call, a line that SQLcl could interpret as a client command, such as `host`, `@`, `spool` or `connect`, blocks the run with `SQL_TEST_SCRIPT_CONTROL`. In CLI mode each test script runs in a SQLcl session started with `-R 2`. The CRM fixture checks accepted customers, missing name, invalid email/status and duplicate email.

The browser fixture uses a unique synthetic record, tests invalid input, exercises create/read/update/delete and cleans up its own data. Its selectors must be verified against the deployed app. API suites use Playwright request tests and the guarded testkit helper with explicit allowed origins. There is no mock HTTP endpoint presented as a live APEX test.

Authenticate locally with `apexrest test auth --project ./crm --env dev`. Auth state is private and expires after eight hours. Interactive login uses an ordinary browser without recording. Saving state does not prove that it works: required E2E still has to verify the application marker and its assertions. Origin checks are a guardrail, not an OS network sandbox for trusted test code.

## Diagnose and rerun

Classify the failure, read its bounded diagnostic artifact and inspect the affected source or dependency. Make one focused repair, rerun the affected compiler/test check, then the required gate. Do not repeat discovery, export or full imports without evidence that they are needed.

After three unsuccessful repairs of the same cause, report the evidence and unresolved dependency. Do not loosen authorization, remove required suites or replace meaningful assertions to produce a passing result. For a write with an unknown outcome, follow [reconciliation](deployment-safety.md) before any retry.
