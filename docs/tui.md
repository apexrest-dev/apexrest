# Terminal interface

English | [Українська](tui.uk.md)

The SQLcl settings action also selects **Direct Oracle listener / ORDS HTTP(S)** for new operations. Configure ORDS credentials in the local dashboard or with CLI `connection add --password-file`; saved SQLcl connection listing applies to direct access. See [ORDS setup](ords.md).

Run `apexrest` or `apexrest tui` in an interactive terminal. The home screen shows the APEXREST logo, an APEXlang dashboard and seven actions, without category menus:

| Action                       | Behavior                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install tools                | Install managed Node.js, Java, SQLcl and browser tools.                                                                                                                       |
| Uninstall tools              | Remove recorded managed tool versions. External runtimes, projects, saved connections and download cache are preserved. Node.js needed by the launcher or plugin is retained. |
| Install plugin               | Install the APEXREST Codex plugin using the existing runtime. Tool installation is a separate action.                                                                         |
| Uninstall plugin             | Remove the managed Codex plugin registration and plugin files; shared tools are preserved.                                                                                    |
| List saved SQLcl connections | Read the local SQLcl connection store and show a searchable list.                                                                                                             |
| Test saved SQLcl connection  | Open the saved-connection picker; Enter tests the selected connection and reads its database identity.                                                                        |
| SQLcl mode: CLI / MCP | Choose SQLcl CLI or official SQLcl MCP for new Oracle operations. |

Project creation, deployment, tests, full reference-document lookup, diagnostics and other workflows remain available through explicit CLI commands and the Codex plugin. They are absent from this TUI. The legacy `tui --project PATH` argument is accepted for compatibility; these seven actions do not use a project.

