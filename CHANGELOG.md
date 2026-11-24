# Current changes

## Unreleased

- **Sync init after a full ship.** `apex sync --action init` no longer fails with `SYNC_SOURCE_CONFLICT` when the only differences are Oracle's export rewrites of sources a successful full `ship` just imported to the same target. Init adopts the server export, lists the files in `normalized` (rule `last-import-rewrite`) and names the run in `normalizedFromDeploymentRunId`. `SYNC_SOURCE_CONFLICT` now names the differing files. See [26.2 baseline](docs/apex-26.2.md#1-configure-sqlcl-and-initialize-the-baseline).
- **Project toolchain in setup.** `setup` and `dependencies install` (which gains `--project`) install the Node.js, Java and SQLcl the project's toolchain lock pins, for `--project` or the project root as the current folder; a 26.2 project gets SQLcl 26.3.0.260.1620 instead of the 26.1.2 baseline. Lock entries must match a lock shipped with the plugin (`TOOLCHAIN_LOCK_UNREVIEWED`). See [26.2 toolchain](docs/apex-26.2.md#select-the-262-toolchain).
- **CodeScan known false positives.** SQLcl 26.3 findings APEX-002, APEX-009 and APEX-031 on `application.apx` stay in `staticAnalysis.findings` but are marked `knownFalsePositive` (policy `apex262-sqlcl263-codescan-v1`) when the 26.2 source proves the setting. See [26.2 authoring](docs/apex-26.2.md#codescan-known-false-positives).

## Source bundle 2.9.0

- **Review mode in the local preview.** **Alt+Shift+C** selects a region, item, button, report column or the page, and leaves a comment for any agent, stored in `.apexrest/review/comments.json`. **Edit** in the same form changes a title, label, heading, format or sequence through the digest-bound patch service. `preview comments` returns each comment with its patch target and file digest. See [local preview](docs/local-preview.md#review-comments).
- **Semantic page edits.** `project context` returns a page's components and its file digest. `project patch` changes titles, labels, headings, formats, sequences, and report SQL together with its columns. `project insert` adds regions, items and refreshes to an existing page. Each edit is digest-bound, atomic and keeps unrelated bytes.
- **CRUD and search recipes.** `project scaffold` generates a report with a modal create/edit form, an editable interactive grid, a master–detail page and a faceted search. Editable regions require an authorization scheme, one primary key and lost-update detection. Compiled, imported and checked in the browser on local APEX 26.2.
- **Incremental preview.** Per-file parse cache, reloads only for affected pages, in-place refresh of allowlisted regions, stylesheet replacement, and the last good page kept with a stale banner after an invalid edit.
- **Source revisions.** Status reports latest local, preview, validated, importing and deployed revisions separately, and a late result never marks a newer revision.
- **Development broker and safer recovery.** `dev start` keeps one worker per project with exclusive job claims, and newer applies supersede queued ones. `deploy reconcile` releases a run held for database review after an exact, confirmed review. Migration history is bound to the schema instance, and one reset session runs an apply's database scripts.
- Align package, workspace, Codex and Claude Code source versions to 2.9.0. Registry distribution and full native/Oracle qualification remain separate outcomes.

See [current release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
