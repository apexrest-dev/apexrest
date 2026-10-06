# Current release notes

## Source bundle 2.0.0

The repository bundle supports Codex and Claude Code with five skills and eleven MCP tools. It includes APEX 26.1 full imports and [APEX 26.2 partial imports](apex-26.2.md), pinned release profiles, advisory scanner/upgrade diagnostics and read-only capability checks. Use the repository installation for this source version; registry packages are a separate distribution path.

Full imports can end APEX sessions. Required E2E remains blocked until the user renews authentication; `apexrest deploy verify --run UUID` reruns verification without importing. See [testing](testing.md#sessions-ended-by-a-full-import).

## Upgrade a working copy

Working copies bind their runtime/toolchain version. Reconcile local edits and unresolved outcomes, then explicitly refresh a clean checkpoint with `apexrest apex sync --env dev --action refresh --json` and create new plans. Never edit stored runtime versions or clear unknown ownership to bypass these checks.

## Distribution and verification

Repository release and Oracle integration workflows and publisher configuration are disabled. CI runs on pushes to `main` only. Local packaging does not publish npm, create a Git tag or deploy a website. Any publication needs separate authorization and current source-bound release gates.

See [implementation status](implementation-status.md), [acceptance](acceptance.json), [open checks](next-actions.md) and [publishing](publishing.md). Fixtures and offline compilation do not establish connected Oracle, authenticated application browsing or native model-host execution.
