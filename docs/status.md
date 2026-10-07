# Development status

`apexrest_status` with `detail: "project"` (CLI: `apexrest status --detail project` or `apexrest panel status`) returns one read-only snapshot of the local development state for an application project. `detail: "doctor"` probes the local toolchain instead. The snapshot is plain JSON for the host agent and the CLI. Implementation continues in the [current conversation](chat-workflow.md).

```sh
apexrest status --detail project --project /absolute/application --json
apexrest status --detail doctor --json
```

Use the application project containing `apexrest.json`, not the plugin source or installed cache. An unconfigured directory returns `configured: false` with the global settings only; an untrusted project is reported as `trusted: false` rather than refused, because reading status creates no state and starts nothing.

## Snapshot content

| Field                            | Content                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configuration`, `toolchain`     | Project/environment identity and the toolchain lock digest                                                                                                |
| `sqlcl`, `connections`           | Saved SQLcl execution mode, MCP restrict level, database transport and the plugin-level connection references (no secrets)                                |
| `preferences`                    | `browserMode: host\|codex` for [browser verification](testing.md)                                                                                         |
| `changes`                        | `git status --porcelain` of the project, at most 80 entries; `unavailable` when Git is absent                                                             |
| `sync`                           | Local working-copy sync state per environment; server freshness is `not-checked`                                                                          |
| `jobs`, `deployments`, `history` | The 12 newest job and deployment records with status, phase, diagnostics and artifacts, and how many older records were omitted                           |
| `permissions.activeGrants`       | Unexpired local grants for this project (deploy and test) (operations, expiry, exact-plan flag); grants recorded by `ship` are removed after each attempt |

Job and deployment history considers the newest 2000 records of each kind. Records over 2 MB or unreadable records are listed as `unavailable` so one broken record never hides the rest. Secrets are redacted from every field. The snapshot does not call Oracle, read the SQLcl connection store or verify target identity. A snapshot larger than the inline MCP limit is archived like any other result and readable through `apexrest_artifact_read`.

## What the snapshot cannot do

It cannot change settings, queue jobs, cancel jobs, grant trust or authorization, or apply a plan. Use the explicit operations instead: `apexrest sqlcl configure`, `apexrest_project` (`connection_add`), `apexrest_apex_validate`, `apexrest_ship`, `apexrest_job` (`cancel`) and [`apexrest_browser_open`](testing.md). Imports use the [deployment workflow](deployment-safety.md).

Actual job failure remains failure after normal process exit: a job's reported status is the operation's own `failed`, `outcome_unknown` or `cancelled` outcome. A job whose worker never started is `failed`, not unknown, and needs a new job after its diagnostic is resolved. A lost heartbeat or mutation response can leave `outcome_unknown`; reconcile before retrying. Running jobs carry a `phase` (`validating`, `planning`, `backing_up`, `migrating`, `importing`, `verifying`, `syncing`) that is informative only.

The verification browser preference is read from `.apexrest/panel/preferences.json` (`{"browserMode":"codex"}` by default; `codex` is the legacy alias of `host`). Unknown keys in that file are ignored.
