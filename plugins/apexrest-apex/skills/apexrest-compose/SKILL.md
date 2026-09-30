---
name: apexrest-compose
description: Compose Oracle APEX application source from exact local blocks and explicit entity/API contracts; plan, inspect, materialize, upgrade, detach, remove and recover through reviewed local plans. Excludes live import, setup and Salesforce Apex.
---

# Composer

Work directly in the current Codex chat. Keep context focused: shortlist blocks, read only selected manifests/contracts, and use jobs/artifact windows for full plans. Do not introduce plugin-owned agents, teams, model selection or routing.

1. Inspect the project and its existing application source. Preserve Oracle `.apex`, authentication, authorization and unmanaged source. Use `apexrest_reference_search` with corpus `blocks` or `blueprints`; defaults for other reference searches remain unchanged.
2. Bind reviewed entities, ordered keys, row-read authorization, writable fields, optimistic version, exact API signature and write authorization. Never infer authorization from visible controls or accept client-owned identity. API transactions are caller-owned. The first write adapter accepts one scalar key; composite keys remain modeled and unsupported write operations are blocked.
3. Author `app.blueprint.yaml` using the bundled schema and examples in `references/workflow.md`. Use exact block versions and the pinned compatibility profile. Catalog status is experimental until its own live evidence is available; recipe evidence does not qualify a derived block.
4. Start `apexrest_compose_plan` once. Offline is the default; connected mode requires an explicit configured environment and scoped read-only metadata. Poll its existing job ID with `apexrest_job_status`; inspect the plan artifact in bounded windows. Compile the complete staged application with the real local SQLcl compiler. Compiler failures are failures, not source-only success.
5. Review allocations, contracts, source operations, preimages, effects and diagnostics. Call `apexrest_compose_materialize` with the exact expected digest and either plan path or registered artifact ID. It writes local source/state only. Replan after any blueprint, source, catalog, configuration or toolchain change.
6. Upgrades change an exact version in the blueprint; removal removes the instance and connections; detach sets its ownership to `detached`. All use the same plan/materializer. Modified removal targets and overlapping three-way changes block. Keep generated bases, inspect consumers and resolve conflicts explicitly.
7. An interrupted journal requires an explicit `compose plan --action recover-resume|recover-restore` followed by reviewed materialization. Unknown concurrent bytes must be reconciled manually; cancellation does not imply rollback.

Deployment is a separate user-authorized action through `apexrest-deploy` and the existing policy/identity/backup/drift pipeline. Materialization never imports or executes fixture SQL. Report local compiler checks separately from live metadata, SQL, import and authenticated browser qualification.
