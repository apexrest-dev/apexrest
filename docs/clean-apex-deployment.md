# Deployment without service tables

Supported APEX installations require no APEXREST service tables or setup DDL. Deployment history and coordination are local.

## Implemented

- Plan and apply always use local durable coordination. No APEXREST control table is queried or created; there is no database-backed coordination mode. A legacy `deploymentControl: "local"` in old project files is accepted and ignored; other values are rejected.
- Local migration history records checksums and `started` before SQL execution. Successful migrations are not replayed; changed checksums and unresolved history stop a subsequent plan.
- Local ownership serializes apps sharing a DB/service/parsing schema within one managed home. A dead preparing owner may recover; writing ownership after an unknown outcome requires reconciliation.
- Plans bind the coordination scope and local store identity. Source/target drift, authorization, backups, required tests and restore policy are retained.
- The setup and safety skills state that APEXREST service tables and utPLSQL are not prerequisites, so the agent proceeds with `apexrest_ship` without requesting them for ordinary deployment. utPLSQL is a dependency of SQL suites, not of an application-only deploy.

Local state belongs to `$APEXREST_HOME/deployment-control/` and must persist between runs. Different machines/homes do not share a lock or migration history: the plugin does not provide cross-machine coordination. Use one durable deployment runner/home and serialize independent machines externally (for example a single CI deploy job).

## Verification scope

Local tests cover plan/apply with no control-table calls, persisted migration history, checksum rejection, interrupted-write retention, schema contention, a separate Node runner, dead-owner behavior and store-change rejection. Oracle writes in these tests are explicitly fixtures, not connected deployment evidence. See [testing](testing.md) and [implementation status](implementation-status.md) for local check scope and remaining release gates.

Connected imports, restore, migration failure injection, automated SQL/CRUD suites and independent-machine concurrency require their own integration evidence. Required reports must match the current immutable source before release readiness can pass.
