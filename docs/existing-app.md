# Adopt an existing application

Create an `existing-app` skeleton and configure the exact existing development/test target and named connections. Adopt with the working-copy option or initialize synchronization on an existing matching source tree:

```sh
apexrest project adopt --env dev --app-id ID --working-copy --json
apexrest apex sync --env dev --action status --json
# Alternatively, initialize the configured source directory directly:
apexrest apex sync --env dev --action init --json
```

In the conversation the same steps are `apexrest_project` `action:adopt` (`env`, `appId`, `workingCopy: true`), `apexrest_apex_sync` (`init`, `status`, `refresh`, `invalidate`) and `apexrest_ship` (`mode:plan`, then `mode:apply` with the same `importMode`, any `files` and the user's request); `apex diff` and `apex export` remain CLI-only.

The initial operation creates one APEXlang export and one SQL backup. It installs an absent source directory or requires the existing file inventory to match the export exactly. A conflict preserves local files and private staging. A valid active record is reused without exporting, including after a new process or chat. Keep `.apex`, Oracle IDs, shared LOVs, authentication and all page files under version control.

Edit local sources, then plan and apply. Planning provides compiler, identity, metadata and change evidence. The legacy 26.1 working-copy flow reuses its initial exports and performs full application imports; its initial SQL copy restores the baseline only. [APEX 26.2 partial imports](apex-26.2.md) use fresh server exports, a fresh full SQL backup and a verified server checkpoint for each selected-file import. Frozen intermediate sources remain available for inspection, without automatic rollback. See [deployment safeguards](deployment-safety.md).

## Import a page and its LOV on APEX 26.2

The current source bundle supports `auto`, `files` and `full` import modes. Partial import requires the existing dev/test application and trusted checkpoint above, Oracle-exported 26.2 sources, a compatible 26.2 target, direct SQLcl CLI transport, and the reviewed SQLcl `26.3.0.260.1620` / MMD `26.2.0+3479` tuple. The transport requirement is inside the runtime; both the `apexrest_ship` MCP tool and the CLI can use partial imports. Select the release/toolchain as described in the [26.2 guide](apex-26.2.md#requirements); do not rewrite `.apex/apexlang.json` to change its release.

For a page edit, `auto` selects eligible local changes. To import a page and its changed shared LOV while leaving other local edits pending, use `files` with both exact paths. `full` explicitly selects the whole application. These are alternative plan commands:

```sh
apexrest deploy plan --env dev --import-mode auto --out plans/dev.json --json
apexrest deploy plan --env dev --import-mode files --files pages/p00001-home.apx shared-components/lovs/status.apx --out plans/dev.json --json
apexrest deploy plan --env dev --import-mode full --out plans/dev.json --json
```

Review the chosen saved plan's `importSelection` (`requestedMode`, `resolvedMode`, `files`, `dependencies`, `reasons`) and target before applying it with the required plan-bound authorization:

```sh
apexrest deploy apply --plan plans/dev.json --json
```

The planner compares baseline **B**, local sources **L** and a fresh server export **R**. B→L determines local intent; B→R identifies server edits. Remote-only edits remain in the effective application, and unequal local/server edits to the same component block planning. The compiler validates the effective application, so a selected page cannot rely on an unselected new local LOV that is absent on the server. Include required changed dependencies explicitly; `dependencies` reports selected shared-component files and does not expand the selection.

`auto` can resolve to a full plan with reasons for unsupported files, deletions, absent sync/application, transport or database work. Observed remote changes must be reconciled before a full fallback, and conflicts never become a full import. `files` refuses an ineligible selection without widening it. Themes, templates, plug-ins, workspace components, static files/assets and authentication/authorization files are outside this partial-import implementation. The existing restrictions on database work and production still apply.

Every partial import takes a fresh full SQL backup and verifies the complete re-exported application. The actual verified server export becomes the checkpoint; unselected local work stays dirty, and remote-only edits are reconciled into the local tree. A readback or local-reconciliation failure after a confirmed import requires investigation; it never triggers automatic rollback or retry.

## Legacy working copies and explicit refresh

The 26.1/full working-copy workflow requires one editor: only this plugin changes the application during the cycle. Builder or other external edits require explicit refresh on that path. Update metadata can identify possible external changes; unchanged or null values do not prove that every component is unchanged. The 26.2 partial planner instead checks a fresh server export as described above. For both paths, `status` reads local state and dirty files only and never establishes current server state. Export/import timestamps are informational.

```sh
apexrest apex diff --env dev --json
apexrest apex diff --env dev --comparison live --json
apexrest apex sync --env dev --action refresh --json
apexrest apex sync --env dev --action invalidate --json
```

An automatic diff compares local file hashes with the latest successful applied snapshot, or the initial baseline before the first import. Its provenance is explicit; it is not complete semantic component coverage. `--comparison live` explicitly exports. Refresh refuses dirty local sources before any export. On a known clean copy it retains previous sources/backups and installs the new server baseline. It does not merge edits. Invalidate preserves sources, backups and journals and cannot clear interrupted or unknown writes.

Without the working-copy option, adoption retains its existing one-format export into a new source directory, with `LOCAL_EDITS_CONFLICT` on existing files. Manual `apex export --env dev --output review/export-UUID` never activates or advances a working-copy checkpoint. Without active sync, deployment and diff retain the full-export path. New apps use that path. Reviewed database scripts may accompany a full application import with an active working copy; they follow the local/remote confirmation policy. Production deployment is forbidden. A target listed in the administrator's `production-trust.json` is production even if `apexrest.json` says otherwise, so working-copy sync is refused for it.

State is private, ignored `.apexrest/sync/<targetDigest>/state.json`, bound to canonical root, project, environment, target, source directory and toolchain/runtime version. Corrupt state/artifacts and unresolved imports block reuse without a hidden export fallback. Preserve active baselines, SQL backups, deployment snapshots and coordination history across cleanup. Explicit reconciliation may export as exceptional diagnostics and does not authorize retrying writes.
