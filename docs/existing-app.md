# Adopt an existing application

Create an `existing-app` skeleton and configure the exact existing development/test target and named connections. For a single-editor application, adopt with the working-copy option or initialize synchronization on an existing matching source tree:

```sh
apexrest project adopt --env dev --app-id ID --working-copy --json
apexrest apex sync --env dev --action status --json
# Alternatively, initialize the configured source directory directly:
apexrest apex sync --env dev --action init --json
apexrest deploy plan --env dev --out plans/dev.json --json
apexrest deploy apply --plan plans/dev.json --json
```

In the conversation the same steps are `apexrest_project` `action:adopt` (`env`, `appId`, `workingCopy: true`), `apexrest_apex_sync` (`init`, `status`, `refresh`, `invalidate`) and `apexrest_ship` (`mode:plan`, then `mode:apply` with the user's request); `apex diff` and `apex export` remain CLI-only.

The initial operation creates one APEXlang export and one SQL backup. It installs an absent source directory or requires the existing file inventory to match the export exactly. A conflict preserves local files and private staging. A valid active record is reused without exporting, including after a new process or chat. Keep `.apex`, Oracle IDs, shared LOVs, authentication and all page files under version control.

Edit local sources, then plan and apply. Planning provides compiler, identity, metadata and change evidence. Repeated working-copy plan/apply performs no full exports, including fingerprint or backup exports; imports remain full application imports. The initial SQL copy restores the baseline only. Frozen intermediate applied sources remain available for inspection, without automatic rollback to each import. See [deployment safeguards](deployment-safety.md).

The user chooses one editor: only this plugin changes the application during the cycle. Builder or other external edits require explicit refresh. Update metadata can identify possible external changes; unchanged or null values do not prove that every component is unchanged. `status` reads local state and dirty files only, and never establishes current server state. Export/import timestamps are informational.

```sh
apexrest apex diff --env dev --json
apexrest apex diff --env dev --comparison live --json
apexrest apex sync --env dev --action refresh --json
apexrest apex sync --env dev --action invalidate --json
```

An automatic diff compares local file hashes with the latest successful applied snapshot, or the initial baseline before the first import. Its provenance is explicit; it is not complete semantic component coverage. `--comparison live` explicitly exports. Refresh refuses dirty local sources before any export. On a known clean copy it retains previous sources/backups and installs the new server baseline. It does not merge edits. Invalidate preserves sources, backups and journals and cannot clear interrupted or unknown writes.

Without the working-copy option, adoption retains its existing one-format export into a new source directory, with `LOCAL_EDITS_CONFLICT` on existing files. Manual `apex export --env dev --output review/export-UUID` never activates or advances a working-copy checkpoint. Without active sync, deployment and diff retain the full-export path. Production, new apps, database migrations and package execution use that path; explicitly invalidate before database operations. A target listed in the administrator's `production-trust.json` is production even if `apexrest.json` says otherwise, so working-copy sync is refused for it.

State is private, ignored `.apexrest/sync/<targetDigest>/state.json`, bound to canonical root, project, environment, target, source directory and toolchain/runtime version. Corrupt state/artifacts and unresolved imports block reuse without a hidden export fallback. Preserve active baselines, SQL backups, deployment snapshots and coordination history across cleanup. Explicit reconciliation may export as exceptional diagnostics and does not authorize retrying writes.

[Local regression evidence](evidence/working-copy-local.json) counts real sync/plan/apply code at a fake Oracle boundary. Connected baseline + three edits with restart, authenticated browser acceptance and a separate initial restore scenario are NOT RUN: no development target was authorized. Release preservation checks for components/static files/MMD, no-op imports and unsupported components retain their separate scope; fixtures are not live Oracle proof.
