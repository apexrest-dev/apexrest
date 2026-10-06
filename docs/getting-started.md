# Getting started

> The repository is now `apexrest-dev/apexrest` (renamed from `apexrest-codex`; GitHub redirects the old URLs).

Install the plugin in Codex or Claude Code, let it install Java and SQLcl, configure a direct SQLcl or ORDS HTTP(S) connection, then describe the change you want in the conversation. The repository and the npm package both include the built runtime, so no Git build, TypeScript compilation or `npm ci` is needed for installation.

`apexrest@1.3.0` is published under npm `latest` with the redesigned surface described here. The older `1.3.0-beta.1` remains under `beta` with the previous 21-tool surface. Connected Oracle and native-host qualification remain open; see [release notes](release-notes.md) and [implementation status](implementation-status.md).

## Codex Cloud

For a cloud task, follow [Run APEXREST in Codex Cloud](codex-cloud.md). It provides a pinned CLI bootstrap, setup/maintenance scripts and ORDS HTTPS configuration for a Linux container. Plugin registration below applies to desktop and CLI hosts; the Cloud example uses the CLI only.

## Prerequisites

| Requirement                                                    | When it is needed                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Codex with native plugin support, or Claude Code               | Plugin registration; Codex CLI 0.154.0 was exercised on macOS arm64 for earlier builds |
| Node 24 LTS on `PATH` (supported range 24–26)                  | Starting the CLI and the MCP runtime                                                   |
| Java 21 and reviewed SQLcl 26.1.2                              | Oracle generation, validation, export and import; ORDS needs a JDK with `jdk.compiler` |
| Existing supported Oracle APEX target                          | Connected workflows require APEX 26.1+                                                 |
| Saved direct SQLcl connection or plugin-local ORDS credentials | Authorized access to the configured target through the selected transport              |
| Chromium and relevant test dependencies                        | Browser/API suites; utPLSQL only when a SQL suite requires it                          |

A clean APEX installation is enough for ordinary deployment. APEXREST service tables, utPLSQL and a provisioned sandbox are not prerequisites for an application-only import. Installation does not include Oracle binaries, browser credentials or a database account.

## Install in Codex

In a terminal where Node 24 and the Codex CLI are available:

```sh
node --version
codex --version
codex plugin marketplace add apexrest-dev/apexrest
codex plugin add apexrest-apex@apexrest
codex plugin list --json
```

This registers the repository's `apexrest` marketplace (`.agents/plugins/marketplace.json`) and its `apexrest-apex` plugin in the selected Codex profile. For a local checkout, pass the checkout path to `marketplace add`. Start a new Codex task after installation. Native plugin installation of an earlier build was verified with Codex 0.154.0, Node 24.21.0 and macOS arm64; the [native installation report](evidence/native-repository.json) records that scope. Managed-workspace plugin availability can be restricted by the workspace administrator.

