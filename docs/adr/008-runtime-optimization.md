# ADR 008: bounded runtime work

Status: implemented locally, 2026-09-12.

Build CLI and MCP together with shared ESM chunks. Keep every chunk directly in `runtime/`, because resource discovery and background worker paths are relative to `import.meta.url`. Clear the generated runtime before rebuilding so obsolete chunks cannot accumulate. Load installer setup and its validation/client dependencies only for installation operations. The entire runtime directory is the distribution unit.

Stream downloads into private, uniquely named temporary files. Enforce the existing 512 MiB limit and SHA-256 while consuming the stream, then fsync, close and rename only after validation succeeds. Remove partial files on handled failures. Verify cached archives using a fresh streaming hash before reuse. Do not cache integrity decisions or weaken offline/origin controls.

Build the reference index on first use and retain only the current resource file's index. Check path, device, inode, size and nanosecond modification/change timestamps on every request; rebuild after a change, deletion or failed load. Precompute normalized search text and ID lookup, and stop searching after eight matches. Cache static MCP tool schemas per server instance. These caches never hold database identity, deployment fingerprints, source inventories, approval grants or migration history.

The reference index trades a small first-read cost and retained memory for cheaper repeated lookups. Shared chunks require package relocation and worker tests. Local synthetic measurements and their limits are recorded in [the optimization review](../optimization-review.md); they do not establish native-host or Oracle integration performance.
