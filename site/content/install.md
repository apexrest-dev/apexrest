# Install APEXREST

This page installs APEXREST in Codex or Claude Code and connects it to a target. Follow the four numbered steps in order: register the plugin, let it install Java and SQLcl, optionally add the `apexrest` command, then connect a target.

## Before you start

- Keep Node.js 24 LTS on `PATH` (supported range: Node 24–26).
- The repository ships the built bundle under `plugins/apexrest-apex`; ordinary installation requires no TypeScript build.

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

Then:

- Start a new session after registration: hosts cache the skill and tool catalog.
- For a local checkout (`git clone https://github.com/apexrest-dev/apexrest.git`), pass the checkout path to `marketplace add`.
- Neither route creates an `apexrest` shell command; see step 3.

## 2. Install Java and SQLcl

1. In the new session, ask the agent to check your setup:

   > Use APEXREST to check my setup. Report the compiler, connection and target checks that still need attention.

2. The setup skill (`$apexrest-setup` in Codex, `/apexrest:apexrest-setup` in Claude Code) runs the doctor and, when tools are missing, the bundled installer.

You can also run the installer yourself from a checkout:

```sh
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --dry-run --json
node plugins/apexrest-apex/runtime/apexrest.mjs dependencies install --yes --accept-oracle-license --json
```

- Read the preview, including the [Oracle terms](https://www.oracle.com/downloads/licenses/oracle-free-license.html), before the second command; `--accept-oracle-license` records that separate consent.
- Tools install under `~/.apexrest` (or `APEXREST_HOME`).
- The managed SQLcl default is for 26.1; select the reviewed SQLcl 26.3 compiler separately for [26.2 partial imports](../../docs/apex-26.2.md#requirements).
- Application verification uses the host in-app browser.

## 3. Optional: the `apexrest` command

The CLI exposes the same operations for scripts and Codex Cloud. There is no interactive terminal menu. Choose one way to get the command:

| Way                                     | What it gives you                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm install -g apexrest`               | The `apexrest` command. Check the installed npm version for feature compatibility.                                                 |
| Managed installation (`apexrest setup`) | Also installs the tools, registers Codex and creates `~/.apexrest/bin/apexrest` (or `apexrest.ps1` and `apexrest.cmd` on Windows). |
| Current checkout runtime                | `node plugins/apexrest-apex/runtime/apexrest.mjs --help`. Use it for the [26.2 partial-import workflow](../../docs/apex-26.2.md).  |

With npm:

```sh
npm install -g apexrest
apexrest --help
```

With managed installation, add the launcher to `PATH`:

```sh
export PATH="$HOME/.apexrest/bin:$PATH"
apexrest --help
```

The [CLI guide](../../docs/getting-started.md#use-the-cli) covers persistent PATH configuration and the command list.

## 4. Connect a target

For a direct connection:

```sh
apexrest sqlcl configure --mode cli --database-transport direct --json
apexrest connection list --saved --json
apexrest connection add dev-read --sqlcl-name 'Development connection' --json
apexrest connection test dev-read --json
```

- Saved direct connections come from SQLcl's own store; `--saved` lists or tests it without an APEXREST reference.
- For ORDS over HTTPS, use `connection add --ords-url ... --ords-username ... --password-file PATH` and `sqlcl configure --database-transport ords`; see [SQL through ORDS](../../docs/ords.md).
- In the conversation, the agent registers references with `apexrest_project` (`connection_add`, `connection_list`, `connection_test`) and never asks for a password in chat.
- Application work also needs an explicit project environment; follow [Getting started](../../docs/getting-started.md#connect-and-configure).

Successful plugin installation alone does not prove database access.

## Codex Cloud

Use the [Cloud setup guide](../../docs/codex-cloud.md) for a repository-backed cloud task:

1. Copy its example scripts into the application repository.
2. Configure the environment and Secret.
3. Use the CLI launcher for ORDS HTTPS operations.

The example does not register the plugin or verify native Cloud MCP discovery.

## Uninstall

| Installation   | Commands                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------- |
| Codex          | `codex plugin remove apexrest-apex@apexrest`, then `codex plugin marketplace remove apexrest` |
| Claude Code    | `claude plugin uninstall apexrest@apexrest`, then `claude plugin marketplace remove apexrest` |
| Managed        | `apexrest dependencies uninstall --yes` and `apexrest plugin uninstall` (tools first)         |
| Global npm CLI | `npm uninstall -g apexrest`                                                                   |

- Projects, backups, saved connections, cache and external runtimes are preserved; see the [removal guide](../../docs/getting-started.md#remove-the-plugin-and-managed-tools).
- npm removal does not unregister a plugin or remove managed tools.

## Builds and verification scope

For plugin development or reproducible packaging from the checkout:

```sh
npm ci --ignore-scripts
npm run plugin:sync
npm run site:build
npm run release:dry-run
```

- `dist/releases/install-local.txt` contains generated local bundle hashes and Bash/PowerShell installation commands.
- Packaging does not publish a release.
- [Implementation status](../../docs/implementation-status.md) describes local checks and the required connected, host and platform qualification.
