---
name: apexrest-project
description: Initialize, adopt and inspect APEXREST projects with explicit environment mapping.
---

Pass the user's absolute workspace as `project` on project-scoped calls.
Inspect configuration and source inventory once; reuse the project, environment, connection reference and toolchain until an input changes or a diagnostic requires rediscovery. Initialize in a new directory or adopt an explicitly identified test target; do not re-adopt a working source tree. Never overwrite local edits. Preserve Oracle IDs and .apex metadata. Ask only for missing non-secret target information; never infer production or defaults. Review executable project code before granting trust. Reused discovery never replaces fresh target and drift checks before writes.

Reuse known paths/settings. Otherwise use `apexrest_project_inspect` with `detail: summary` to avoid a source hash inventory. Use `detail: full` when hashes are needed; configured identities are not live target verification.

For a single-editor existing development/test application, `project adopt --env NAME --app-id ID --working-copy` shares `apex sync --env NAME --action init`: one initial APEXlang export and one SQL backup. It adopts an absent source directory or an exactly matching inventory; conflicts preserve both local files and private staging. A valid active record reuses its baseline without exporting. `status` is local only. After external edits, explicit `refresh` can install the new server baseline only after the known working copy matches its last successful checkpoint; `invalidate` preserves sources/backups/journal and cannot clear unknown outcomes.
