# Deployment without service tables

Supported APEX installations require no APEXREST service tables or setup DDL. Deployment history and coordination are local. Read this page if you deploy from more than one machine or want to know where that local state lives.

## Before you start

- Local state belongs to `$APEXREST_HOME/deployment-control/` and must persist between runs.
- Different machines/homes do not share a lock or migration history: the plugin does not provide cross-machine coordination.
- Use one durable deployment runner/home and serialize independent machines externally (for example a single CI deploy job).

## Implemented

| Area              | Behavior                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordination mode | Plan and apply always use local durable coordination. No APEXREST control table is queried or created; there is no database-backed coordination mode.                                                |
| Legacy setting    | A legacy `deploymentControl: "local"` in old project files is accepted and ignored; other values are rejected.                                                                                       |
| Migration history | Local migration history records checksums and `started` before SQL execution. Successful migrations are not replayed; changed checksums and unresolved history stop a subsequent plan.               |
| Ownership         | Local ownership serializes apps sharing a DB/service/parsing schema within one managed home. A dead preparing owner may recover; writing ownership after an unknown outcome requires reconciliation. |
| Plans             | Plans bind the coordination scope and local store identity. Source/target drift, authorization, backups, readback verification and restore policy are retained.                                      |
| Agent skills      | The setup and safety skills state that APEXREST service tables are not prerequisites, so the agent proceeds with `apexrest_ship` without requesting them for ordinary deployment.                    |

## Verification scope

### Covered by local tests

Local tests cover:

- plan/apply with no control-table calls
- persisted migration history
- checksum rejection
- interrupted-write retention
- schema contention
- a separate Node runner
- dead-owner behavior
- store-change rejection

Oracle writes in these tests are explicitly fixtures, not connected deployment evidence. See [testing](testing.md) and [implementation status](implementation-status.md) for local check scope and remaining release gates.

### Not covered

These require their own integration evidence:

- connected imports
- restore
- migration failure injection
- authenticated host-browser interactions
- independent-machine concurrency

Required reports must match the current immutable source before release readiness can pass.

## Related

- [Deployment safety](deployment-safety.md#backups-and-coordination): the canonical rules for backups, coordination and recovery.
- [Configuration](configuration.md#deployment-coordination): the coordination settings in a project.
