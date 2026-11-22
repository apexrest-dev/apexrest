# Current release notes

## Source bundle 2.9.0

The repository bundle supports Codex and Claude Code with six skills and twelve MCP tools. This release makes the edit–preview–deploy loop faster and reviewable: you point at components in the local preview and leave comments or edit properties, and agents apply small changes through digest-bound semantic edits instead of rewriting page files.

## Changes

- **Review mode in the local preview.** **Alt+Shift+C** selects a region, item, button, report column or the page, and leaves a comment for any agent, stored in `.apexrest/review/comments.json`. **Edit** in the same form changes a title, label, heading, format or sequence through the digest-bound patch service. `preview comments` returns each comment with its patch target and file digest. See [local preview](local-preview.md#review-comments).
- **Semantic page edits.** `project context` returns a page's components and its file digest. `project patch` changes titles, labels, headings, formats, sequences, and report SQL together with its columns. `project insert` adds regions, items and refreshes to an existing page. Each edit is digest-bound, atomic and keeps unrelated bytes.
- **CRUD and search recipes.** `project scaffold` generates a report with a modal create/edit form, an editable interactive grid, a master–detail page and a faceted search. Editable regions require an authorization scheme, one primary key and lost-update detection. Compiled, imported and checked in the browser on local APEX 26.2.
- **Incremental preview.** Per-file parse cache, reloads only for affected pages, in-place refresh of allowlisted regions, stylesheet replacement, and the last good page kept with a stale banner after an invalid edit.
- **Source revisions.** Status reports latest local, preview, validated, importing and deployed revisions separately, and a late result never marks a newer revision.
- **Development broker and safer recovery.** `dev start` keeps one worker per project with exclusive job claims, and newer applies supersede queued ones. `deploy reconcile` releases a run held for database review after an exact, confirmed review. Migration history is bound to the schema instance, and one reset session runs an apply's database scripts.
- Align package, workspace and native plugin versions to 2.9.0.

## Measured verification

All measurements are on local APEX 26.2 with Oracle 23.26.4. Details are in [implementation status](implementation-status.md).

- **Semantic edits.** From the service call to the edit in preview HTML takes 25–26 ms median.
- **Preview.** A renamed file with an older modification time is now detected (5/5, 8.8 ms).
- **Native page ship.** It is unchanged: 15.4 s baseline against 15.5 s, in alternating runs on the same project. No speed claim is made for deployment.

These are local results with small samples. They do not establish remote, Windows or Linux behavior.

## Upgrade a working copy

Working copies bind their runtime/toolchain version. Reconcile local edits and unresolved outcomes, then explicitly refresh a clean checkpoint with `apexrest apex sync --env dev --action refresh --json` and create new plans. Never edit stored runtime versions or clear unknown ownership to bypass safeguards.

## Distribution and verification

The approved npm exception applied only to 2.8.0; publishing 2.9.0 needs its own approval and current reports. Hosted CI runs on pushes to `main`. Repository release and Oracle integration workflows remain disabled.

See [acceptance](acceptance.json), [open checks](next-actions.md) and [publishing](publishing.md). Repository fixtures remain separate from connected Oracle and native-host evidence.
