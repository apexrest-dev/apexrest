# Getting started

This guide takes you from plugin installation to a first change shipped to a development or test Oracle APEX application. It is for anyone who installs APEXREST in Codex or Claude Code for the first time.

You install the plugin, let it install Java and SQLcl, configure a direct SQLcl or ORDS HTTP(S) connection, then describe the change you want in the conversation. The repository and the npm package both include the built runtime, so no Git build, TypeScript compilation or `npm ci` is needed for installation.

## The path at a glance

| Step | What you do                                            | Section                                                                                    |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1    | Confirm the requirements                               | [Prerequisites](#prerequisites)                                                            |
| 2    | Register the plugin in your host                       | [Install in Codex](#install-in-codex) or [Install in Claude Code](#install-in-claude-code) |
| 3    | Ask the agent to check the setup                       | [Check the setup](#check-the-setup)                                                        |
| 4    | Install the missing Oracle tools                       | [Install Java and SQLcl](#install-java-and-sqlcl)                                          |
| 5    | Register connection references and describe the target | [Connect and configure](#connect-and-configure)                                            |
| 6    | Create a new application or adopt an existing one      | [Create or adopt a project](#create-or-adopt-a-project)                                    |
| 7    | Ask for a change; the agent edits, ships and reports   | [Edit, validate, ship and verify](#edit-validate-ship-and-verify)                          |

Two other starting points:

- **Already using APEX 26.2?** Start with [partial imports: update a page and its shared components](apex-26.2.md#quick-start-from-an-updated-checkout). Use the updated checkout runtime and the reviewed 26.2 compiler; the managed dependency installer still defaults to 26.1.
- **Working in a cloud task?** See [Codex Cloud](#codex-cloud).

## Which version this guide describes

This guide describes the current 2.9.0 source bundle, including APEX 26.2 partial imports.

- Install from the source repository for these features.
- Check the version and capabilities of a separately published npm package.
- See [release notes](release-notes.md) and [implementation status](implementation-status.md) for the current scope and qualification requirements.

## Prerequisites

| Requirement                                                    | When it is needed                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Codex with native plugin support, or Claude Code               | Plugin registration and the host-provided browser controls                                         |
| Node 24 LTS on `PATH` (supported range 24–26)                  | Starting the CLI and the MCP runtime                                                               |
| Java 21 and matching SQLcl                                     | 26.1 uses SQLcl 26.1.2; [26.2](apex-26.2.md) uses SQLcl 26.3; ORDS needs a JDK with `jdk.compiler` |
| Existing supported Oracle APEX target                          | APEX 26.1 full imports or qualified APEX 26.2 full/selected-file workflows                         |
| Saved direct SQLcl connection or plugin-local ORDS credentials | Authorized access to the configured target through the selected transport                          |

What you do not need:

- A clean APEX installation is enough for ordinary deployment.
- APEXREST service tables, utPLSQL and a provisioned sandbox are not prerequisites for an application-only import.

What installation does not include: Oracle binaries, browser credentials or a database account.

## Install in Codex

1. Open a terminal where Node 24 and the Codex CLI are available.
2. Run:

   ```sh
   node --version
   codex --version
   codex plugin marketplace add apexrest-dev/apexrest
   codex plugin add apexrest-apex@apexrest
   codex plugin list --json
   ```

3. To find the installed plugin in the desktop app, open **Plugins** and look for **APEXREST for Codex and Claude Code**.
4. To invoke a skill, use `@` in the message box or `$apexrest-work`.

The plugin adds no sidebar or menu button. If the tools are not listed, see [troubleshooting](troubleshooting.md#the-plugin-is-installed-but-tools-are-missing).

## Install in Claude Code

The same bundle carries a Claude Code manifest (`.claude-plugin/plugin.json`, plugin name `apexrest`) and the repository root holds `.claude-plugin/marketplace.json`.

1. Run:

   ```sh
   claude plugin marketplace add apexrest-dev/apexrest
   claude plugin install apexrest@apexrest
   ```

2. Start a new Claude Code session after installation.

| Situation                                         | What to do                                                    |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Install from a local checkout                     | Pass the checkout path to `marketplace add`.                  |
| Try a checkout for one session without installing | Start `claude --plugin-dir <checkout>/plugins/apexrest-apex`. |

The manifest declares the six skills and the MCP server `node ${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs`; no global MCP registration is needed. The `node` on the `PATH` of the shell that starts `claude` must be Node.js 24 or newer.

## Check the setup

In a new session, ask:

> Use APEXREST to check my setup. Report the compiler, connection and target checks that still need attention.

The agent calls `apexrest_status` with `detail: "doctor"`. The doctor:

- probes the host, SQLcl and Java without downloads or database calls;
- reports the SQLcl mode (`cli` or `mcp`) and the database transport (`direct` or `ords`).

What the doctor does not prove:

- A detected tool is not a validated compiler or a live connection.
- A successful registration or plugin listing alone does not prove that the MCP server started.

## Install Java and SQLcl

Missing SQLcl or Java is a reason to install, not to stop. The setup skill (`$apexrest-setup` in Codex, `/apexrest:apexrest-setup` in Claude Code) runs the bundled installer. You can also run it yourself from a checkout or the installed plugin directory:

1. Preview the installation:

   ```sh
   node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --dry-run --json
   ```

2. Read the preview first. It lists versions, destinations, download hosts and the [Oracle terms](https://www.oracle.com/downloads/licenses/oracle-free-license.html).
3. Run the installer only after accepting those terms; `--accept-oracle-license` records that separate consent:

   ```sh
   node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --yes --accept-oracle-license --json
   ```

4. Rerun the doctor afterwards.

| Option                  | Effect                  |
| ----------------------- | ----------------------- |
| `--offline`             | Uses cached downloads.  |
| `--home`, `--cache-dir` | Select managed storage. |

Tools install under `~/.apexrest` (or `APEXREST_HOME`). A custom `--home` must also be set as `APEXREST_HOME` for later CLI and MCP processes.

The installer does not provision APEX, install utPLSQL or change database connections.

### Managed runtime installation and the launcher

`apexrest setup` combines dependency installation with Codex registration and creates the `apexrest` launcher. Direct `codex plugin add` or `claude plugin install` does not create that launcher.

| Platform    | Launcher                          |
| ----------- | --------------------------------- |
| macOS/Linux | `~/.apexrest/bin/apexrest`        |
| Windows     | `apexrest.ps1` and `apexrest.cmd` |

1. From a reviewed checkout, preview and then run the setup:

   ```sh
   node plugins/apexrest-apex/runtime/apexrest.mjs setup --dry-run --json
   node plugins/apexrest-apex/runtime/apexrest.mjs setup --yes --accept-oracle-license --json
   ```

2. Add the launcher to `PATH` for future shells (APEXREST never edits shell startup files):

   ```sh
   export PATH="$HOME/.apexrest/bin:$PATH"
   apexrest --help
   ```

   In PowerShell, invoke `& "$env:USERPROFILE\.apexrest\bin\apexrest.ps1"`.

| Option          | Effect                                                            |
| --------------- | ----------------------------------------------------------------- |
| `--native-only` | Registers the plugin with the existing runtime without downloads. |
| `--codex-home`  | Selects a Codex profile.                                          |
| `--codex`       | Selects the Codex executable.                                     |

A foreign or ambiguous marketplace stays blocked with `MARKETPLACE_OWNERSHIP_CONFLICT`.

`npm install -g apexrest` provides the same command through npm's global `bin` directory.

**Reuse a managed setup in Claude Code.** Managed setup registers Codex only, but its payload contains both host manifests and marketplaces. To reuse it in Claude Code:

1. Add the `native.destination` returned by setup as the marketplace path.
2. Install `apexrest@apexrest`.

Both MCP bindings use the managed Node executable and home; Claude resolves its own cached runtime path. Direct repository installations instead inherit `APEXREST_HOME` from the launching shell.

## Connect and configure

APEXREST stores connection references, not passwords. You choose the SQLcl mode and database transport once per managed home, register connection references, then give the agent the target identity.

The commands below use the `apexrest` command; see [the launcher](#managed-runtime-installation-and-the-launcher).

### Option A: direct Oracle listener

Saved direct connections come from SQLcl's own store; create them interactively in SQLcl first.

```sh
# Direct Oracle listener: map saved SQLcl connections.
apexrest sqlcl configure --mode cli --database-transport direct --json
apexrest connection list --saved --json
apexrest connection add dev-read --sqlcl-name saved-read-connection --json
apexrest connection add dev-deploy --sqlcl-name saved-deploy-connection --json
apexrest connection test dev-read --json
```

- `--saved` lists or tests SQLcl's store without an APEXREST reference.
- `--mode mcp` selects the official SQLcl stdio server (`sql -mcp`) instead of the SQLcl subprocess; existing sessions keep their mode.

### Option B: ORDS over HTTP(S)

Use ORDS HTTP(S) when the listener on port 1521 is unreachable. Use the existing database account and the schema's ORDS URL. The password is read from a private local file (owner-only, not a symlink) and kept at plugin level under `$APEXREST_HOME/credentials/`.

```sh
apexrest connection add dev-read --ords-url https://ords.example.invalid/ords/app_user/ --ords-username app_user --password-file /path/to/local/file --json
apexrest sqlcl configure --mode cli --database-transport ords --json
apexrest connection test dev-read --json
```

ORDS requires `cli` mode. See [SQL through ORDS](ords.md).

### In the conversation

The agent registers references with `apexrest_project` `action:connection_add` (`name` plus `sqlclName`, or `ordsUrl`, `ordsUsername` and `passwordFile`) and checks them with `connection_list` and `connection_test`. It never asks for a password in chat.

### Describe the target environment

Give the agent the non-secret target identity for an environment:

> Configure an APEXREST test environment using the connection references `dev-read` and `dev-deploy`. The workspace is `YOUR_WORKSPACE`, parsing schema `YOUR_SCHEMA`, application ID `YOUR_APPLICATION_ID`, database unique name `YOUR_DB`, service `YOUR_SERVICE`, and application URL `https://your-host.example/ords/r/workspace/app/`. Verify that the read connection matches this identity.

Replace every placeholder with the actual target. No environment is invented by project initialization. Follow [configuration](configuration.md) for the exact environment schema, task authorization and allowed origins described in the [safety rules](deployment-safety.md).

## Create or adopt a project

Choose one of the two routes.

### New application

Name a new or empty directory and a template:

> Use APEXREST to create a blank application in a new `sales-app` project. Configure the identified test target, add a dashboard using real source measures, then ship it to that target and verify it in the browser.

The agent calls `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`). Initialization generates real Oracle sources and rejects nonempty directories.

### Existing application

> Use APEXREST to initialize an existing-app project in a new `sales-app` directory and adopt the identified test application as a working copy. Preserve all Oracle IDs, `.apex` metadata, unrelated pages, shared components and authentication. Add the requested dashboard, ship it into that same app and verify the result.

- Adoption (`action:adopt` with `env`, `appId` and `workingCopy`) exports into a new local directory and fails rather than overwrite local edits.
- Keep the generated Oracle metadata under version control and reuse the working source for later changes; see [existing applications](existing-app.md).
- The CLI equivalents are `apexrest project init DIR --template existing-app` and `apexrest project adopt --env dev --app-id ID --working-copy --json`.

### Review the target

- No manual folder trust list is required.
- An identified DEV/QA/TEST app task authorizes its import.
- Production deploy/restore is forbidden.

Read the [current safety rules](deployment-safety.md) before database work.

## Edit, validate, ship and verify

Describe the change, or invoke the work skill (`$apexrest-work` in Codex, `/apexrest:apexrest-work` in Claude Code). The work skill drives one cycle per change:

1. Inspect the project.
2. Read at most three references.
3. Edit the `.apx` sources.
4. Use one `apexrest_ship mode:apply` call to compile, plan and apply.
5. Report confirmed server completion.
6. Inspect requested pages with the selected browser. Browser checks run only when requested.

Standalone validation is for diagnostics and a separate plan is for explicit review. The steps are listed in the [features page](features.md#work-in-one-session).

### APEX 26.2 partial imports

For an existing qualified APEX 26.2 application:

1. Initialize a sync baseline before editing.
2. Use `importMode:auto` to select eligible changed files, or `importMode:files` with an explicit page/dependency list.
3. Review `importSelection.resolvedMode`, selected files and any full-import reasons before applying.

The [partial-import guide](apex-26.2.md) gives matching CLI plan/apply examples and explains conflicts, backups and readback. APEX 26.1 continues to use full imports.

### Authorization and safety

Your explicit request to create, update or import an identified development/test application is the authorization for the apply step. The agent does not ask the same permission twice.

The runtime:

1. records the request as a deploy grant bound to the exact project, target and plan digest;
2. imports with a checksummed backup of an existing app, and with identity and drift checks;
3. verifies the import;
4. removes the grant.

Limits:

- Plans expire after 30 minutes.
- Unrelated schema writes, authentication changes, other targets and production are outside that scope.
- A failed or unknown write outcome requires diagnosis or reconciliation before any retry; see [deployment safety](deployment-safety.md).

### Verification

- For a page or dashboard, the agent reconciles the read-only sources and confirmed server import.
- It inspects the imported page in the selected browser only when requested.
- Browser observations are recorded separately from compiler and import results.
- Application verification uses the host in-app browser.

See [testing](testing.md).

## Use the CLI

Every MCP operation has a CLI command with `--json` output and the same exit codes. There is no interactive terminal menu.

| Exit code | Meaning              |
| --------- | -------------------- |
| 0         | success              |
| 1         | failed               |
| 2         | input                |
| 3         | dependency           |
| 4         | approval             |
| 5         | conflict             |
| 6         | unknown or cancelled |

| Help command                | Shows                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apexrest --help`           | The commands.                                                                                                |
| `apexrest <command> --help` | Only that command's usage and options, for example `apexrest ship --help` or `apexrest preview stop --help`. |
| `apexrest deploy --help`    | A command group.                                                                                             |

A typical cycle:

```sh
apexrest status --detail doctor --json
apexrest project inspect --project ./crm --detail summary --json
apexrest reference search metric card --corpus components --limit 3 --json
# One ordinary authorized ship call compiles and plans before applying.
apexrest ship --project ./crm --env dev --mode apply --user-request "Add the order status report to the dev app" --json
apexrest job status JOB_ID --wait-seconds 30 --project ./crm --json
# Only when browser verification was requested:
apexrest browser open --project ./crm --env dev --json
```

What the commands do:

- `ship --mode plan` validates with the Oracle compiler, reads the target and writes `.apexrest/plans/ship-<id>.json` for review.
- `--mode apply` and granular deploy/restore refuse production targets.
- The granular commands (`deploy plan|apply|status|restore-plan`, `apex export|generate|sync|diff`, `jobs status|cancel`, `compose plan|materialize`, `status`) remain available.
- `apexrest apex validate --source-dir PATH` compiles any APEXlang folder that holds `application.apx`, also outside a project: it uses the folder's own `.apex/apexlang.json`, else that of the nearest project application, and otherwise fails with `MMD_METADATA_REQUIRED`.
- The CRM template includes schema changes, so its import needs authorization for that schema scope; verify its interactions in the selected browser when requested.

Project paths:

- When calling project-scoped MCP tools, pass the absolute application project directory as `project`: the MCP server starts in its plugin directory and rejects missing or relative paths.
- CLI examples resolve `--project` from the terminal's working directory.

## Codex Cloud

For a cloud task, follow [Run APEXREST in Codex Cloud](codex-cloud.md). It provides a pinned CLI bootstrap, setup/maintenance scripts and ORDS HTTPS configuration for a Linux container. Plugin registration in this guide applies to desktop and CLI hosts; the Cloud example uses the CLI only.

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

Managed installation has its own ownership-checked commands:

| Command                                 | Effect                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apexrest dependencies uninstall --yes` | Removes recorded managed tools while preserving external runtimes, projects, backups, SQLcl connections and the download cache. |
| `apexrest plugin uninstall`             | Removes the managed Codex registration and plugin files (`--keep-runtime` retains them).                                        |

Uninstall tools first when removing both. Start a new session after removal.

Uninstalling never deletes application projects, backups, credentials, deployment history or database deployments.

## Next steps

- Read [deployment safety](deployment-safety.md) before operating a target.
- Read [security](../SECURITY.md) before sharing artifacts.
- Read the [verification status](implementation-status.md) before selecting this build for production work.
- The [documentation index](index.md) links every guide and evidence record.
