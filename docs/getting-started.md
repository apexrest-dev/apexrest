# Getting started

English | [Українська](getting-started.uk.md)

Install the CLI from npm, open its terminal menu to install tools and the plugin, then configure a direct SQLcl or ORDS HTTP(S) connection. The npm package includes the built runtime, so no Git checkout, TypeScript build or `npm ci` is needed. Repository installation and direct registration through the Codex CLI are also documented below.

The release version is `1.1.0`; [release notes](release-notes.md) track npm distribution separately. Native-host evidence is specific to the tested Codex and platform combination; the remaining [release qualification checks](next-actions.md) stay open.

## Codex Cloud

For a cloud task, follow [Run APEXREST in Codex Cloud](codex-cloud.md). It provides a pinned CLI bootstrap, setup/maintenance scripts and ORDS HTTPS configuration for a Linux container, including private credentials and proxy/CA handling. Desktop registration and panel instructions below apply to native hosts; the Cloud example uses the CLI.

## Prerequisites

| Requirement                                                    | When it is needed                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Codex with native plugin support                               | Plugin registration; Codex CLI 0.154.0 was exercised on macOS arm64                    |
| Node 24 LTS available on `PATH`                                | Starting the bundled TUI, CLI and MCP runtime                                          |
| Java 21 and reviewed SQLcl 26.1.2                              | Oracle generation, validation, export and import; ORDS needs a JDK with `jdk.compiler` |
| Existing supported Oracle APEX target                          | Connected workflows require APEX 26.1+                                                 |
| Saved direct SQLcl connection or plugin-local ORDS credentials | Authorized access to the configured target through the selected transport              |
| Chromium and relevant test dependencies                        | Browser/API suites; utPLSQL only when a SQL suite requires it                          |

An existing clean APEX installation is enough for ordinary deployment. Service tables, utPLSQL and a provisioned sandbox are not blanket prerequisites for an application-only import. Source installation does not include Oracle binaries, browser credentials or a database account.

## Install from npm

