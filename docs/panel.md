# Development panel

English | [Українська](panel.uk.md)

Open `$apexrest-panel` in Codex for project settings and actual Oracle/APEX operation state. The skill calls `apexrest_panel_open` with the absolute application directory and opens the returned private local URL inside Codex. Use the application project containing `apexrest.json`, not the plugin source or installed cache. Opening or serving the panel requires that configured project to be listed in the private policy's `trustedProjects`; otherwise it fails with `PROJECT_TRUST_REQUIRED`. Implementation continues in the [current conversation](chat-workflow.md).

```sh
apexrest panel tui --project /absolute/application
apexrest panel status --project /absolute/application --json
apexrest panel open --project /absolute/application --json
```

## Views

| View            | Content                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview        | Project, Git changes, effective Oracle transport and recent operations                                                                         |
| APEX operations | Background jobs, actual nested results, diagnostics, artifacts and durable deployment state; compilation, tests and explicit-environment plans |
| Settings        | Project/environment identity, toolchain, required suites, browser preference, SQLcl CLI/MCP and Direct Oracle listener / ORDS HTTP(S) settings |

The console uses the same snapshot. Choose views with number keys or arrows, scroll with up/down or page keys, refresh with `r`, and exit with `q`. The web view refreshes while visible and preserves focused inputs. Database transport changes affect future operations; do not change them during database work. Job and deployment history lists the newest 2000 records of each kind and reports how many older records were omitted. `panel.status` snapshots are not archived as result artifacts; their complete content travels in the panel UI.

## Connections and browser

Direct Oracle access selects an existing SQLcl saved connection. Opening its settings loads local saved names without a database login; refresh explicitly to read them again. Existing mappings survive an empty list or a transport switch.

ORDS uses the schema URL and the existing database account's username/password. Enter credentials only in the private local panel or CLI `--password-file`. MCP connection actions do not accept passwords. Direct and ORDS mappings are preserved separately. See [ORDS setup](ords.md).

`browserMode: codex|external` selects the verification browser for APEX pages; the development panel stays in Codex. Opening a browser is not verification of behavior.

## Actions and safety

`apexrest_panel_action` accepts allowlisted actions: `preferences`, `connection`, `saved-connections`, `cancel-job`, `validate`, `test`, `browser`, `plan`. Global SQLcl settings, including the MCP restrict level, are not exposed to the model: change them in the authenticated local dashboard or with `apexrest sqlcl configure`. The `sqlcl` action kind is not accepted through MCP or CLI `panel action`. CLI `--action` must be one JSON object; invalid JSON exits with code 2.

```sh
apexrest panel action --project /absolute/application --action '{"kind":"validate"}' --json
```

The panel cannot grant project trust or deployment authorization, or directly apply a plan. Imports use the [deployment workflow](deployment-safety.md). Actual job failure remains failure after normal process exit: job status reports the operation's own `failed`, `outcome_unknown` or `cancelled` outcome. A job whose worker never started is `failed`, not unknown, and needs a new job after its diagnostic is resolved. If a job completed but its recorded result cannot be read, MCP reports `completed_unreadable`; inspect the existing record instead of repeating the operation. A lost heartbeat or mutation response can leave `outcome_unknown`; reconcile before retrying. Cancellation does not undo previous changes.

The server binds to loopback, validates Host/Origin, serves an asset allowlist and requires a private capability for data/actions. Keep the capability URL and session file private. Project trust, target identity, authorization, backup and drift checks remain enforced in the shared core.

[Historical 1.0.0 local evidence](evidence/current-session-100-local.json) records the panel checks for that revision; [catalog evidence](evidence/component-catalog-local.json) records the 1.1.0 addition. Older panel/browser reports retain their original scope and are not screenshots or rendering proof of this interface.
