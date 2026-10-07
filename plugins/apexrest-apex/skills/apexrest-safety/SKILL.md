---
name: apexrest-safety
description: Deployment, verification, production and unknown-outcome policy for APEXREST. Read when apexrest_ship or apexrest_job returns blocked, failed or outcome_unknown, or before any production or database change.
---

# Safety policy

Authorization. An explicit user request to create, update or import an identified development/test application authorizes that import; `apexrest_ship` records it as a short-lived grant bound to the exact project, target and plan digest, deploy only, and removes it. Never invent consent, widen it to business-table writes, authentication changes or other targets, or edit `policy.json` grants by hand. Production targets (`kind: production` or listed in the administrator-owned `production-trust.json`) refuse `mode:apply`; they need a signed external approval in a protected CI runner. Never create, edit or relax that file.

Trust. `PROJECT_TRUST_REQUIRED` means the user must add the project path to `trustedProjects` in `APEXREST_HOME/policy.json` after reviewing its code. Ask; do not write it.

Plans. A plan expires after 30 minutes and binds sources, configuration, toolchain and target. `SOURCE_DRIFT`, `TARGET_DRIFT`, `PLAN_EXPIRED` or `SYNC_REPLAN_REQUIRED`: run `apexrest_ship` `mode:plan` again and review the new preview. `RECOVERY_REVIEW_REQUIRED`: the plan carries destructive, privileged or security risks; present them and the recovery path to the user before applying. Working-copy plans cannot run migrations or packages; invalidate the sync explicitly first.

Unknown outcomes. `outcome_unknown`, `OUTCOME_UNKNOWN`, an expired heartbeat or a lost import response mean the database may have changed. Do not retry, cancel or clear ownership. Read `apexrest_job` `action:status` for the same `jobId`, then reconcile with the CLI `deploy status --run RUNID` before any new plan. Cancellation never implies rollback. Backups under `.apexrest/backups` restore application metadata only through a separate restore plan.

Verification. Compile with Oracle, reconcile authorized read-only source/metadata queries and inspect changed pages with the host in-app browser. The plugin runs no automatic application test suites and installs no browser. Import success does not prove rendering, navigation, validation or CRUD behavior; report missing browser checks with their reason.

Evidence. Separate implemented code, fixture results, real Oracle results and browser observations. Report blockers with their fault code and `nextActions`; never describe a partial or unverified change as complete. Secrets never travel through chat, tool input or evidence.