Use Node 24 LTS (supported range: Node 24–26). Install [apexrest](https://www.npmjs.com/package/apexrest) from npm. The stable npm `latest` release is `1.1.0`; the commands below use `latest`. See [release notes](release-notes.md) for distribution and verification status.

Install the CLI globally and check its version:

```sh
npm install -g apexrest
apexrest --version
apexrest
```

The last command opens the terminal menu. Choose **Install tools** for missing dependencies, then **Install plugin** to register APEXREST in Codex. npm installs the CLI and bundled resources; plugin registration is a separate menu action.

For a project-local installation:

```sh
npm install apexrest
npx apexrest --version
npx apexrest
```

`npm install -g apexrest` installs the stable npm `latest` release (1.2.0). To pin a version, use `npm install -g apexrest@1.2.0`, or `npm install -g apexrest@1.3.0-beta.1` for the beta. The repository installation below remains available.

## Install with the terminal menu

With Git and Node 24 LTS on PATH, open the TUI without a local build:

```sh
git clone https://github.com/apexrest-dev/apexrest-codex.git
cd apexrest-codex
node plugins/apexrest-apex/runtime/apexrest.mjs
```

If you already have a checkout, enter it and run only the last command. After making your own source changes, refresh the bundled package with `npm run plugin:sync`.

The home screen shows the APEXREST logo and seven actions:

**SQLcl mode: CLI / MCP** saves the Oracle execution backend: SQLcl CLI or the official SQLcl MCP server (`sql -mcp`). This separate TUI action does not change plugin registration. See [SQLcl modes](tui.md#sqlcl-mode-cli-or-mcp).

| Action                       | Purpose                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Install tools                | Install managed Node.js, Java, SQLcl, Playwright and Chromium.                  |
| Uninstall tools              | Remove recorded managed tools while preserving external runtimes.               |
| Install plugin               | Register the plugin in Codex with the existing runtime and create the launcher. |
| Uninstall plugin             | Remove the managed plugin registration and files.                               |
| List saved SQLcl connections | Show names directly from SQLcl's connection store.                              |
| Test saved SQLcl connection  | Choose a saved connection and check database access.                            |
| SQLcl mode: CLI / MCP        | Choose SQLcl CLI or official SQLcl MCP for new Oracle operations.               |

The APEXlang dashboard on the home screen lists bundled item and component types in a searchable table. Tab switches between actions and the catalogue; type a name or group to filter. Browsing requires no installed tools or database connection. See the [terminal guide](tui.md#apexlang-dashboard).

Choose **Install tools**, read the [Oracle terms](https://www.oracle.com/downloads/licenses/oracle-free-license.html), and enable **Accept Oracle license terms** if you agree. Leave **Skip browser installation** off for browser tools, or enable it to omit them. Ctrl+R opens **Review**, and Enter installs. Browser system-package permission is a separate advanced option.

Then choose **Install plugin** and press Enter on **Review**. This action uses the existing runtime and does not reinstall tools. To choose another Codex profile, package source or managed directory, press Esc and expand options with Ctrl+O. If you installed tools in a custom directory, choose that same **Managed tools directory** for the plugin.

The TUI has no **Preview only** or **Approve changes** toggles: the final Enter executes the action. License and system-package consent remain separate. Read the result and any unfinished actions, restart Codex and start a new task. Next, configure the [launcher on PATH](#use-the-cli) and [test a connection](#connect-and-configure).

## Install the plugin

In a terminal where Node 24 and the Codex CLI are available:

```sh
node --version
codex --version
codex plugin marketplace add apexrest-dev/apexrest-codex
codex plugin add apexrest-apex@apexrest
codex plugin list --json
```

Native plugin installation was verified with Codex 0.154.0, Node 24.21.0 and macOS arm64; the [native installation report](evidence/native-repository.json) records the exact installation source and verification scope.

This registers the repository's `apexrest` marketplace and its `apexrest-apex` plugin in the selected Codex profile. Start a new Codex task after installation, then ask:

> Use APEXREST to check my setup. Call the plugin's doctor and distinguish native tool availability, compiler readiness and database connectivity. Guide me through any missing local setup without requesting passwords in chat.

Verify the actual `apexrest_doctor` result. A successful registration or list entry alone does not prove that MCP started, SQLcl compiles or the target is reachable. The native bundle performs no downloads during MCP startup and needs no manually added global MCP server.

Managed-workspace plugin availability can be restricted by the workspace administrator. The CLI commands above are local native registration, not an organization-wide deployment. See [troubleshooting](troubleshooting.md) if the host does not expose the tools.

### All functions in the Codex plugin menu

Send `Use $apexrest-menu` in the Codex message box. The **All functions** skill displays the menu in the conversation; the plugin does not add a permanent APEXREST sidebar or top-menu button.

To find the installed plugin in the desktop app, open **Plugins**, review the **Installed** list and look for **APEXREST for Codex**. Current [official plugin guidance](https://learn.chatgpt.com/docs/plugins) uses `@` in the message box to select a plugin or bundled skill; search for APEXREST or **All functions**. In Codex CLI, use `/plugins` for plugins and `/skills` or `$` for skills, as described in [official skill guidance](https://learn.chatgpt.com/docs/build-skills). If the picker does not show the entry, send the direct prompt above. After updating a plugin, start a new task; restart Codex if the skill list remains stale. Native discovery of skill labels and prompts does not establish their visible placement in every Codex UI.

The conversational menu routes to every workflow below. Each workflow also has its own readable skill label and starter prompt:

| Menu entry               | Functions                                                                    |
| ------------------------ | ---------------------------------------------------------------------------- |
| APEX work                | Implement and verify a change directly in the current Codex chat             |
| Install dependencies     | Java, SQLcl, Node.js, Playwright and Chromium; preview and offline options   |
| Setup and connections    | Toolchain diagnostics, local connection references and plugin maintenance    |
| Projects                 | Create, adopt and inspect projects                                           |
| APEX applications        | Generate, edit, export, validate and compare applications; Oracle references |
| Database and PL/SQL      | Read metadata, design schema changes and plan migrations                     |
| Deployment and recovery  | Plan, authorized import, status and restore planning                         |
| Tests and browser checks | Configured suites, browser authentication, reports and in-app verification   |
| Diagnostics and jobs     | Troubleshoot failures, inspect/cancel jobs and read artifacts                |
| Review changes           | Source preservation, deployment risk, security and release evidence          |

Open `$apexrest-panel` for project settings and actual Oracle/APEX operations. Use `$apexrest-work` to implement changes directly in the [current chat](chat-workflow.md).

The All functions entry includes the complete CLI operation index. Unsupported sandbox provisioning is explicitly marked unavailable. Opening the menu does not execute its actions. Codex supports up to three plugin-level starter prompts; the full menu and per-skill entries provide access to every workflow. Start a new Codex task after updating the plugin to load the new menu metadata.

### Install dependencies from the plugin menu

Choose **Install dependencies** in the APEXREST plugin's skill menu, or invoke `$apexrest-install-dependencies`. The command offers all client dependencies, Oracle tools without the browser, or a preview only. You can also ask:

> Use $apexrest-install-dependencies to install Java, SQLcl and the other APEXREST client dependencies.

It runs the bundled installer for reviewed Node.js, Java, SQLcl, Playwright and Chromium versions. It previews destinations and downloads, preserves native registration, and verifies the installed tools. Oracle license consent is separate from permission to install dependencies; Codex shows the actual terms when consent is needed. Node must already be available to start the plugin.

From a source checkout, the same dependency-only command is available without a build:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --dry-run --json
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --yes --accept-oracle-license --json
```

Run the second command only after accepting the Oracle terms shown by the preview. Use `--skip-browser` for Oracle tools, `--offline` for cached installation, and `--home` or `--cache-dir` for custom storage. Browser OS package installation requires explicit `--install-os-deps`. Dependencies use `~/.apexrest` by default (or `APEXREST_HOME`); a custom `--home` must also be supplied as `APEXREST_HOME` to later runtime processes. This command does not provision APEX, install utPLSQL, or change database connections. Browser setup problems and missing consent remain visible as unresolved actions.

### Managed runtime installation

The managed installer is an alternative when you want reviewed user-local Node, Java, SQLcl and Playwright setup. From a reviewed source checkout with Node 24:

```sh
git clone https://github.com/apexrest-dev/apexrest-codex.git
cd apexrest-codex
npm ci --ignore-scripts
npm run build
npm run site:build
npm run release:dry-run
```

Open `dist/releases/install-local.txt`, which contains the exact Bash or PowerShell command with the generated archive name and SHA-256. Review that command before running it. `--yes` authorizes technical setup; `--accept-oracle-license` is separate consent to the linked vendor terms. The installer can reuse compatible existing runtimes and writes managed dependencies under `~/.apexrest` by default.

Supported options include `--dry-run`, `--offline`, `--cache-dir`, `--home`, `--codex-home` and `--native-only`. Project-only Codex enablement is blocked on the tested host; a dedicated profile through `--codex-home` is available. `--codex` selects the Codex executable used for registration and removal; on Windows, `.cmd` shims are resolved through `PATH` and `PATHEXT`, and a path or argument containing cmd.exe metacharacters is refused with `UNSAFE_COMMAND_ARGUMENT`. A preview reports an existing tool as `found, not probed` without executing it. The download cache must be owned by the current user and not group/world writable (`UNSAFE_CACHE_DIRECTORY`). No shell profile is edited. Registration uses the same plugin identity, so do not keep competing installations of that identity in different marketplaces or add a duplicate global MCP server.

Setup checks the selected Codex profile before downloading tools. A valid local marketplace containing only the expected APEXREST plugin can be moved into managed installation even without an earlier managed receipt. Preview shows that existing installation and the planned update; `--yes` authorizes applying it. No force flag is required. For a registration-only update using the existing runtime:

```sh
apexrest setup --native-only --dry-run --json
apexrest setup --native-only --yes --json
```

`--native-only` omits tool downloads from both preview and apply. The update retains the previous plugin files and backs up the Codex configuration. A foreign, remote or ambiguous marketplace stays blocked with `MARKETPLACE_OWNERSHIP_CONFLICT`; the diagnostic identifies its root and Codex profile. Review that registration or select another profile through `--codex-home`. If an interrupted update leaves an unknown result, review its saved transition record before retrying. See [registration status](evidence/setup-registration-local.json) for verification scope.

The local packaging command generates unsigned beta artifacts and reports readiness. It does not publish or certify a stable release. `npm run release:dry-run` rebuilds the plugin and site itself and accepts uncommitted changes; `npm run release:package` refuses a dirty working tree. The runtime is one platform-neutral `apexrest-runtime-<version>.zip` archive.

## Connect and configure

Open `$apexrest-panel`, then **Settings → Database network transport**. Choose **Direct Oracle listener** or **ORDS HTTP(S)** and save the SQLcl settings. This preference applies at plugin level to new operations across projects. Under **Connection references**, choose the project's read or deploy reference and configure the selected transport:

- **Direct Oracle listener:** choose a **Saved SQLcl connection** from the local store and select **Save direct connection**. The list loads when Direct settings open; **Refresh saved connections** reloads it. An empty list means you need to save a connection interactively in SQLcl. Errors offer **Retry**; an existing mapping remains available even if SQLcl does not list it.
- **ORDS HTTP(S):** enter the schema's **ORDS schema URL**, your existing Oracle **Database username** and **Database password**, then select **Save ORDS connection**. No separate ORDS account is needed. The schema must permit REST-enabled SQL, and its URL alias can differ from the database username. Use the administrator-provided schema URL, such as `https://ords.example.invalid/ords/app_user/`, rather than an APEX application URL. ORDS selects SQLcl CLI; APEXREST's Codex MCP tools remain available.

ORDS settings are stored locally at plugin level, with the password in a separate private file rather than project configuration or SQLcl's saved connection store. Enter it only in the local dashboard or through CLI `--password-file`; the embedded MCP view does not submit passwords. A blank password preserves it for the same URL and database username; changing either requires a password for the new identity. Switching transports preserves both mappings. See [SQL through ORDS](ords.md) for CLI commands, storage details and import/export verification limits.

For direct connections, the terminal's **List saved SQLcl connections** and **Test saved SQLcl connection** also load the SQLcl store without APEXREST references. Type to search, select with arrow keys and press Enter to test; Ctrl+R refreshes the list. The result shows the database, service and schema or the actual failure. The TUI has no password field.

Equivalent direct-connection commands after configuring the launcher:

```sh
apexrest connection list --saved --json
apexrest connection test 'Development connection' --saved --json
```

Replace `Development connection` with the exact saved name. These `--saved` commands use direct SQLcl connections; test an ORDS reference with `apexrest connection test dev-read --json` after configuring it and selecting ORDS.

For either transport, project deployment requires explicit connection references and target configuration. Use separate read and deploy connections when available. Once both references are configured, give Codex their names and non-secret target identity:

> Configure an APEXREST test environment using the connection references `dev-read` and `dev-deploy`. The workspace is `YOUR_WORKSPACE`, parsing schema `YOUR_SCHEMA`, application ID `YOUR_APPLICATION_ID`, database unique name `YOUR_DB`, service `YOUR_SERVICE`, and application URL `https://your-host.example/ords/r/workspace/app/`. Verify that the read connection matches this identity.

Replace every placeholder with the actual target. Project configuration records connection reference names rather than passwords. No target environment is invented by project initialization. Follow [configuration](configuration.md) for the exact environment schema, private trust policy and test origins.

## Create or adopt a project

For a new app, use a new or existing empty directory and choose the relevant template:

> Use APEXREST to create a blank application in a new `sales-app` project. Configure the identified test target, add a dashboard using real source measures, then complete the plan, authorized import and browser checks.

For an existing app:

> Use APEXREST to initialize an existing-app project in a new `sales-app` directory and adopt the identified test application. Preserve all Oracle IDs, `.apex` metadata, unrelated pages, shared components and authentication. Add the requested dashboard, import it into that same app and verify the result.

To initialize an existing-app project in the current empty folder from the CLI:

```sh
apexrest project init . --template existing-app
```

The project alias uses the actual folder name. Initialization rejects nonempty directories, files and symbolic links to preserve existing data. This command creates local project files; adoption remains a separate operation.

Adoption and export use new local directories and fail if they would overwrite local edits. Preserve the generated Oracle metadata in version control. Subsequent changes should use the existing working source; do not re-adopt the app each time. See [existing applications](existing-app.md).

## Edit, plan, import and verify

The plugin inspects the project and target configuration once, reuses bounded version-aware references and batches related source edits. Planning includes real compiler validation, so a separate identical compilation is usually unnecessary immediately before it.

Review the concrete plan's target and scope. It binds the source, toolchain, current target and history, and expires after 30 minutes. An explicit request to create, update or import an identified development/test app authorizes that necessary scoped import. Codex records the existing authorization for the exact plan and continues without requesting the same permission twice. Unrelated schema writes, authentication changes, other targets and production are outside that scope.

Apply checks fresh identity and drift, makes a verified SQL backup for an existing app, freezes the source and uses durable coordination. Long MCP operations return a job ID; monitor it until completion instead of starting the same operation again. A failed or unknown write outcome requires diagnosis or reconciliation before retrying.

For a page or dashboard, reconcile relevant read-only source queries and inspect the imported behavior in the Codex in-app browser when available. Let asynchronous APEX regions finish loading, then check changed filters, charts, dates and empty states. Run the configured automated suites appropriate to the change. Record manual browser observations separately; an empty suite list does not mean automated tests passed. See [testing](testing.md).

## Use the CLI

Global npm installation provides the `apexrest` command through npm's global `bin` directory on macOS/Linux or its global prefix on Windows; keep that directory on `PATH`. For a project-local installation, use `npx apexrest` from that project. The managed launcher described below is optional for npm users.

Run `apexrest` or `apexrest tui` for the APEXREST logo and seven actions: tool/plugin installation and removal, plus saved SQLcl connection listing/testing. Categories and other workflows are absent from the TUI. See [the terminal guide](tui.md) for controls, direct execution and verification scope. CLI `connection list --saved` and `connection test NAME --saved` access the SQLcl store directly; without `--saved`, existing APEXREST reference behavior is preserved. Explicit commands retain their scripting behavior.

Direct installation with `codex plugin add` exposes the plugin to Codex but does not create the managed `apexrest` launcher. A reviewed source checkout can run its checked-in CLI directly with Node 24:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs doctor --json
node plugins/apexrest-apex/runtime/apexrest.mjs project init ./crm --template customer-crm
```

The TUI's **Install plugin** action and managed setup create `~/.apexrest/bin/apexrest` on macOS/Linux or `apexrest.ps1` and `apexrest.cmd` in the managed `bin` directory on Windows. If the managed home, Node.js or plugin path contains `%`, `!`, `"` or control characters, Windows launcher creation is refused with `UNSAFE_LAUNCHER_PATH`. Installing tools alone does not create this launcher. For the default home on macOS/Linux, add it to the current shell's PATH:

```sh
export PATH="$HOME/.apexrest/bin:$PATH"
apexrest
```

For future shells, add the `export PATH` line to the appropriate shell startup file. APEXREST does not edit it automatically. In PowerShell, invoke the full launcher path:

```powershell
& "$env:USERPROFILE\.apexrest\bin\apexrest.ps1"
```

For a custom managed directory, use its `<home>/bin` path. Without managed installation, `node plugins/apexrest-apex/runtime/apexrest.mjs` from the checkout opens the same menu. If installation did not complete, inspect its result before adding a nonexistent launcher to PATH.

The following examples abbreviate the launcher as `apexrest`; replace it with its full path or the checked-in Node command:

```sh
# Map saved SQLcl connections for the direct transport.
apexrest connection add dev-read --sqlcl-name saved-read-connection
apexrest connection add dev-deploy --sqlcl-name saved-deploy-connection

# These project operations use the selected direct or ORDS transport.
apexrest project inspect --project ./crm --json
apexrest deploy plan --project ./crm --env dev --out plans/dev.json
apexrest deploy apply --project ./crm --plan plans/dev.json
```

Configure `environments.dev`, review and trust the project, and supply the authorized exact-target policy before the target operations. The CRM template includes schema changes and required SQL/E2E suites, so its import needs their applicable authorization and dependencies. For a diagnostics-only compiler run, use `apexrest apex validate --project ./crm --json`.

Command help is available through `--help`; `--help` with an unknown command exits with code 2. Free-text `docs search` queries may span several words without quotes. CLI `apex export` uses `--output`; `deploy plan` uses `--out`. JSON output reports classified results and exit codes. CLI and MCP share the same core checks.

When calling project-scoped MCP tools, pass the absolute application project directory in the `project` argument. The native server starts in its installed plugin directory, so missing or relative project paths are rejected before work starts. CLI examples resolve `--project` from the terminal working directory.

## Remove managed tools and the plugin

Choose **Uninstall tools** or **Uninstall plugin**, then press Enter on **Review**. Tool removal deletes only recorded managed versions; external runtimes, projects, backups, SQLcl connections and download cache are preserved. Node.js needed by the launcher or a recorded plugin installation is retained. Operating-system packages are not removed.

If removing both, uninstall tools first, then the plugin. Removing plugin files also removes the code targeted by the managed launcher. To retain that code after unregistering the plugin, enable **Keep plugin files** in the plugin removal action's advanced options. The checkout's Node command remains a separate entry point.

Equivalent CLI commands to remove both:

```sh
apexrest dependencies uninstall --yes
apexrest plugin uninstall
```

Use the same managed directory and `--home` if you customized it. For direct registration without a managed installation record, use the Codex commands below. Plugin removal holds the installation lock, removes only the plugin directory recorded for that managed home and accepts `--codex` for a specific Codex executable. Uninstalling does not undo database deployments.

## Remove the repository plugin

For the direct repository installation:

```sh
codex plugin remove apexrest-apex@apexrest
codex plugin marketplace remove apexrest
```

Remove the marketplace only when you no longer need its entries. Start a new Codex task after removal. This unregisters the native plugin; it is not a request to delete application projects, backups, SQLcl credentials or durable deployment history. A managed installation has its own `apexrest plugin uninstall` command with ownership checks.

## Next steps

Read [deployment safety](deployment-safety.md) before operating a target, [security](../SECURITY.md) before sharing artifacts and the [verification status](implementation-status.md) before selecting this release for a production workflow. The [documentation index](index.md) links the complete guides and evidence.