To find the installed plugin in the desktop app, open **Plugins** and look for **APEXREST for Codex**; use `@` in the message box or `$apexrest-work` to invoke a skill. The plugin adds no sidebar or menu button. If the tools are not listed, see [troubleshooting](troubleshooting.md#the-plugin-is-installed-but-tools-are-missing).

## Install in Claude Code

The same bundle carries a Claude Code manifest (`.claude-plugin/plugin.json`, plugin name `apexrest`) and the repository root holds `.claude-plugin/marketplace.json`:

```sh
claude plugin marketplace add apexrest-dev/apexrest
claude plugin install apexrest@apexrest
```

For a local checkout, pass the checkout path to `marketplace add`. The manifest declares the five skills and the MCP server `node ${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs`; no global MCP registration is needed. Start a new Claude Code session after installation. Both manifests pass `claude plugin validate --strict`, and a local install from a scratch marketplace was checked; an end-to-end Claude Code session that calls the tools has not been recorded yet.

## Check the setup

In a new session, ask:

> Use APEXREST to check my setup. Report the compiler, connection and target checks that still need attention.

The agent calls `apexrest_status` with `detail: "doctor"`, which probes the host, SQLcl and Java without downloads or database calls and reports the SQLcl mode (`cli` or `mcp`) and database transport (`direct` or `ords`). A detected tool is not a validated compiler or a live connection; a successful registration or plugin listing alone does not prove that the MCP server started.

## Install Java, SQLcl and browser tools

Missing SQLcl or Java is a reason to install, not to stop. The `$apexrest-setup` skill runs the bundled installer; you can run it yourself from a checkout or the installed plugin directory:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --dry-run --json
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --yes --accept-oracle-license --json
```

Read the preview first: it lists versions, destinations, download hosts and the [Oracle terms](https://www.oracle.com/downloads/licenses/oracle-free-license.html). Run the second command only after accepting those terms; `--accept-oracle-license` records that separate consent. `--skip-browser` omits Playwright and Chromium, `--offline` uses cached downloads, `--home` and `--cache-dir` select managed storage, and browser OS packages need explicit `--install-os-deps`. Tools install under `~/.apexrest` (or `APEXREST_HOME`); a custom `--home` must also be set as `APEXREST_HOME` for later CLI and MCP processes. The installer does not provision APEX, install utPLSQL or change database connections. Rerun the doctor afterwards.

### Managed runtime installation and the launcher

`apexrest setup` combines dependency installation with Codex registration and creates the `apexrest` launcher at `~/.apexrest/bin/apexrest` (macOS/Linux) or `apexrest.ps1` and `apexrest.cmd` on Windows; direct `codex plugin add` or `claude plugin install` does not create that launcher. From a reviewed checkout:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs setup --dry-run --json
node plugins/apexrest-apex/runtime/apexrest.mjs setup --yes --accept-oracle-license --json
```

`--native-only` registers the plugin with the existing runtime without downloads; `--codex-home` selects a Codex profile and `--codex` the Codex executable. A foreign or ambiguous marketplace stays blocked with `MARKETPLACE_OWNERSHIP_CONFLICT`. Add the launcher to `PATH` for future shells (APEXREST never edits shell startup files):

```sh
export PATH="$HOME/.apexrest/bin:$PATH"
apexrest --help
```

In PowerShell, invoke `& "$env:USERPROFILE\.apexrest\bin\apexrest.ps1"`. `npm install -g apexrest` provides the same command through npm's global `bin` directory. Managed setup registers Codex only; register Claude Code with the `claude plugin` commands above.

## Connect and configure

APEXREST stores connection references, not passwords. Choose the SQLcl mode and database transport once per managed home, then register references:

```sh
# Direct Oracle listener: map saved SQLcl connections.
apexrest sqlcl configure --mode cli --database-transport direct --json
apexrest connection list --saved --json
apexrest connection add dev-read --sqlcl-name saved-read-connection --json
apexrest connection add dev-deploy --sqlcl-name saved-deploy-connection --json
apexrest connection test dev-read --json
```

Saved direct connections come from SQLcl's own store; create them interactively in SQLcl first. `--saved` lists or tests that store without an APEXREST reference. `--mode mcp` selects the official SQLcl stdio server (`sql -mcp`) instead of the SQLcl subprocess; existing sessions keep their mode.

For ORDS HTTP(S), when the listener on port 1521 is unreachable, use the existing database account and the schema's ORDS URL. The password is read from a private local file (owner-only, not a symlink) and kept at plugin level under `$APEXREST_HOME/credentials/`:

```sh
apexrest connection add dev-read --ords-url https://ords.example.invalid/ords/app_user/ --ords-username app_user --password-file /path/to/local/file --json
apexrest sqlcl configure --mode cli --database-transport ords --json
apexrest connection test dev-read --json
```

ORDS requires `cli` mode. See [SQL through ORDS](ords.md). In the conversation, the agent registers references with `apexrest_project` `action:connection_add` (`name` plus `sqlclName`, or `ordsUrl`, `ordsUsername` and `passwordFile`) and checks them with `connection_list` and `connection_test`; it never asks for a password in chat.

Then give the agent the non-secret target identity for an environment:

> Configure an APEXREST test environment using the connection references `dev-read` and `dev-deploy`. The workspace is `YOUR_WORKSPACE`, parsing schema `YOUR_SCHEMA`, application ID `YOUR_APPLICATION_ID`, database unique name `YOUR_DB`, service `YOUR_SERVICE`, and application URL `https://your-host.example/ords/r/workspace/app/`. Verify that the read connection matches this identity.

Replace every placeholder with the actual target. No environment is invented by project initialization. Follow [configuration](configuration.md) for the exact environment schema, the private trust policy (`trustedProjects` in `$APEXREST_HOME/policy.json`) and test origins.

## Create or adopt a project

For a new application, name a new or empty directory and a template:

> Use APEXREST to create a blank application in a new `sales-app` project. Configure the identified test target, add a dashboard using real source measures, then ship it to that target and verify it in the browser.

The agent calls `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`); initialization generates real Oracle sources and rejects nonempty directories. For an existing application:

> Use APEXREST to initialize an existing-app project in a new `sales-app` directory and adopt the identified test application as a working copy. Preserve all Oracle IDs, `.apex` metadata, unrelated pages, shared components and authentication. Add the requested dashboard, ship it into that same app and verify the result.

Adoption (`action:adopt` with `env`, `appId` and `workingCopy`) exports into a new local directory and fails rather than overwrite local edits. Keep the generated Oracle metadata under version control and reuse the working source for later changes; see [existing applications](existing-app.md). The CLI equivalents are `apexrest project init DIR --template existing-app` and `apexrest project adopt --env dev --app-id ID --working-copy --json`.

## Edit, validate, ship and verify

The `$apexrest-work` skill drives one cycle per change: inspect the project, read at most three references with `apexrest_reference`, edit the `.apx` sources, run `apexrest_apex_validate` until `diagnostics` is empty, plan with `apexrest_ship` `mode:plan`, apply with `mode:apply`, open the changed pages with `apexrest_browser_open` and report. The steps are listed in the [README](../README.md#work-in-one-session).

Your explicit request to create, update or import an identified development/test application is the authorization for the apply step. The runtime records it as a deploy grant bound to the exact project, target and plan digest, imports with a checksummed backup of an existing app, identity and drift checks, verifies, runs the required suites and removes the grant; the agent does not ask the same permission twice. Plans expire after 30 minutes. Unrelated schema writes, authentication changes, other targets and production are outside that scope. A failed or unknown write outcome requires diagnosis or reconciliation before any retry; see [deployment safety](deployment-safety.md).

For a page or dashboard, the agent reconciles the read-only source queries and inspects the imported page in the selected verification browser. Browser observations are recorded separately from automated suites; no configured suites means none ran. See [testing](testing.md).

## Use the CLI

Every MCP operation has a CLI command with `--json` output and the same exit codes (0 success, 1 failed, 2 input, 3 dependency, 4 approval, 5 conflict, 6 unknown or cancelled). `apexrest --help` lists the commands; `apexrest ship --help` shows one command's options. There is no interactive terminal menu.

```sh
apexrest status --detail doctor --json
apexrest project inspect --project ./crm --detail summary --json
apexrest reference search metric card --corpus components --limit 3 --json
apexrest apex validate --project ./crm --json
apexrest ship --project ./crm --env dev --mode plan --user-request "Add the order status report to the dev app" --json
apexrest ship --project ./crm --env dev --mode apply --user-request "Add the order status report to the dev app" --json
apexrest job status JOB_ID --wait-seconds 30 --project ./crm --json
apexrest browser open --project ./crm --env dev --json
```

`ship --mode plan` validates with the Oracle compiler, reads the target and writes `.apexrest/plans/ship-<id>.json` for review; `--mode apply` is refused for production targets, which use `deploy apply` with the protected approval path. The granular commands (`deploy plan|apply|status|restore-plan`, `apex export|generate|sync|diff`, `test unit|sql|api|e2e|all`, `jobs status|cancel`, `compose plan|materialize`, `panel status`) remain available. The CRM template includes schema changes and required SQL/E2E suites, so its import needs their authorization and dependencies.

When calling project-scoped MCP tools, pass the absolute application project directory as `project`: the MCP server starts in its plugin directory and rejects missing or relative paths. CLI examples resolve `--project` from the terminal's working directory.

## Remove the plugin and managed tools

Codex:

```sh
codex plugin remove apexrest-apex@apexrest
codex plugin marketplace remove apexrest
```

Claude Code:

```sh
claude plugin uninstall apexrest@apexrest
claude plugin marketplace remove apexrest
```

Managed installation has its own ownership-checked commands: `apexrest dependencies uninstall --yes` removes recorded managed tools while preserving external runtimes, projects, backups, SQLcl connections and the download cache; `apexrest plugin uninstall` removes the managed Codex registration and plugin files (`--keep-runtime` retains them). Uninstall tools first when removing both. Start a new session after removal. Uninstalling never deletes application projects, backups, credentials, deployment history or database deployments.

## Next steps

Read [deployment safety](deployment-safety.md) before operating a target, [security](../SECURITY.md) before sharing artifacts and the [verification status](implementation-status.md) before selecting this build for production work. The [documentation index](index.md) links every guide and evidence record.
