# Testing and verification

This page lists the checks that exist for APEXREST and for an application you ship with it, and what each one establishes. Read it to select the checks for a change or to verify a deployed page in a browser.

APEXREST develops and deploys Oracle APEX applications. Keep these boundaries in mind:

- Application verification uses the host in-app browser.
- The plugin provides no automatic application unit, SQL, API or UI test runner, browser installation or saved authentication state.
- Oracle compiler validation and read-only metadata checks remain development/deployment checks.
- Browser observations are separate from compiler and import outcomes.

## When to use

| You are                                            | Read                                                  |
| -------------------------------------------------- | ----------------------------------------------------- |
| Shipping a page or dashboard change                | [Application-only changes](#application-only-changes) |
| Asked to verify a deployed change in a browser     | [Browser verification](#browser-verification)         |
| Changing the APEXREST repository itself            | [Local development checks](#local-development-checks) |
| Qualifying a host installation or an Oracle target | [Host and Oracle checks](#host-and-oracle-checks)     |
| Looking at a failed check                          | [Diagnose and rerun](#diagnose-and-rerun)             |

## Application-only changes

For an ordinary authorized page or dashboard change:

- **Ship with one call.** Use one `apexrest_ship mode:apply` call; it validates with the real Oracle compiler before import.
- **Validate while editing.** Use standalone `apexrest_apex_validate` for editing diagnostics. `apexrest_ship` validates again when planning, so a separate identical compilation immediately before it is unnecessary unless you are diagnosing a change.
- **Reconcile source queries when needed.** Use authorized read-only checks (`apexrest_metadata_read`).
- **Report confirmed server completion.**
- **Inspect the page in the selected browser only when the user requests it.**

**Design iteration before shipping.** The [local preview](local-preview.md) (`apexrest_preview`) renders and runs the pages on Node.js and SQLite; `check` lists every unsupported feature. It is a design aid: it does not replace compiler validation, an import or browser verification on the target.

**When browser verification is requested.** Exercise the requested positive and negative interactions through the built-in or user-selected browser. Application writes need their own authorized scope and disposable test data. Compiler and metadata checks do not establish authenticated UI behavior.

## Browser verification

This rule applies when the user requests browser verification. Ordinary confirmed server deployment is success without this step.

1. **Select the browser.** The project preference `.apexrest/panel/preferences.json` (`browserMode: host|codex` or a user-selected browser name, default `codex`, the legacy alias of `host`) selects the host's in-app browser; `apexrest_browser_open` accepts a bounded browser name in `browserMode` for one call. The development status snapshot stays inside the host; only application pages open in the selected browser.
2. **Resolve the page.** After a successful ship, call `apexrest_browser_open` with `env`. It returns the configured URL for the host browser controls. The resolved URL is a handoff, not evidence.
3. **Inspect the affected page.**
   - Open it with the browser controls.
   - Complete authorized login in that browser if needed, using an ignored/untracked local ENV credential source when available without echoing values.
   - Wait for the relevant asynchronous regions to finish loading, then exercise the changed controls and navigation.
   - For dashboards, check date ranges, filter submission, chart refresh, reconciled values and a real empty state.
   - For forms, check the relevant validation, save and cancel behavior.
   - Inspect layout at the viewports relevant to the change.
   - Opening a page is not verification; a login screen or a transient chart-loading state is not evidence that the feature works or is broken.
4. **Record observations separately.** Report what was observed per page, apart from compiler and import results. Record missing browser controls, incomplete authentication, an unavailable deployed change or an unreachable target as missing verification with its reason; never describe it as passed.
5. **Keep evidence sanitized.** Screenshots and page text can contain business data, URLs and session identifiers; review them before attaching them to a report or issue.

## Local development checks

These commands verify the repository implementation, not applications through the plugin:

| Command                                    | What it establishes                                            |
| ------------------------------------------ | -------------------------------------------------------------- |
| `npm run lint`                             | Formatting and source conventions                              |
| `npm run typecheck`                        | TypeScript consistency                                         |
| `npm run test:unit`                        | Core and failure/concurrency fixtures                          |
| `npm run test:contracts`                   | CLI/MCP contracts, both host manifest launches and tool parity |
| `npm run test:installers`                  | Download, archive, integrity and platform fixtures             |
| `npm run test:packaging`                   | Package schemas, containment, manifests and site checks        |
| `npm run docs:check`                       | Links, anchors and documented commands                         |
| `npm run plugin:check`                     | Checked-in bundle matches a fresh build                        |
| `npm run site:build`                       | Local documentation site generation                            |
| `npm run preview:corpus -- --archive PATH` | Local preview over Oracle's public 26.2 applications           |

Build with `npm run build` before checks that consume `dist/`.

What these checks do and do not cover:

- Packaging validates Claude Code manifests when its CLI is available.
- The host-parity contract resolves each manifest launcher from a relocated payload, compares the scoped ship/tool contracts and references, and checks shared managed connection state.
- Installer fixtures check both Node/home bindings and payload integrity.
- These do not start model sessions or import an application.
- GitHub local quality gates run only on pushes to `main`; release and Oracle integration workflows remain disabled.

### Preview corpus

`preview:corpus` renders every page of the 33 public Oracle APEX 26.2 applications in the [local preview](local-preview.md) and counts what it could not run by kind (placeholders, application calls, seed and SQL failures). Pass the pinned `oracle/apex` source archive that the public template catalog uses; the script checks its SHA-256 and writes the scorecard to `docs/evidence/preview-corpus/`. It measures the preview, not Oracle behavior.

### Built web application

`node tests/webapp/e2e.mjs` checks a running [built web application](webapp.md) end to end against an Oracle database that holds the Bitcoin Price Monitor schema (sign-in, reports, a committed form insert, sign-out); its header lists the environment variables. It needs a local DEV or TEST database and is not part of the automatic checks.

## Host and Oracle checks

| Check                            | What it does                                                                                           | What it does not do                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run test:repository-plugin` | Checks installation in an isolated Codex profile plus installed CLI/stdio MCP behavior.                | It does not invoke a model or establish that a host loaded this version in a conversation. |
| `node scripts/oracle-smoke.mjs`  | Runs Oracle source generation and validation with SQLcl without a database connection.                 |                                                                                            |
| `npm run test:integration`       | A repository harness for compiler, authorized deployment, grant removal and no-op export preservation. | It does not execute application test suites or browser automation.                         |

Runtime interaction remains a separate host-browser check.

### Plugin server cases

The reusable [APEX 26.1 plugin server cases](../tests/plugin-server/README.md) cover functional quality, diagnostic latency budgets and actual host-token checkpoints.

- The machine-readable catalog maps the current acceptance criteria and explicitly distinguishes automated harness cases from agent-led scenarios.
- Use the ignored `test.env` target and store sanitized reports in ignored `docs/evidence/plugin-server/`.
- APEX 26.2 has the separate `apex-26.2.extensions.json` catalog and separate evidence.
- The 26.1 catalog contains 67 baseline and quality/performance cases; agent, host and Bitcoin catalogs extend qualification independently.

### Integration harness

`npm run test:integration` requires all of the following before apply:

- `APEXREST_INTEGRATION_PROJECT`
- `APEXREST_INTEGRATION_ENV`
- named SQLcl connections
- a supported non-production APEX target
- `APEXREST_INTEGRATION_ALLOW_WRITES=true`

How it handles authorization:

- The integration harness uses `ship --mode apply --user-request TEXT` to bind the operator's consent to the exact project, target and plan.
- It verifies that this grant was removed after each attempt.
- Missing prerequisites remain blocked; recovery and fault injection require separately authorized targets.
- Independent managed homes/machines must be serialized externally.

## Diagnose and rerun

1. Classify the failure and inspect the bounded diagnostics, affected source and actual target.
2. Make a focused repair.
3. Repeat the affected compiler or browser check.
4. Report remaining limitations.

For an unknown write outcome, follow [reconciliation](deployment-safety.md) before retrying. Do not repeat a full import merely to renew an interactive browser session.

## Related

- [Troubleshooting](troubleshooting.md): fault codes and what to do for each.
- [Deployment safety](deployment-safety.md): plans, grants and recovery.
- [Local preview](local-preview.md): design iteration without a database.
