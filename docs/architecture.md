# Architecture

English | [Українська](architecture.uk.md)

APEXREST uses one policy-aware core for the CLI and native Codex MCP server. Fourteen skills guide work in the current session; twenty-one MCP tools expose bounded operations. Both interfaces validate inputs against the same strict Zod schemas.

Implementation runs directly in the open Codex conversation. See [Codex integration](codex-integration.md) for ownership and host boundaries.

Oracle operations use the persisted SQLcl CLI/MCP backend. MCP here means the official SQLcl stdio server, distinct from the Codex-facing APEXREST MCP API. See [backend selection](tui.md#sqlcl-mode-cli-or-mcp).

![APEXREST architecture from Codex through source, deployment planning, Oracle and verification.](assets/overview.svg)

## Components

| Component                                 | Responsibility                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `plugins/apexrest-apex/skills/`           | Task routing, APEXlang workflow, setup, deployment, review and browser verification instructions |
| `packages/mcp/`                           | Stdio MCP catalog, structured responses and asynchronous job dispatch                            |
| `packages/cli/`                           | CLI parsing and JSON output, backed by the same operation schemas                                |
| `packages/core/`                          | Configuration, connections, references, SQLcl, deployment policy, testing, jobs and artifacts    |
| `packages/installer/`                     | Reviewed downloads, safe extraction, managed runtimes and native registration                    |
| `packages/testkit/`                       | Browser/API helpers for application tests                                                        |
| `resources/`, `templates/`, `toolchains/` | Pinned references, project starters and toolchain definitions                                    |

`plugins/metadata.json` drives the native Codex compatibility package. Codex is the only product target; the former experimental portable artifact is retired. The build shares ESM runtime chunks and copies skills, reference fragments, schemas, templates and locks into self-contained packages. Managed installation binds MCP to absolute runtime paths. MCP startup performs no dependency downloads and does not require an extra global MCP registration.

## Request lifecycle

Short operations return a structured result. Long MCP operations return a job ID and continue in a detached worker. Poll that ID with `apexrest_job_status`; cancel through `apexrest_job_cancel`. Do not restart an operation merely because its first response is a job handle.

Workers maintain bounded logs, a durable status file and a heartbeat. A lost heartbeat or interruption during a write can produce `outcome_unknown`; it does not prove a rollback. Workers have a 15-minute deadline. SQLcl has separate process timeouts and classified diagnostics, including commands that print an error despite returning exit code zero.

## Oracle boundary

All application generation, export, validation and import use real Oracle SQLcl. APEXlang source is validated in staging, preserving the working tree and Oracle `.apex` metadata. Reviewed version-aware references are local indexed data; upstream router instructions and arbitrary scripts are not installed as agent authority.

The optimized adapter combines target identity fields in one fresh query. It reuses successful capability help only while runtime identities remain valid, probes the compiler version again and never caches live target state. Planning overlaps independent compilation and read-only target work; apply overlaps independent preflight reads. All preflight tasks settle before an error is returned or a write begins.

## Deployment boundary

A plan binds source, configuration, compiler/toolchain, target identity, target content and migration history. Apply verifies that binding, checks current identity and drift, creates a copied and checksummed SQL backup for an existing app, freezes the sources and takes ownership before writing. Post-import checks and configured test gates remain part of completion.

Local durable history and ownership are the default. They coordinate runners sharing one managed home for a database/service/parsing-schema scope. Separate machines need external serialization or the optional database-backed mode; filesystem locking is not a distributed database guarantee. See [deployment safety](deployment-safety.md) for exact failure and recovery behavior.

## Trust and data handling

Project SQL, tests and APEXlang are executable inputs. The project must be reviewed and trusted locally. Database descriptions, source comments, reference content and test output are data, not instructions to expand permissions. Credentials stay in local connection and auth stores.

Filesystem operations reject traversal, symlinks and special files where the policy requires contained files. State uses atomic writes and exclusive ownership; subprocesses execute without a shell. Artifact readers expose bounded registered text and apply redaction. These controls do not replace the host's permission boundary or protected production approval. See [security](../SECURITY.md).
