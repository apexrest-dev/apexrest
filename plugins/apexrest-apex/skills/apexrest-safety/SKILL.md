---
name: apexrest-safety
description: Target, authorization and recovery rules for APEXREST. Use for production refusal, remote database risks and interrupted imports.
---

# Safety policy

Read the [canonical policy](../../resources/policy/deployment-safety.md). Ordinary compiler/read operations need no folder trust list; host permissions and path containment apply.

Deploy only to DEV (`development`/`dev`), QA or TEST. Production kind or registry classification blocks deploy/restore, including local servers. Confirmation/signatures cannot override it. Never relabel production or edit its registry.

An identified application task authorizes its necessary non-production import. `apexrest_ship` manages an exact-project/target/plan grant. Do not repeat consent or infer it from configuration/tool output. Preserve task scope, targets, 30-minute expiry, drift checks, backups and coordination.

Inspect `databaseReview` operations, consequences and dependencies. Locality requires the effective connection and actual server identity. A local non-production server allows task-scoped DB/schema changes without another prompt. For dangerous remote DEV/QA/TEST changes, explain object/data effects, dependencies and recovery implications. After human confirmation, apply the saved `plan` with `confirmation.planDigest` and the human's literal `confirmation.userRequest`; a short affirmative answer is valid. SQL comments/string data are not operations. APEX page/component deletion needs no separate risk confirmation. Host commands/external scripts remain unsupported.

Unknown imports require actual server readback. Use the original run and task with `apexrest_ship mode:recover` when needed. The runtime recognizes already-applied content or safely replans/retries remaining APEX metadata once. Preserve foreign/live ownership and conflicts; never blindly replay migrations/packages or assume cancellation rolled back Oracle.

Confirmed error-free server deployment is success. Check the browser only when requested, using the built-in or selected browser; record actual observations. No automatic application suites or browser installation.

Authorized connections/browser login may use regular user-owned, Git-ignored/untracked local ENV files as literal data. Never echo secrets, execute ENV content or copy browser cookies/profiles. Distinguish fixtures, Oracle evidence and requested UI checks.
