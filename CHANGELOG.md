# Current changes

## 2.0.0 — source bundle

- APEX 26.1 and 26.2 release profiles, references and starter templates.
- Automatic and explicit APEX 26.2 selected-file imports through direct SQLcl CLI, with three-way conflict checks, fresh backups, bound scope, conservative readback and server checkpoints.
- Advisory CodeScan and source-upgrade diagnostics; SQLcl 26.3 generation isolation and compatible ORDS library handling.
- Host-neutral verification browser mode and Codex/Claude Code installation and invocation guidance.
- CRM SQL annotations, interactive-report filter cleanup, deletion confirmation and 26.2 session rejoin.
- Resumable post-deploy authentication: `awaiting_reauth`, `POST_DEPLOY_REAUTH_REQUIRED` and import-free `deploy verify`.
- CI on pushes to `main` only; repository release and Oracle integration workflows disabled.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
