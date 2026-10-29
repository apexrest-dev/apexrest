# Current changes

## 2.3.0

- Add optional project-scoped OpenAI Decisions component selection through `apexrest_reference mode:select` and `apexrest docs select`, retaining six skills and ten MCP tools.
- Rank compatible English/Ukrainian catalog candidates in one bounded predicate batch. Keep final APEXlang generation in the current host model, with contracts and recipes loaded from the verified local catalog.
- Read credentials from the configured environment or a private literal ENV file; retain explicit local fallback, cancellation, version isolation and bounded responses.
- Record live selection measurements and a same-page generation pilot, including failures, repairs, actual usage and unqualified scopes. Align package and Codex/Claude Code source versions to 2.3.0; registry publication remains a separate outcome.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
