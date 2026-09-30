---
name: apexrest-deploy
description: Complete authorized APEXREST application imports with validation, target identity, backup, scoped policy and runtime verification.
---

Pass the user's absolute workspace as `project` on project-scoped calls.
Create a plan for an explicit environment. Deploy works on a clean supported APEX installation: service tables are not prerequisites. Default to local durable migration history and schema coordination under APEXREST_HOME; do not request table creation to unblock normal deploy. The optional environment deploymentControl=database mode uses explicitly provisioned tables only when selected by the user.

Explain exact app target, source digest, coordination backend/scope, risks, backup and tests. Local mode coordinates runners sharing one managed home; independent machines need external CI serialization and preserved migration history, or the optional database mode. Never describe local locks as distributed DB locks. Keep the local deployment-control directory across upgrades/uninstall; do not reset or change stores to replay migrations or evade an interrupted write.

An explicit user request to create, update or import an identified development/test application authorizes the necessary import within that task. Complete validate, plan, apply and runtime verification; a plan alone does not fulfill the request. Review the concrete plan and explain its scope, then continue without asking the same permission again. When the runtime needs a local grant, record that existing user authorization in the private user policy: exact canonical project, target digest, current plan digest, deploy operation only and short expiry no later than the plan. Preserve unrelated grants, retain a private authorization record and remove this task's grant after the attempt. Recording an actual user instruction is permitted; inventing user consent, broadening scope or forging production signatures is not. Production retains protected external approval. Re-plan after drift or expiry, review the new differences and stay within the authorized scope.

For application-only changes, follow the [application-only verification scope](../apexrest-test/SKILL.md#application-only-verification-scope). Missing utPLSQL or unrelated empty suites are not prerequisites for importing a page. Preserve established required-suite policy unless the user authorizes a scope change; never relabel absent or failed suites as passing.

Finish the source edit, review its plan and apply the same source. Inspect `apexrest_apex_sync` with `action: status` at the start of existing development/test work. Initialize a single-editor working copy only when needed. Working-copy plans compile local sources, check fresh identity/update metadata and bind the baseline, initial SQL backup and current revision. They compare against the latest successful frozen sources and perform no full exports. Full-export plans preserve the legacy path. Changed app metadata requires explicit refresh; unchanged metadata is not complete component drift proof.

Planning already supplies compilation and target/change evidence; avoid validate/export/diff calls for evidence already available. Keep apply's fresh checks, checksum verification and coordination. A working-copy initial SQL backup restores the baseline only; intermediate applied snapshots are retained without automatic per-import rollback. Database operations require explicit invalidate and the full path. Changed source, target or expiry requires a new plan.

Monitor active jobs by the returned ID with `apexrest_job_status` and `waitSeconds: 25`; never resubmit an operation to poll. Verify the final application and applicable checks. After interruption report outcome_unknown, inspect reconciliation and never blindly retry or clear writing ownership. Restore uses a separate backup-bound plan. Application-import authorization does not authorize unrelated business-table mutations, authentication changes or other targets.

After a successful authorized deployment affecting the UI, follow the [in-app browser verification rule](../apexrest-test/SKILL.md#in-app-browser-verification) for the deployed pages and behavior.
