# Current changes

## 2.2.0

- Refresh the official Oracle APEXlang source audit against Oracle skills HEAD `014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1`. All 389 bundled 26.2 inventory definitions, imported examples/catalog and license, and all 659 bundled 26.1 source files remain unchanged. Keep their reviewed pins; no newer release directory was found.
- Update current coverage, installation verification and maintenance documentation. The six skills and ten MCP tools retain their existing runtime behavior.
- Stabilize the harness timeout contract on Linux: wait for descendant termination and recognize killed processes awaiting OS reaping while still refusing a running descendant.
- Align the npm package, workspace packages and Codex/Claude Code bundle to 2.2.0, with fresh source-bound local checks and version-bound npm eligibility. Registry distribution remains separate from full native/Oracle qualification.

See [release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
