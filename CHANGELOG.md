# Current changes

## Source bundle 2.9.0

- **Review mode in the local preview.** **Alt+Shift+C** selects a region, item, button, report column or the page, and leaves a comment for any agent, stored in `.apexrest/review/comments.json`. **Edit** in the same form changes a title, label, heading, format or sequence through the digest-bound patch service. `preview comments` returns each comment with its patch target and file digest. See [local preview](docs/local-preview.md#review-comments).
- **Semantic page edits.** `project context` returns a page's components and its file digest. `project patch` changes titles, labels, headings, formats, sequences, and report SQL together with its columns. `project insert` adds regions, items and refreshes to an existing page. Each edit is digest-bound, atomic and keeps unrelated bytes.
- **CRUD and search recipes.** `project scaffold` generates a report with a modal create/edit form, an editable interactive grid, a master–detail page and a faceted search. Editable regions require an authorization scheme, one primary key and lost-update detection. Compiled, imported and checked in the browser on local APEX 26.2.
- **Incremental preview.** Per-file parse cache, reloads only for affected pages, in-place refresh of allowlisted regions, stylesheet replacement, and the last good page kept with a stale banner after an invalid edit.
- **Source revisions.** Status reports latest local, preview, validated, importing and deployed revisions separately, and a late result never marks a newer revision.
- **Development broker and safer recovery.** `dev start` keeps one worker per project with exclusive job claims, and newer applies supersede queued ones. `deploy reconcile` releases a run held for database review after an exact, confirmed review. Migration history is bound to the schema instance, and one reset session runs an apply's database scripts.
- Align package, workspace, Codex and Claude Code source versions to 2.9.0. Registry distribution and full native/Oracle qualification remain separate outcomes.

See [current release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
