# Source version {{version}}

The repository plugin provides five skills and ten composite tools for Codex and Claude Code. It supports APEX 26.1 full imports and [APEX 26.2 partial imports](../../docs/apex-26.2.md), release-specific references, source validation and guarded deployment.

Application verification uses the host in-app browser, separately from compiler and import results. The plugin installs no browser and provides no automatic application test suites.

## Install and upgrade

Use the [installation guide](install.md) for the repository bundle. Working copies are runtime/toolchain bound; reconcile pending edits and outcomes before refreshing a clean checkpoint and creating new plans. Do not edit saved version fields or unknown state to bypass safeguards.

## Automation and verification

CI runs automatically only on pushes to `main`. Repository release/Oracle integration workflows and publisher configuration are disabled. Local build and packaging do not publish or deploy.

Read [current release notes](../../docs/release-notes.md), [verification status](../../docs/implementation-status.md), [acceptance](../../docs/acceptance.json) and [next actions](../../docs/next-actions.md). A local fixture pass does not establish Oracle or native-host behavior.