[Start with terminal installation](getting-started.md#install-with-the-terminal-menu) if `apexrest` is not configured yet. **Install plugin** creates the managed launcher; installing tools alone does not.

## APEXlang dashboard

The home screen also lists supported APEXlang items and components in a table. The current Oracle bundle, `26.1@b94ccf4`, covers **99 types in 9 groups**, including **23 page items**. Groups include page items, regions, buttons, business logic, shared components, template components, page layouts, page examples and workspace components. Names and document counts come from the local reference bundle; no network, SQLcl or database connection is needed.

Press **Tab** to move from actions to the catalogue. Type a name or group, such as `select-list`, `chart` or `shared components`. Up/Down, Page Up/Page Down and Home/End move the selection. Enter in the catalogue runs no action. Esc clears the search or returns focus to actions; Tab switches panels while preserving both searches. Ctrl+R reloads the local catalogue if it is unavailable.

**Docs** counts bundled templates, contracts and guides for that type. The catalogue shows reference coverage, rather than compiler results for every variant on your target: validate generated source with your installed compiler. Wide terminals show actions and the table side by side; standard terminals place the table below actions and expand it when focused with Tab. Smaller screens use a compact scrolling list.

## SQLcl mode: CLI or MCP

Open **SQLcl mode: CLI / MCP**, choose `cli` or `mcp`, then review and press Enter to save. The home screen shows the saved mode. CLI remains the default for existing installations. The setting is private, stored in `$APEXREST_HOME/sqlcl.json` (normally `~/.apexrest/sqlcl.json`), and applies to new Oracle operations from both the CLI and the APEXREST Codex MCP server. Active operations retain their selected mode. No reinstall is required when running the updated runtime. An older installed plugin must be updated to read this setting.

- `cli` runs the SQLcl executable directly with the existing bounded process runner.
- `mcp` starts the **official Oracle SQLcl MCP server** with `sql -mcp`, discovers its tools, connects using the exact saved name when needed, and executes the SQLcl command batch through `sqlcl_run` or the supported legacy name. Each session owns its server and connection. It never retries a failed MCP command through CLI.

```sh
apexrest sqlcl status --json
apexrest sqlcl configure --mode cli --json
apexrest sqlcl configure --mode mcp --json
```

**Advanced options → MCP restrict level** defaults to `4`, using Oracle's default MCP restrictions. Reads, saved connection listing, export and offline validation use this profile. Writes require fail-stop script controls unavailable at level 4; deployment apply rejects this configuration before acquiring ownership or writing. Select `1` explicitly for authorized imports and scripts; it allows scripts but blocks host commands. Choosing a mode or restriction level does not grant database write permission. Existing project trust, target identity, plan, backup and approval checks still apply.

```sh
apexrest sqlcl configure --mode mcp --mcp-restrict-level 1 --json
```

A transport failure, timeout, cancellation or incomplete acknowledgement after a submitted write remains an unknown outcome requiring reconciliation. The client polls a returned background request ID rather than resubmitting the command; unrecognized status envelopes fail closed. MCP mode does not register a second server in Codex. Oracle MCP can write its own `DBTOOLS$MCP_LOG` during connected operations, so an application-level read is not a guarantee of zero database writes. See [Oracle MCP](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/26.1/sqcug/sqlcl-mcp-server.html) and [restriction levels](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.3/sqcug/configuring-restrict-levels-sqlcl-mcp-server.html).

## Saved connections

The picker reads names through SQLcl `connmgr list -flat`. It does not require an APEXREST alias or export credentials. Type to filter, use Up/Down to select, and press Enter to test. Ctrl+R reloads the list; Esc clears the filter or returns to the menu. Both connection actions open this picker.

A test uses the exact saved name with SQLcl CLI `-name` or the official MCP `connect` tool and runs a read-only database identity query. Results show the database, service and schema, or the actual failure. The saved connection must contain working credentials; repair missing credentials in SQLcl. The TUI has no password field. An empty store explains that a connection must first be saved in SQLcl. See [Oracle connection-manager documentation](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/26.1/sqcug/connmgr.html).

Equivalent CLI commands are:

```sh
apexrest connection list --saved --json
apexrest connection test 'Development connection' --saved --json
```

Without `--saved`, the existing CLI behavior continues to use APEXREST connection references.

## Installation and removal

The TUI has no **Preview only** or **Approve changes** toggles. Configure any options, open review and press Enter to install or uninstall directly. That final Enter supplies technical approval (`yes=true`, `dryRun=false`); leaving review performs no action. Plugin installation and tool removal open review immediately; Esc returns to options. Oracle license consent and permission for system packages remain separate and default to off; the tools review shows the Oracle terms link. Ctrl+O expands advanced options. CLI `--dry-run` remains available; it reports an existing tool as `found, not probed` without executing it.

Tool removal deletes only the recorded version under the managed directory. It refuses symbolic links in managed directory ancestors and serializes against managed installation. Node.js is kept when the running process, managed launcher or installation receipt needs it. It does not remove operating-system packages or the SQLcl connection store.

```sh
apexrest dependencies uninstall --dry-run --json
apexrest dependencies uninstall --yes --json
```

If removing both tools and the plugin, uninstall tools first. Removing plugin files removes the managed launcher’s runtime; **Keep plugin files** retains that code after unregistering. The checkout’s Node command remains available. See the [full removal guide](getting-started.md#remove-managed-tools-and-the-plugin).

## Keyboard controls

| Screen      | Controls                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Home        | Tab switches actions/catalogue; Up/Down selects; Enter opens an action; typing searches; Esc clears search or goes back/exits.                                            |
| Form        | Up/Down or Tab selects; Enter edits or toggles; Ctrl+O expands advanced options; Ctrl+R opens review.                 |
| Text editor | Left/Right/Home/End moves; Backspace/Delete removes; Ctrl+U clears; Enter saves; Esc discards.                        |
| Review      | Enter executes; Esc edits; D shows command details.                                                                   |
| Connections | Type to filter; Enter tests; Ctrl+R refreshes; Esc clears filter or returns.                                          |
| Result      | D toggles JSON; Up/Down and Page Up/Page Down scroll; Enter edits or returns to connections; Esc returns to the menu. |

Ctrl+C exits when idle. During execution it requests cancellation and waits for the actual outcome. Exiting restores the normal screen, cursor and input mode. Minimum terminal size is 30 columns by 10 rows; `NO_COLOR` disables colors. Bare invocation in a pipe or `TERM=dumb` prints help; explicit `tui` requires interactive input and output.

## Launcher and verification

From a source checkout, run `node plugins/apexrest-apex/runtime/apexrest.mjs`. Rebuild it with `npm run plugin:sync` after source changes. The local development launcher points to this runtime; no native reinstall is needed for console changes. See [installation](getting-started.md#use-the-cli) for PATH setup.

[Direct-execution evidence](evidence/tui-direct-run-local.json) verifies execution after Enter without preview or approval toggles; removal was exercised only on a disposable tool fixture. [Earlier focused TUI evidence](evidence/tui-focused-local.json) separates automated fixtures, actual Linux terminal execution and the read-only local SQLcl listing. SQLcl test responses in terminal checks are explicit fixtures, not successful Oracle connections. The local store was empty, so no live database connection test was performed. macOS/Windows terminal verification remains open. Earlier TUI evidence describes previous menus.

[APEXlang dashboard verification](evidence/tui-apexlang-dashboard-local.json) records catalogue coverage, navigation and terminal-size checks. These are local TUI checks, not Oracle compilation or native Codex registration evidence.
