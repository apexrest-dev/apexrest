# Adopt an existing application

This page shows how to bring an existing development/test APEX application into local APEXlang sources and keep it synchronized with the server. Use it when the application already exists on the target and you want to edit it from source.

## Before you start

- Create an `existing-app` skeleton.
- Configure the exact existing development/test target and named connections.
- Production deployment is forbidden. See [deployment safeguards](deployment-safety.md).

## Adopt the application

1. Adopt with the working-copy option, or initialize synchronization on an existing matching source tree:

   ```sh
   apexrest project adopt --env dev --app-id ID --working-copy --json
   apexrest apex sync --env dev --action status --json
   # Alternatively, initialize the configured source directory directly:
   apexrest apex sync --env dev --action init --json
   ```

2. Keep `.apex`, Oracle IDs, shared LOVs, authentication and all page files under version control.
3. Edit local sources, then plan and apply. Planning provides compiler, identity, metadata and change evidence.

### The same steps in the conversation

| Step           | Tool call                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Adopt          | `apexrest_project` `action:adopt` (`env`, `appId`, `workingCopy: true`)                                         |
| Synchronize    | `apexrest_apex_sync` (`init`, `status`, `refresh`, `invalidate`)                                                |
| Plan and apply | `apexrest_ship` (`mode:plan`, then `mode:apply` with the same `importMode`, any `files` and the user's request) |

`apex diff` and `apex export` remain CLI-only.

### What the initial operation does

- It creates one APEXlang export reused as its checksummed initial source backup.
- It installs an absent source directory or requires the existing file inventory to match the export exactly.
- A conflict preserves local files and private staging.
- A valid active record is reused without exporting, including after a new process or chat.

### Which import path applies

| Path                                      | Behavior                                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy 26.1 working-copy flow             | Reuses its initial exports and performs full application imports; its initial APEXlang snapshot restores the baseline only.                     |
| [APEX 26.2 partial imports](apex-26.2.md) | Use native selected-page exports or disclosed full APEXlang observation for shared files, scoped APEXlang backups and selected-source readback. |

Frozen intermediate sources remain available for inspection, without automatic rollback. See [deployment safeguards](deployment-safety.md).

## Import a page and its LOV on APEX 26.2

The current source bundle supports `auto`, `files`, `full` and database-only `none` import modes.

### Requirements for a partial import

Partial import requires all of these:

- the existing dev/test application and trusted checkpoint above
- Oracle-exported 26.2 sources
- a compatible 26.2 target
- direct SQLcl CLI transport
- the reviewed SQLcl `26.3.0.260.1620` / MMD `26.2.0+3479` tuple

The transport requirement is inside the runtime; both the `apexrest_ship` MCP tool and the CLI can use partial imports. Select the release/toolchain as described in the [26.2 guide](apex-26.2.md#requirements); do not rewrite `.apex/apexlang.json` to change its release.

### Plan and apply

1. Choose an import mode and create a plan. These are alternative plan commands:

   | Mode    | Use                                                                                                                     |
   | ------- | ----------------------------------------------------------------------------------------------------------------------- |
   | `auto`  | For a page edit, `auto` selects eligible local changes.                                                                 |
   | `files` | To import a page and its changed shared LOV while leaving other local edits pending, use `files` with both exact paths. |
   | `full`  | `full` explicitly selects the whole application.                                                                        |

   ```sh
   apexrest deploy plan --env dev --import-mode auto --out plans/dev.json --json
   apexrest deploy plan --env dev --import-mode files --files pages/p00001-home.apx shared-components/lovs/status.apx --out plans/dev.json --json
   apexrest deploy plan --env dev --import-mode full --out plans/dev.json --json
   ```

2. Review the chosen saved plan's `importSelection` (`requestedMode`, `resolvedMode`, `files`, `dependencies`, `reasons`) and target.
3. Apply it with the required plan-bound authorization:

   ```sh
   apexrest deploy apply --plan plans/dev.json --json
   ```

### How the planner compares sources

The planner compares baseline **B**, local sources **L** and a fresh server export **R**.

- B→L determines local intent; B→R identifies server edits.
- Remote-only edits remain in the effective application.
- Unequal local/server edits to the same component block planning.
- The compiler validates the effective application, so a selected page cannot rely on an unselected new local LOV that is absent on the server.
- Include required changed dependencies explicitly; `dependencies` reports selected shared-component files and does not expand the selection.

### Limits of each mode

- `auto` can resolve to a full plan with reasons for unsupported files, deletions, absent sync/application, transport or database work.
- With a valid 26.2 checkpoint and unchanged application sources, `auto` plans pending migrations or changed packages as database-only work. Applied scripts remain a local no-op. Use `none` to explicitly request database-only planning.
- Observed remote changes must be reconciled before a full fallback, and conflicts never become a full import.
- `files` refuses an ineligible selection without widening it.
- Themes, templates, plug-ins, workspace components, static files/assets and authentication/authorization files are outside this partial-import implementation.
- The existing restrictions on database work and production still apply.

### Backup and readback

- Every partial import retains the selected APEXlang sources as its backup and verifies the selected readback.
- The checkpoint combines verified selected sources with retained local dependency context; unselected local work stays dirty and unrelated remote changes remain untouched.
- A scoped check does not prove unselected server freshness.
- A readback or local-reconciliation failure after a confirmed import requires investigation; it never triggers automatic rollback or retry.

## Legacy working copies and explicit refresh

### One editor per cycle

- The 26.1/full working-copy workflow requires one editor: only this plugin changes the application during the cycle.
- Builder or other external edits require explicit refresh on that path.
- Update metadata can identify possible external changes; unchanged or null values do not prove that every component is unchanged.
- The 26.2 partial planner instead checks a fresh server export as described above.
- For both paths, `status` reads local state and dirty files only and never establishes current server state.
- Export/import timestamps are informational.

### Diff, refresh and invalidate

```sh
apexrest apex diff --env dev --json
apexrest apex diff --env dev --comparison live --json
apexrest apex sync --env dev --action refresh --json
apexrest apex sync --env dev --action invalidate --json
```

| Command               | Behavior                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apex diff`           | An automatic diff compares local file hashes with the latest successful applied snapshot, or the initial baseline before the first import. Its provenance is explicit; it is not complete semantic component coverage. |
| `--comparison live`   | Explicitly exports.                                                                                                                                                                                                    |
| `--action refresh`    | Refuses dirty local sources before any export. On a known clean copy it retains previous sources/backups and installs the new server baseline. It does not merge edits.                                                |
| `--action invalidate` | Preserves sources, backups and journals and cannot clear interrupted or unknown writes.                                                                                                                                |

### Without the working-copy option

- Without the working-copy option, adoption retains its existing one-format export into a new source directory, with `LOCAL_EDITS_CONFLICT` on existing files.
- Manual `apex export --env dev --output review/export-UUID` never activates or advances a working-copy checkpoint.
- Without active sync, deployment and diff retain the full-export path. New apps use that path.
- Reviewed database scripts may accompany a full application import with an active working copy; they follow the local/remote confirmation policy.
- Production deployment is forbidden. A target listed in the administrator's `production-trust.json` is production even if `apexrest.json` says otherwise, so working-copy sync is refused for it.

### Sync state and cleanup

- State is private, ignored `.apexrest/sync/<targetDigest>/state.json`, bound to canonical root, project, environment, target, source directory and toolchain/runtime version.
- Corrupt state/artifacts and unresolved imports block reuse without a hidden export fallback.
- Preserve active baselines, APEXlang and legacy SQL backups, deployment snapshots and coordination history across cleanup.
- Explicit reconciliation may export as exceptional diagnostics and does not authorize retrying writes.

## Related

- [APEX 26.2 partial imports](apex-26.2.md): import modes, requirements, readback and recovery.
- [Deployment safety](deployment-safety.md): authorization, exact plans, backups and interrupted imports.
- [Configuration](configuration.md): environments and connection references.
