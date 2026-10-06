# Install APEXREST

> The repository is now `apexrest-dev/apexrest` (renamed from `apexrest-codex`; GitHub redirects the old URLs).

Register the plugin in Codex or Claude Code, let it install Java and SQLcl, then connect a target. The repository ships the built bundle under `plugins/apexrest-apex`; ordinary installation requires no TypeScript build. Keep Node.js 24 LTS on `PATH` (supported range: Node 24–26).

## 1. Register the plugin

**Codex** (desktop or CLI with native plugin support):

```sh
codex plugin marketplace add apexrest-dev/apexrest
codex plugin add apexrest-apex@apexrest
codex plugin list --json
```

**Claude Code:**

```sh
claude plugin marketplace add apexrest-dev/apexrest
claude plugin install apexrest@apexrest
claude plugin list
```

For a local checkout (`git clone https://github.com/apexrest-dev/apexrest.git`), pass the checkout path to `marketplace add`. Start a new session after registration: hosts cache the skill and tool catalog. Neither route creates an `apexrest` shell command; see step 3.

## 2. Install Java, SQLcl and browser tools

In the new session, ask the agent to check your setup:

> Use APEXREST to check my setup. Report the compiler, connection and target checks that still need attention.

`$apexrest-setup` runs the doctor and, when tools are missing, the bundled installer. You can also run it yourself from a checkout:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --dry-run --json
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --yes --accept-oracle-license --json
```

Read the preview, including the [Oracle terms](https://www.oracle.com/downloads/licenses/oracle-free-license.html), before the second command; `--accept-oracle-license` records that separate consent. `--skip-browser` omits Playwright and Chromium; `--install-os-deps` is a separate, explicit permission for browser system packages. Tools install under `~/.apexrest` (or `APEXREST_HOME`).

## 3. Optional: the `apexrest` command

The CLI exposes the same operations for scripts and Codex Cloud:

```sh
npm install -g apexrest     # npm latest = 1.3.0; apexrest@1.3.0-beta.1 for the old beta
apexrest --help
```

The published packages still carry the previous surface; from a checkout, `node plugins/apexrest-apex/runtime/apexrest.mjs --help` lists the current commands. Managed installation (`apexrest setup`) also installs the tools, registers Codex and creates `~/.apexrest/bin/apexrest` (or `apexrest.ps1` and `apexrest.cmd` on Windows):

```sh
export PATH="$HOME/.apexrest/bin:$PATH"
apexrest --help
```

The [CLI guide](../../docs/getting-started.md#use-the-cli) covers persistent PATH configuration and the command list. There is no interactive terminal menu.

## 4. Connect a target

```sh
apexrest sqlcl configure --mode cli --database-transport direct --json
apexrest connection list --saved --json
apexrest connection add dev-read --sqlcl-name 'Development connection' --json
apexrest connection test dev-read --json
```

Saved direct connections come from SQLcl's own store; `--saved` lists or tests it without an APEXREST reference. For ORDS over HTTPS, use `connection add --ords-url ... --ords-username ... --password-file PATH` and `sqlcl configure --database-transport ords`; see [SQL through ORDS](../../docs/ords.md). In the conversation, the agent registers references with `apexrest_project` (`connection_add`, `connection_list`, `connection_test`) and never asks for a password in chat. Application work also needs an explicit project environment; follow [Getting started](../../docs/getting-started.md#connect-and-configure). Successful plugin installation alone does not prove database access.

## Codex Cloud

Use the [Cloud setup guide](../../docs/codex-cloud.md) for a repository-backed cloud task. Copy its example scripts into the application repository, configure the environment and Secret, and use the CLI launcher for ORDS HTTPS operations. The example does not register the plugin or verify native Cloud MCP discovery.

## Uninstall

Codex: `codex plugin remove apexrest-apex@apexrest`, then `codex plugin marketplace remove apexrest`. Claude Code: `claude plugin uninstall apexrest@apexrest`, then `claude plugin marketplace remove apexrest`. Managed installations use `apexrest dependencies uninstall --yes` and `apexrest plugin uninstall` (tools first). Projects, backups, saved connections, cache and external runtimes are preserved; see the [removal guide](../../docs/getting-started.md#remove-the-plugin-and-managed-tools).

To remove the globally installed npm CLI, run `npm uninstall -g apexrest`. npm removal does not unregister a plugin or remove managed tools.

## Builds and verification scope

For plugin development or reproducible packaging from the checkout:

```sh
npm ci --ignore-scripts
npm run plugin:sync
npm run site:build
npm run release:dry-run
```

`dist/releases/install-local.txt` contains generated local bundle hashes and Bash/PowerShell installation commands. Packaging does not publish a release. [Implementation status](../../docs/implementation-status.md) separates local fixtures and earlier native checks from unverified live connections and remaining platforms.
