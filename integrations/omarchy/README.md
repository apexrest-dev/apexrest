# APEXREST for the Omarchy bar

A bar widget for [Omarchy](https://omarchy.org/) that shows APEXREST at a glance: the APEXREST pencil-and-ruler mark, live local previews, your recent APEXlang projects, and review comments waiting for an agent.

## Install

```sh
integrations/omarchy/install.sh          # copy into ~/.config/omarchy/plugins/apexrest and add it to the bar
integrations/omarchy/install.sh --link   # symlink instead, for working on the widget
python3 -I integrations/omarchy/test_apexrest_omarchy.py   # offline tests
```

It needs Python 3 and the APEXREST CLI. The helper uses `$APEXREST_CLI` if it is set, then the managed `~/.apexrest/bin/apexrest`, then `apexrest` on `PATH`. Remove it with `omarchy plugin remove apexrest` and `rm ~/.local/bin/apexrest-pair`.

## The bar icon

| Looks like           | Means                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dimmed mark          | Nothing running and nothing waiting                                                                                     |
| Green badge, number  | Local previews running                                                                                                  |
| Yellow badge, number | Open review comments in a preview, waiting for an agent                                                                 |
| Blue badge           | A job or deployment is running                                                                                          |
| Red badge, `!`       | Last deployment failed or has an unknown outcome, sync is blocked, an import was interrupted, or the CLI is unavailable |

Click to open the panel. Middle-click to refresh. Key bindings can use `omarchy-shell apexrest toggle` and `omarchy-shell apexrest refresh`.

## The panel

- **Live previews** lists every running preview from `apexrest preview status`: project, port, local SQLite or connected environment, and whether a terminal or an agent session owns it. You can open it in the browser. Previews started from a terminal can also be stopped here. A preview owned by an agent session is stopped from that session.
- **Projects** shows pinned projects first, then the most recently used ones from `~/.apexrest/recent-projects.json`. Each row lists its environments and application IDs, changed files in Git, the last deployment and its age, running jobs, and up to five open review comments. It also shows sync problems such as a blocked sync or an interrupted import. Each project has five shortcuts:
  - start a local preview, or open it if one is already running
  - ✻ Claude Code
  - Codex
  - a terminal
  - the project folder
- **Notifications** report new review comments, finished deployments and failed deployments. A failed deployment tells you to run `deploy status` and reconcile rather than replay the import.

## Pair mode: Codex works, Claude watches

The 󰕘 button on a project row opens one terminal with a tmux session `pair-<project>` split into two panes. You can also run `apexrest-pair start <project>` from any terminal; the installer links it into `~/.local/bin`.

- **Left, Codex.** You give Codex its tasks here, as usual.
- **Right, Claude Code.** Claude starts with [`assets/pair-supervisor.md`](apexrest/assets/pair-supervisor.md) as its role. It runs `apexrest-pair wait` in the background, so it keeps watching while you can still talk to it.
- Each time Codex finishes a turn, asks for approval or reaches a progress checkpoint (every 90 s), Claude reads Codex's screen and the real `git diff`.
- When Codex goes the wrong way, edits the wrong files, loops on an error or breaks a project or deployment rule, Claude sends `apexrest-pair interrupt` (Esc in Codex) and `apexrest-pair say "<correction>"`. Claude tells you in its pane what it saw and what it told Codex.

Claude is pre-approved to run only `apexrest-pair`. Everything else it does goes through its normal permission prompts. It never answers Codex's approval prompts for you; it tells you what Codex is asking and you decide in the left pane. Text in Codex's pane is treated as data, not as instructions to Claude.

Running `start` again reattaches the existing session. Close it with `tmux kill-session -t pair-<project>`.

The supervisor commands, which also work by hand inside the session:

| Command                                                | Does                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apexrest-pair wait [--max S] [--every S] [--lines N]` | Blocks until `turn-finished`, `needs-approval`, `progress`, `settled`, `timeout` or `exited`, then prints Codex's screen |
| `apexrest-pair peek [--lines N]`                       | Prints Codex's screen and its state now                                                                                  |
| `apexrest-pair state`                                  | Prints `working`, `idle`, `approval` or `exited`                                                                         |
| `apexrest-pair interrupt`                              | Presses Esc in Codex                                                                                                     |
| `apexrest-pair say <text>`                             | Types one line into Codex and presses Enter                                                                              |

Codex counts as working while its status line shows "esc to interrupt" and the screen is still changing, because its timer ticks every second. Codex's interface can change between releases. If detection drifts, `peek` still shows the raw screen.

## Safety

The widget only reads state, through `apexrest version`, `preview status`, `panel status` and `preview comments`. Each of these is local and read-only and makes no database call.

The only process it starts on its own is `apexrest preview start --project <path>` without `--env`. That preview runs on Node.js and SQLite and touches no database.

It never plans, applies, restores or imports a deployment. Deployments stay with your agent and its exact plan, backup and DEV/QA/TEST checks.

The helper also checks every action before it runs:

- Open accepts only `http(s)` URLs on `127.0.0.1`, `localhost` or `::1`.
- Start, terminal and folder accept only a project from the last snapshot that still has an `apexrest.json`.
- Stop accepts only a running preview that a terminal owns.

Every string from the CLI is bounded and drawn as plain text. Tooltips have markup removed.

## Settings (`~/.config/omarchy/shell.json`)

```json
{
  "id": "apexrest",
  "refreshIntervalSec": 60,
  "notifications": true,
  "maxProjects": 6,
  "includeTempProjects": false,
  "projects": ["~/Code/my-app"]
}
```

- `refreshIntervalSec` sets how often the widget refreshes. A refresh costs about 0.5 s of local CLI calls. Set it to `0` to refresh only when the panel opens.
- `projects` pins projects to the top of the list.
- `includeTempProjects` also shows agent scratch projects under `/tmp`.

## Files

- `apexrest/manifest.json`: the Omarchy plugin manifest.
- `apexrest/Panel.qml`: the bar widget and panel.
- `apexrest/ApexrestMark.qml`: the APEXREST mark drawn natively from the paths of `plugins/apexrest-apex/assets/apexrest-icon.svg`. The outline follows the bar foreground, so the mark stays readable on dark themes.
- `apexrest/Model.js`: bounded parsing of the snapshot.
- `apexrest/bin/apexrest-omarchy`: the Python helper, standard library only.
- `apexrest/bin/apexrest-pair` and `apexrest/assets/pair-supervisor.md`: pair mode.
- `apexrest/i18n/en.json` and `apexrest/i18n/uk.json`: the strings.
- `apexrest/assets/apexrest-icon.svg`: used for notifications. `install.sh` copies it from the plugin's assets.

After a manual copy, a running shell can keep the old panel; run `omarchy restart shell`. With `--link`, saved edits reload by themselves.
