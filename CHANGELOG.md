# Current changes

## Source bundle 2.8.0

- Add `project scaffold`: one bounded JSON specification generates native APEX 26.2 interactive reports, KPI cards, bar charts and navigation. Preserve Oracle metadata and security, retain the blank Home shell, and refuse replacement of unowned or manually edited pages. See the [authoring guide](docs/apex-26.2.md#generate-routine-pages).
- Generate an optional private, target-bound SQL file for explicitly requested metadata/query observations. The caller invokes it manually after import; scaffold and ship never execute it or add an application-test gate.
- Route routine supported pages through scaffold and one guarded ship. Correct bar-chart example retrieval, bound oversized reference reads and accept literal nonblank ship requests up to 16,000 characters.
- Use `CONNECT -name` for CLI-owned SQLcl servers to retain normal transaction settings when saved connections omit `autoCommit`. Preserve rollback/identity checks and native MCP connection policy; do not change saved properties.
- Reduce source inventory work with bounded concurrent readers, detect database-only work when application files are unchanged, remove a duplicate new/full-plan identity read, and bind compiler validation to the exact staged source/metadata bytes.
- Classify a process drain timeout as an unknown write outcome when descendants outlive their launcher, and cancel stale drain timers after normal completion.
- In the matched four-page Box creation experiment, median end-to-end time fell from 335.44 to 99.39 seconds (70.4%) and reported aggregate tokens from 1,770,625 to 274,796 (84.5%). All six local Oracle apps passed the common audit. These are three samples per arm on local APEX 26.2/SQLcl 26.3, using the optimized development bundle before the version increment; broader task/update/browser/platform claims remain unqualified.
- Align package, workspace, Codex and Claude Code source versions to 2.8.0. Registry distribution and full native/Oracle qualification remain separate outcomes.

See [current release notes](docs/release-notes.md), [implementation status](docs/implementation-status.md) and [open verification](docs/next-actions.md).
