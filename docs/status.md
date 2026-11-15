# Development status

The development status is one read-only snapshot of the local development state for an application project. Use it to see configuration, connections, pending changes, jobs and deployment history before you continue work in the [current conversation](chat-workflow.md).

## Read the status

| Request                                 | Tool call                                  | CLI                                                           |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Snapshot of the local development state | `apexrest_status` with `detail: "project"` | `apexrest status --detail project` or `apexrest panel status` |
| Probe of the local toolchain instead    | `apexrest_status` with `detail: "doctor"`  | `apexrest status --detail doctor`                             |

```sh
apexrest status --detail project --project /absolute/application --json
apexrest status --detail doctor --json
```

- The snapshot is plain JSON for the host agent and the CLI.
- Use the application project containing `apexrest.json`, not the plugin source or installed cache.
- An unconfigured directory returns `configured: false` with the global settings only.
- There is no folder trust classification; reading status creates no state and starts nothing.

## Snapshot content

| Field                            | Content                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configuration`, `toolchain`     | Project/environment identity and the toolchain lock digest                                                                                         |
| `sqlcl`, `connections`           | Saved SQLcl execution mode, MCP restrict level, database transport and the plugin-level connection references (no secrets)                         |
| `preferences`                    | `browserMode: host\|codex` for [browser verification](testing.md)                                                                                  |
| `changes`                        | `git status --porcelain` of the project, at most 80 entries; `unavailable` when Git is absent                                                      |
| `sync`                           | Local working-copy sync state per environment; server freshness is `not-checked`                                                                   |
| `jobs`, `deployments`, `history` | The 12 newest job and deployment records with status, phase, diagnostics and artifacts, and how many older records were omitted                    |
| `permissions.activeGrants`       | Unexpired local deployment grants for this project (operations, expiry, exact-plan flag); grants recorded by `ship` are removed after each attempt |

Details of the snapshot:

- Job and deployment history considers the newest 2000 records of each kind.
- Records over 2 MB or unreadable records are listed as `unavailable` so one broken record never hides the rest.
- Secrets are redacted from every field.
- A snapshot larger than the inline MCP limit is archived like any other result and readable through `apexrest_artifact_read`.
- The verification browser preference is read from `.apexrest/panel/preferences.json` (`{"browserMode":"codex"}` by default; `codex` is the legacy alias of `host`). Unknown keys in that file are ignored.

### Job status and phase

- Actual job failure remains failure after normal process exit: a job's reported status is the operation's own `failed`, `outcome_unknown` or `cancelled` outcome.
- A job whose worker never started is `failed`, not unknown, and needs a new job after its diagnostic is resolved.
- A lost heartbeat or mutation response can leave `outcome_unknown`; reconcile before retrying.
- Running jobs carry a `phase` (`validating`, `planning`, `backing_up`, `migrating`, `importing`, `verifying`, `syncing`) that is informative only.

## What the snapshot cannot do

The snapshot does not call Oracle, read the SQLcl connection store or verify target identity.

It cannot change settings, queue jobs, cancel jobs, grant authorization, or apply a plan. Use the explicit operations instead:

- `apexrest sqlcl configure`
- `apexrest_project` (`connection_add`)
- `apexrest_apex_validate`
- `apexrest_ship`
- `apexrest_job` (`cancel`)
- [`apexrest_browser_open`](testing.md)

Imports use the [deployment workflow](deployment-safety.md).
