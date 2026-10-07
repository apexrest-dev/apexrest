# Testing and verification

APEXREST develops and deploys Oracle APEX applications. Application verification uses the host in-app browser; the plugin provides no automatic application unit, SQL, API or UI test runner, browser installation or saved authentication state. Oracle compiler validation and read-only metadata checks remain development/deployment checks. Browser observations are separate from compiler and import outcomes.

## Local development checks

These commands verify the repository implementation, not applications through the plugin:

| Command                   | What it establishes                                         |
| ------------------------- | ----------------------------------------------------------- |
| `npm run lint`            | Formatting and source conventions                           |
| `npm run typecheck`       | TypeScript consistency                                      |
| `npm run test:unit`       | Core and failure/concurrency fixtures                       |
| `npm run test:contracts`  | CLI/MCP contracts, both host manifest launches and tool parity |
| `npm run test:installers` | Download, archive, integrity and platform fixtures          |
| `npm run test:packaging`  | Package schemas, containment, manifests and site checks     |
| `npm run docs:check`      | Links, anchors and documented commands                      |
| `npm run plugin:check`    | Checked-in bundle matches a fresh build                     |
| `npm run site:build`      | Local documentation site generation                         |

Build with `npm run build` before checks that consume `dist/`. Packaging validates Claude Code manifests when its CLI is available. The host-parity contract resolves each manifest launcher from a relocated payload, compares the scoped ship/tool contracts and references, and checks shared managed connection state. Installer fixtures check both Node/home bindings and payload integrity. These do not start model sessions or import an application. GitHub local quality gates run only on pushes to `main`; release and Oracle integration workflows remain disabled.

## Host and Oracle checks

`npm run test:repository-plugin` checks installation in an isolated Codex profile plus installed CLI/stdio MCP behavior. It does not invoke a model or establish that a host loaded this version in a conversation.

`node scripts/oracle-smoke.mjs` runs Oracle source generation and validation with SQLcl without a database connection. `npm run test:integration` is a repository harness for compiler, authorized deployment, grant removal and no-op export preservation. It requires `APEXREST_INTEGRATION_PROJECT`, `APEXREST_INTEGRATION_ENV`, named SQLcl connections, a supported non-production APEX target and `APEXREST_INTEGRATION_ALLOW_WRITES=true` before apply. It does not execute application test suites or browser automation. Runtime interaction remains a separate host-browser check.

The integration harness uses `ship --mode apply --user-request TEXT` to bind the operator's consent to the exact project, target and plan. It verifies that this grant was removed after each attempt. Missing prerequisites remain blocked; recovery and fault injection require separately authorized targets. Independent managed homes/machines must be serialized externally.

## Application-only changes

For an ordinary authorized page or dashboard change, use one `apexrest_ship mode:apply` call; it validates with the real Oracle compiler before import. Use standalone `apexrest_apex_validate` for editing diagnostics, reconcile source queries through authorized read-only checks (`apexrest_metadata_read`) when needed and report confirmed server completion. Inspect the page in the selected browser only when the user requests it. `apexrest_ship` validates again when planning, so a separate identical compilation immediately before it is unnecessary unless you are diagnosing a change.

When browser verification is requested, exercise the requested positive and negative interactions through the built-in or user-selected browser. Application writes need their own authorized scope and disposable test data. Compiler and metadata checks do not establish authenticated UI behavior.

## Browser verification

This rule applies when the user requests browser verification. Ordinary confirmed server deployment is success without this step.

1. **Select the browser.** The project preference `.apexrest/panel/preferences.json` (`browserMode: host|codex` or a user-selected browser name, default `codex`, the legacy alias of `host`) selects the host's in-app browser; `apexrest_browser_open` accepts a bounded browser name in `browserMode` for one call. The development status snapshot stays inside the host; only application pages open in the selected browser.
2. **Resolve the page.** After a successful ship, call `apexrest_browser_open` with `env`. It returns the configured URL for the host browser controls. The resolved URL is a handoff, not evidence.
3. **Inspect the affected page.** Open it with the browser controls, complete authorized login in that browser if needed, using an ignored/untracked local ENV credential source when available without echoing values, wait for the relevant asynchronous regions to finish loading, then exercise the changed controls and navigation. For dashboards, check date ranges, filter submission, chart refresh, reconciled values and a real empty state. For forms, check the relevant validation, save and cancel behavior. Inspect layout at the viewports relevant to the change. Opening a page is not verification; a login screen or a transient chart-loading state is not evidence that the feature works or is broken.
4. **Record observations separately.** Report what was observed per page, apart from compiler and import results. Record missing browser controls, incomplete authentication, an unavailable deployed change or an unreachable target as missing verification with its reason; never describe it as passed.
5. **Keep evidence sanitized.** Screenshots and page text can contain business data, URLs and session identifiers; review them before attaching them to a report or issue.

## Diagnose and rerun

Classify the failure and inspect the bounded diagnostics, affected source and actual target. Make a focused repair, repeat the affected compiler or browser check, and report remaining limitations. For an unknown write outcome, follow [reconciliation](deployment-safety.md) before retrying. Do not repeat a full import merely to renew an interactive browser session.
