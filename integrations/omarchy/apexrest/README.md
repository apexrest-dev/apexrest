# APEXREST for Omarchy

An [Omarchy](https://omarchy.org/) shell plugin that shows the state of APEXREST on your computer and changes its machine-wide settings from the bar.

It uses the APEXREST runtime you already have. It does not install a second copy, and it never deploys, imports or writes to a database on its own.

## What it shows and changes

The panel has two pages.

**Status**

| Section           | What you see and can do                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime           | Java and SQLcl state and the APEXREST runtime in use. The doctor button runs `apexrest doctor` in a terminal.                                                                                                                                                                                                                                                                                 |
| Current project   | The project an agent last worked in (or a pinned one): APEX profile, uncommitted changes, last deployment, environments with their connection reference. Test a connection (read-only identity query), start a preview, validate with the Oracle compiler, open the agent or a terminal. Ship asks the agent; it appears only for DEV, QA and TEST. Other recent projects are one click away. |
| Local previews    | Every running preview on the computer, with open and stop.                                                                                                                                                                                                                                                                                                                                    |
| Tokens and timing | OpenAI Decisions tokens (total, cached, output) today, in the last seven days and in total, and the average Decisions request time. Then each APEXREST operation run on this computer: runs, average and last duration, failures, maximum and SQLcl share. Coding-agent tokens stay in Omarchy's Agents panel.                                                                                |

**Settings**

| Section           | What you see and can do                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions API     | Switch the default OpenAI Decisions selection on or off. Shows whether the key variable is set in the desktop session, and when the current project's own `decisionApi` overrides the default.        |
| Component catalog | Switch the reference catalog on or off. Shows its size and how often agents searched, read and selected from it today, in the last seven days and in total, and how many selections Decisions ranked. |
| SQLcl             | Choose the backend (CLI or MCP) and the transport (direct or ORDS). Lists connection references and saved SQLcl connections.                                                                          |

The switches call `apexrest settings configure` and `apexrest sqlcl configure`; see [machine-wide settings](../../../docs/configuration.md#machine-wide-settings). Everything else on the panel is a local read.

In the bar, the icon shows `●` while a preview runs and `!` when APEXREST is missing or its runtime is incomplete. Left click opens the panel and middle click refreshes. `omarchy-shell apexrest settings` and `omarchy-shell apexrest status` open a page directly, for example from a key binding.

## Install

You need Omarchy, `jq` and an APEXREST runtime with machine-wide settings. The plugin looks for the runtime in this order:

1. the widget's `apexrestCommand` setting (an `apexrest` executable or an `apexrest.mjs` file);
2. `apexrest` on `PATH` (`npm install -g apexrest`);
3. the newest runtime bundled with the APEXREST plugin for Claude Code or Codex (`~/.claude/plugins/cache/…` or `~/.codex/plugins/cache/…`), run with `node`.

From a clone of this repository:

```sh
integrations/omarchy/install.sh
# or, to use this clone's runtime until your installed plugin is updated:
integrations/omarchy/install.sh --cli "$PWD/plugins/apexrest-apex/runtime/apexrest.mjs"
```

The installer copies the plugin to `~/.config/omarchy/plugins/apexrest` and adds the widget to the right of the bar. It backs up `shell.json` before changing it. Run it again to update; after an update run `omarchy restart shell`, because the shell keeps the previous panel compiled. Remove the plugin with `omarchy plugin remove apexrest`.

## Widget settings

| Key                  | Default | Meaning                                                                                         |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `projectPath`        | empty   | Pin a project folder (with `apexrest.json`) instead of following the project APEXREST last used |
| `apexrestCommand`    | empty   | Runtime override, see above                                                                     |
| `refreshIntervalSec` | `60`    | Status refresh interval. It drops to 10 seconds while the panel is open.                        |

## How it is built

- `manifest.json`: an Omarchy `bar-widget` plugin (id `apexrest`).
- `Panel.qml`: the bar button and panel, built on Omarchy's `Panel`, `KeyboardPanel`, `ButtonGroup`, `ToggleSwitch` and `Button` components. It follows the theme. English only (`i18n/en.json`).
- `Model.js`: parses and bounds the CLI output. All text is shown as plain text.
- `bin/apexrest-omarchy`: the only program the panel runs. It takes fixed subcommands and literal arguments, checks project folders, names, ports and URLs, and prints one JSON line. The status snapshot runs local reads in parallel (about half a second); saved SQLcl connections start SQLcl, so they load only on the Settings page.

Preview logs go to `~/.local/state/apexrest-omarchy/`.

Repository checks: `tests/unit/omarchy-plugin.test.ts` (model and helper against a stub CLI) and `omarchy plugin validate integrations/omarchy/apexrest`.
