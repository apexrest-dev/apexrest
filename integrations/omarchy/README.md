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

| Looks like           | Means                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dimmed mark          | Nothing running and nothing waiting                                                                                           |
| Green badge, number  | Local previews running                                                                                                        |
| Yellow badge, number | Open review comments in a preview, waiting for an agent, or a pair session needs you (held review, permission, failed review) |
| Blue badge           | A job or deployment is running, or Claude or Codex is working in a pair session                                               |
| Red badge, `!`       | Last deployment failed or has an unknown outcome, sync is blocked, an import was interrupted, or the CLI is unavailable       |

Click to open the panel. Middle-click to refresh. Key bindings can use `omarchy-shell apexrest toggle` and `omarchy-shell apexrest refresh`.

## The panel

- **Live previews** lists every running preview from `apexrest preview status`: project, port, local SQLite or connected environment, and whether a terminal or an agent session owns it. You can open it in the browser. Previews started from a terminal can also be stopped here. A preview owned by an agent session is stopped from that session.
- **Projects** shows pinned projects first, then the most recently used ones from `~/.apexrest/recent-projects.json`. Each row lists its environments and application IDs, changed files in Git, the last deployment and its age, running jobs, and up to five open review comments. It also shows sync problems such as a blocked sync or an interrupted import. Each project has seven shortcuts:
  - start a local preview, or open it if one is already running
  - 󰏌 run the deployed application in APEX, in your browser (`<ORDS base>/f?p=<app id>` of the DEV environment, else TEST, else QA). It only opens the URL: no deploy, no database call
  - 󰕘 pair mode: start it, or reopen the running session (the icon turns green)
  - ✻ Claude Code
  - Codex
  - a terminal
  - the project folder
- **Pair sessions** are shown inside their project's row, so a project is never listed twice. A session for a folder that is not in the project list gets its own **Pair sessions** section. It shows whether Claude is working, idle or waiting for your permission, the turn number, Codex's review state and its latest notes. The buttons send a held review to Claude (󰒊, shown only when one is held), open the session (in a project row, the project's green 󰕘 button does this), ask Codex to review now, pause or resume reviews, and end the session. Ending takes two clicks, because it also closes Claude. The list refreshes every 4 s while the panel is open and every 15 s otherwise. It reads local state files only and makes no CLI call.
- **Notifications** report new review comments, finished deployments and failed deployments. A failed deployment tells you to run `deploy status` and reconcile rather than replay the import. In pair mode they also report a Codex review that is held for you and a Codex review that failed.

## Pair mode: Claude works, Codex reviews

The 󰕘 button on a project row opens one terminal with a tmux session `pair-<project>`. You can also run `apexrest-pair start <project>` from any terminal. The installer links the command into `~/.local/bin`.

- **One console.** You talk to Claude Code as usual. It is the main agent and does the work.
- **Codex reviews in the background.** When Claude finishes a turn, Codex reads what Claude did, taken from Claude's own transcript. It also runs `git diff` and reads files in a read-only sandbox (`codex exec -s read-only`). While Claude is still editing files, Codex also reviews at a checkpoint every 150 s.
- **Notes land in the same console.** If Codex finds a bug, a missed requirement, an unsafe step or a clear improvement, it types one line into Claude's console: `[Codex review] (1) avg.js:2 returns Infinity for one element ...`. You and Claude both see it. Claude checks each note against the code, fixes the real problems and says in one line why it rejects the others. When there is nothing worth saying, Codex stays silent.

A Codex note is never permission. Claude's role prompt ([`assets/pair-main.md`](apexrest/assets/pair-main.md)) says your instructions and the project rules always win. Codex's role prompt ([`assets/pair-reviewer.md`](apexrest/assets/pair-reviewer.md)) asks only for issues worth an interruption, not style nits.

The reviewer never types while Claude is asking for your permission or shows a dialog, or within 6 s of your last key press. It sends at most two automatic messages per prompt of yours, so Claude and Codex cannot argue in a loop. After that, or when it could not type, the note is held and the status line says `held (send)`.

The bar widget lists the session with the same controls (see [The panel](#the-panel)). The session looks like one console: the tmux status line says `✻ Claude works · 󰚩 Codex reviews` on the left and shows Codex's state on the right: `◉ watching`, `⟳ reviewing`, `✓` no notes, `✎` notes sent, `✎ notes wait: <reason>` (for example while a Claude menu is open), `⏸` paused. Codex runs only while it reviews, so there is no Codex window to look at. The reviewer's log is in a hidden `codex-review` window (prefix + `w`), or run `!apexrest-pair log`. Run the commands from Claude's composer with a `!` prefix, for example `!apexrest-pair pause`:

| Command                    | Does                                       |
| -------------------------- | ------------------------------------------ |
| `apexrest-pair status`     | Reviewer state, last notes, held review    |
| `apexrest-pair log`        | Codex's review log                         |
| `apexrest-pair review`     | Ask Codex to review the latest turn now    |
| `apexrest-pair pause`      | Stop automatic reviews (`resume` restarts) |
| `apexrest-pair send`       | Pass a held review on to Claude            |
| `apexrest-pair say <text>` | Type a line into Claude's console          |
| `apexrest-pair stop`       | End the session                            |

`start` reads these settings from the environment: `APEXREST_PAIR_EVERY` (checkpoint seconds, default 150), `APEXREST_PAIR_ROUNDS` (automatic messages per prompt, default 2), `APEXREST_PAIR_REVIEW=changes` (review only turns that edited files), `APEXREST_PAIR_MODEL` (Codex model for reviews, default `gpt-6.2-sol`) and `APEXREST_PAIR_EFFORT` (reasoning effort, default `high`). The reviewer passes them to `codex exec` explicitly, so it does not depend on your global Codex default. The hooks are passed to this Claude session only, with `--settings`; your own Claude settings are not changed. Running `start` again reattaches. Close the session with `tmux kill-session -t pair-<project>`.

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
- `apexrest/bin/apexrest-pair`, `apexrest/assets/pair-main.md` and `apexrest/assets/pair-reviewer.md`: pair mode.
- `apexrest/i18n/en.json` and `apexrest/i18n/uk.json`: the strings.
- `apexrest/assets/apexrest-icon.svg`: used for notifications. `install.sh` copies it from the plugin's assets.

After a manual copy, a running shell can keep the old panel; run `omarchy restart shell`. With `--link`, saved edits reload by themselves.
