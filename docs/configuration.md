# Configuration and connections

This page describes the project file `apexrest.json`, environments, connection references, authorization policy and runtime variables. Use it when you set up a target or change how the plugin connects, reviews and deploys.

## Before you start

- Implementation uses the current host session (Codex or Claude Code) and its permissions.
- A project has one `apexrest.json` and one pinned toolchain lock. `project init` creates both, with an empty environment map.
- Every target operation requires an explicit environment; the plugin never guesses a database, workspace or application ID.

## Optional project settings

| Setting             | Purpose                                                                                           | Values                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toolchain.profile` | Selects `26.1` or `26.2` authoring references                                                     | `26.1`, `26.2`                                                                                                                                                                           |
| `decisionApi`       | Configures component selection only; overrides the [machine-wide default](#machine-wide-settings) | `enabled` (default false), `apiKeyEnv` (default `OPENAI_API_KEY`), optional project-relative `envFile`, and `timeoutMs` (default 3000, range 250–10000)                                  |
| `peerReview`        | Enables cross-vendor review of saved ship plans                                                   | `mode` (`off` default, `advisory`, `required`), `vendor` (`auto` default, `codex`, `claude`), optional `model` passed to the peer CLI, and `timeoutSeconds` (default 600, range 60–1800) |

- `toolchain.profile`: existing projects without it retain 26.1 behavior; selecting a profile does not upgrade a database or rewrite Oracle source metadata. See [APEX 26.2 support](apex-26.2.md) for the matching compiler lock and partial-import requirements.
- `decisionApi`: the key comes from the process environment first, then the explicitly configured private ignored ENV file. Selection falls back locally on API/credential failures; ordinary reference search/read remain local. See [Decisions selection](component-catalog.md#optional-openai-decisions-selection) for configuration and CLI/MCP examples.
- `peerReview`: see [Peer review](#cross-vendor-peer-review).

### Verification browser preference

- The verification browser preference (`host` in-app browser, alias `codex`) is stored per project in `.apexrest/panel/preferences.json`.
- The default `{"browserMode":"codex"}` is the legacy name of `host` and behaves identically.
- `apexrest_browser_open` accepts `browserMode` to override it for one call.
- `apexrest_status` `detail:project` reports the current value.

## Machine-wide settings

`apexrest settings` holds settings for every project and host on this computer, in `APEXREST_HOME/settings.json` (default `~/.apexrest`):

```sh
apexrest settings status --json
apexrest settings configure --decision-api on --catalog on --json
```

| Option                    | Effect                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--decision-api on\|off`  | Default OpenAI Decisions selection for projects whose `apexrest.json` has no `decisionApi`. A project `decisionApi` always wins.                    |
| `--api-key-env NAME`      | Environment variable holding the key for the global default (`OPENAI_API_KEY`). The global default never reads an ENV file; that stays per project. |
| `--decision-timeout-ms N` | Timeout for the global default, 250–10000 (3000).                                                                                                   |
| `--catalog on\|off`       | `off` turns off reference search, read and select for every host: they return `CATALOG_DISABLED` and agents continue without lookups.               |
| `--usage-log on\|off`     | Enables private, bounded usage records for backend elapsed time and reported token counters. Disabled by default.                                   |

`settings status` also reports, without any database, network or credential read:

- whether the key variable is set in the calling process (never its value);
- the bundled catalog sizes;
- recent projects in `recent-projects.json`: a successful operation with `--project` makes that project current; status reads do not.

Recent projects stay on the computer and are written only when APEXREST_HOME already exists. Set `APEXREST_USAGE=0` to disable recent-project recording and usage logging. The repository test runner sets it.

### Local token and time logging

Enable logging for both hosts that share this managed home, then inspect the most recent entries.

```sh
apexrest settings configure --usage-log on --json
apexrest usage status --limit 20 --json
apexrest settings configure --usage-log off --json
```

The owner-private `APEXREST_HOME/usage-log.json` retains at most 1,000 entries and 2 MiB. Retention removes the oldest entries first. Each backend operation records elapsed wall time, SQLcl time, host identity when known and success or failure. Composite action routing records one outer operation. Settings and log-inspection commands do not create timing entries. A logging failure does not change the operation's outcome.

Decisions selection records the input, cache-read, cache-write, output, reasoning-output and total token counters supplied by its API response, with the model and source. Cache reads and writes must fit within input, reasoning tokens must fit within output, and total must equal input plus output. Inconsistent API counters remain unavailable in the log. Each operation without token counters reports their unavailability. A CLI or MCP process cannot observe the host model's token consumption.

For actual native-host accounting, explicitly import JSON output from one completed native CLI run.

```sh
# Capture each run using the host's own JSON output option.
codex exec --json 'Your task' > /private/path/codex-run.jsonl
claude -p --output-format json 'Your task' > /private/path/claude-run.json

apexrest usage import --host codex --file /private/path/codex-run.jsonl --elapsed-ms 12345 --json
# For complete cumulative output from an initial Codex session and its resumed turns:
apexrest usage import --host codex --file /private/path/codex-session.jsonl --counter-mode cumulative-session --elapsed-ms 23456 --json
apexrest usage import --host claude --file /private/path/claude-run.json --json
```

The default Codex import accepts one completed turn from one identified thread. Multiple turns or resumed output require `--counter-mode cumulative-session`: this explicitly declares the cumulative counters observed in Codex CLI 0.160.0. The importer uses the final complete snapshot, rather than summing earlier snapshots; repeated announcements of the same thread are allowed. Different threads, counter decreases, dropped known counters, open turns and failed turns without completed usage are rejected. The native output does not identify its counter semantics, so historical per-turn formats cannot be inferred automatically. Wait for all included native runs to finish before importing.

New Codex imports retain an opaque SHA-256 session identity and counter mode, without the raw session ID. A different overlapping capture of the same retained session is rejected by default. Explicit cumulative snapshots can replace one previous cumulative entry when every known counter and the whole-session measured elapsed time are nondecreasing. An identical snapshot adds nothing. Historical entries without that identity remain unchanged; do not reimport their overlapping work. Deduplication and overlap checks cover the retained log.

Claude imports use one final result's counters, normalizing input to include cache reads and writes. A synthetic failed login result with no provider-backed usage remains unavailable. Genuine reported error-phase usage is retained. Models reported by the host are retained. Claude's reported duration is preserved. Supply `--elapsed-ms` only with elapsed time measured by the caller for the exact included work; for a resumed cumulative Codex session, sum its measured native phases without idle time. An absent duration remains unavailable.

Exact input contents are deduplicated within the retained records. Host-run totals and plugin-operation measurements have separate scopes and token sources. Summing the same work across those scopes would count it twice. Logging retains no prompt, completion, tool arguments, source path, database identity, credentials or session ID, and it calculates no cost. The explicit import reader accepts bounded, owner-controlled regular files up to 8 MiB and reads no other host history. Captured native output can contain task content, so keep the capture private.

### Native job waits

Codex MCP requests accept `waitSeconds` up to 30 for `apexrest_ship` and `apexrest_job`, leaving headroom below [Codex's default 60-second tool timeout](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). The advertised field schema and request validator share the limit. Larger values are rejected before project loading or work starts. Ship defaults to 25 seconds, and job status defaults to an immediate read. CLI job status and Claude retain their existing 120-second maximum.

The MCP protocol client name identifies known Codex and Claude clients. Managed launchers supply `APEXREST_HOST=codex|claude` for unfamiliar client names. A recognized protocol identity takes precedence for this wait policy. An unrecognized client without that registration retains the generic limit of 120 seconds. Check its client timeout before choosing a longer wait.

These values cap observation waits. Planning, compilation and apply preflight can run in process before a background job exists. Plan responses retain their usual shape. Workers can continue after an observation ends. Poll the original `jobId` and reconcile a lost outcome before requesting another execution.

## Configure an environment

Add an entry such as `environments.dev` to the generated `apexrest.json`:

```json
{
  "kind": "development",
  "readConnectionRef": "dev-read",
  "deployConnectionRef": "dev-deploy",
  "workspace": "YOUR_WORKSPACE",
  "parsingSchema": "YOUR_SCHEMA",
  "applicationId": 123,
  "baseUrl": "https://your-host.example/ords/r/workspace/crm/",
  "databaseIdentity": {
    "dbUniqueName": "YOUR_DB",
    "serviceName": "YOUR_SERVICE"
  },
  "allowedOrigins": ["https://your-host.example"],
  "expectedMarker": "apexrest-crm"
}
```

- These are placeholders, not a working target. Use the actual database unique name and service, workspace, parsing schema and app ID.
- `expectedMarker` can identify the expected application during browser inspection.
- `allowedOrigins` lists approved application origins. Adding an origin does not grant permission to mutate its data.

### Schema rules

- The generated `schemas/project.schema.json` is the exact public schema. Unknown fields are rejected.
- Existing project files may still contain retired `tests` and `database.testsDir` fields: loading ignores these fields; remove them when updating configuration.
- Old plans must be regenerated against the current configuration.
- Source, migration, package, artifact and toolchain paths must remain inside the project.

## List and test saved SQLcl connections

Checking database access requires no project or APEXREST alias:

```sh
apexrest connection list --saved --json
apexrest connection test 'Development connection' --saved --json
```

- These commands read the SQLcl store directly and test the exact saved name with a read-only identity query.
- If the store is empty or credentials are missing, configure them in SQLcl.
- You can then register references for a project environment as described below.
- CLI commands without `--saved` use those references; in the conversation, `apexrest_project` `action:connection_list` and `action:connection_test` do the same.

### SQLcl mode and database transport

| Setting            | Values                                                     |
| ------------------ | ---------------------------------------------------------- |
| SQLcl mode         | `cli` subprocess or `mcp`, the official SQLcl stdio server |
| Database transport | `direct` listener or `ords`                                |

- Both are saved per managed home with `apexrest sqlcl configure --mode cli|mcp --database-transport direct|ords --json`; `apexrest sqlcl status --json` reads them.
- For HTTP access when the listener is unreachable, configure plugin-level ORDS URL, username and password and select the `ords` transport. See [SQL through ORDS](ords.md).
- The saved SQLcl connections below apply to direct access.

## Save connection references

1. Create named connections interactively in SQLcl's local connection store.
2. Register their names:

   ```sh
   apexrest connection add dev-read --sqlcl-name saved-read-connection
   apexrest connection add dev-deploy --sqlcl-name saved-deploy-connection
   apexrest connection test dev-read --json
   ```

- The examples assume the [managed CLI launcher](getting-started.md#use-the-cli).
- APEXREST stores connection names rather than passwords.
- A read connection can use fewer privileges than its deploy counterpart.
- Removing an APEXREST reference with `connection remove` preserves the SQLcl store entry.
- Never put credentials in `apexrest.json`, environment examples, prompts or issue reports.

## Application authorization

### Authorization and grants

- There is no folder trust step. The plugin may use the selected project and other required directories within host filesystem permissions.
- Legacy `trustedProjects` in `$APEXREST_HOME/policy.json` is optional ignored compatibility data.
- The private policy retains exact-project/target/plan temporary grants; an identified DEV/QA/TEST application task authorizes its necessary import without repeated confirmation.
- Configuration and tool output do not grant consent.

### Environment kinds

Supported environment kinds are `development` (or `dev`), `qa`, `test` and `production`.

| Target                              | Rule                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Production-marked targets           | Never deploy/restore, including when local or given a signature.                            |
| Actual local non-production targets | Allow all task-scoped database changes without a separate risk prompt.                      |
| Remote targets                      | Remote dangerous operations require a described exact plan and explicit human confirmation. |

See the canonical [deployment safety rules](deployment-safety.md) for locality, precedence, backups, interrupted-import recovery and confirmation fields.

### Local ENV credentials

- Connection setup may use `envFile` with optional `urlKey`, `usernameKey` and `passwordKey` from a regular user-owned, Git-ignored and untracked local ENV file.
- It is parsed as literal data and values are never returned in operation results.
- Authorized requested browser login may use such local credentials without a paste/trust step; never persist browser cookies/profiles.
- For `passwordFile`, the private regular file must physically resolve inside the managed home, working directory or a configured project. The reader checks the opened file's identity and enforces owner-only permissions on POSIX.

## Cross-vendor peer review

Claude Code and Codex can review each other's APEX changes.

### Run a review

1. The host agent prepares a plan with `apexrest_ship mode:plan`.
2. It calls `apexrest_peer_review action:review plan:<planPath>`.
3. The runtime runs the other vendor's CLI in the project directory with the user's existing sign-in (ChatGPT or `OPENAI_API_KEY` for Codex; Claude subscription or `ANTHROPIC_API_KEY` for Claude Code). APEXREST never handles those credentials.
4. The reviewer receives the plan preview, database operations and a bounded Git diff of the deployable sources and returns `approve` or `changes_requested` with findings.
5. The verdict is written to `.apexrest/reviews/<planDigest>.json`.

| Host        | Peer command (read-only)                                                            |
| ----------- | ----------------------------------------------------------------------------------- |
| Claude Code | `codex exec --sandbox read-only --ephemeral --output-schema …`                      |
| Codex       | `claude -p --restricted --tools Read,Grep,Glob --strict-mcp-config --json-schema …` |

### How the peer CLI is found

- `vendor: auto` picks the opposite of the detected host (`APEXREST_HOST`, then the MCP client name sent at initialization, then the host's own environment); pass `vendor` explicitly when detection is unavailable.
- On Windows the CLI is found on absolute `PATH` entries (never in the project folder): a native `codex.exe` or `claude.exe` runs directly, and an npm-installed `codex.cmd` or `claude.cmd` shim runs the Node script it points to, without cmd.exe.
- `APEXREST_CODEX_BIN` and `APEXREST_CLAUDE_BIN` override the CLI; a `.js`, `.mjs` or `.cjs` override runs through Node.

### Review local-only work

- Local-only work without an Oracle target can still be reviewed: omit `plan` (CLI `apexrest peer review` without `--plan`).
- The reviewer then receives the list of application and database sources and the Git diff, and the verdict is written to `.apexrest/reviews/source-<sourceDigest>.json`.
- A source review is advisory only; it never satisfies the `required` apply gate, which needs a review of the exact saved plan.

### Gate modes

Gate modes apply to `apexrest_ship mode:apply` (and the CLI `ship --mode apply`):

| Mode       | Behavior                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `off`      | No review state is read.                                                                                                               |
| `advisory` | Apply proceeds and reports `peerReview` status (`approve`, `changes_requested` or `missing`).                                          |
| `required` | Apply fails with `PEER_REVIEW_REQUIRED` or `PEER_REVIEW_CHANGES_REQUESTED` unless an approving review of the exact plan digest exists. |

In `required` mode:

- A fresh plan created by apply itself is never reviewed, so review the saved plan and apply that path.
- The reviewer must be the other vendor: a review by the host agent itself (for example `vendor: claude` from Claude Code) is refused with `PEER_REVIEW_SAME_VENDOR` and does not satisfy the gate.

### Limits of peer review

- Before the reviewer runs, the saved plan must match its own digest and pass the same local checks as apply (sources, configuration, toolchain, project, target and lifetime); otherwise the review fails with `PLAN_TAMPERED` or the apply-time code and nothing is recorded.
- The optional `focus` text is passed to the reviewer as a fenced request from the reviewed agent, not as review rules.
- Interrupted-import recovery is not gated.
- The gate is a single-user workflow control, not a security boundary: the host agent can edit local files.
- `apexrest_peer_review action:status` (CLI `apexrest peer status`) reports which CLIs are installed and signed in.
- Peer runs use the other vendor's subscription limits or API billing; headless Claude usage (`claude -p`) is subject to Anthropic's current plan terms.

## Deployment coordination

- Coordination is always local and is not configurable: durable migration history and schema ownership live in `$APEXREST_HOME/deployment-control/`, scoped to the database identity and parsing schema.
- No APEXREST service tables are needed or created.
- Plans bind the store identity.
- Deleting the local history or silently switching to a fresh home is not a recovery procedure.
- The local store serializes runners that share one managed home.
- Independent machines or homes are not coordinated: preserve one durable deployment runner/home and serialize other machines externally, for example through a single CI deploy job.
- Database-backed coordination was removed. For older project files, `deploymentControl` is still accepted only with the value `"local"` and has no effect; any other value is rejected. Remove the field when convenient.

See [Clean APEX deployment](clean-apex-deployment.md).

## Application verification

- When the user requests browser verification, use the built-in or user-selected browser to inspect the requested interaction.
- Confirmed error-free server deployment is success without a mandatory browser step.
- Compiler, metadata and import checks remain separate.
- The plugin has no automatic application test runners or saved browser-authentication state.
- Repository self-tests validate the plugin implementation.

See [testing](testing.md).

## Runtime configuration

| Variable              | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `APEXREST_HOME`       | Private managed runtime, policy, connections and deployment state |
| `APEXREST_SQLCL`      | Explicit reviewed SQLcl executable                                |
| `APEXREST_JAVA_HOME`  | Java runtime selected for SQLcl                                   |
| `APEXREST_RESOURCES`  | Trusted host override for bundled resources                       |
| `NODE_EXTRA_CA_CERTS` | Additional certificate authorities for Node connections           |

### Deployment speed-up switches

Four switches turn off the deployment speed-ups described in [architecture](architecture.md#persistent-sqlcl-engine); each restores the previous behavior when set to `0`:

| Switch                      | Speed-up it turns off                                       |
| --------------------------- | ----------------------------------------------------------- |
| `APEXREST_CONNECTED_READS`  | One connected SQLcl server for the reads of a plan or apply |
| `APEXREST_WARM_IMPORT`      | The prepared import server                                  |
| `APEXREST_CAPABILITY_CACHE` | The capability files in the managed home                    |
| `APEXREST_PREWARM`          | The background compiler preload in the MCP server           |

### Trust, proxies and paths

- These overrides belong to the trusted local host, not project-controlled inputs.
- The bootstrap supports Node 24 environment proxies through `--use-env-proxy`.
- Vendor downloads honor `HTTPS_PROXY`/`HTTP_PROXY` and `NO_PROXY` through Node's environment proxy support; when a proxy is configured but this Node cannot apply it, setup fails with `PROXY_UNSUPPORTED` instead of bypassing the proxy.
- Paths with spaces and Unicode are supported; quotes, substitutions and control characters in SQLcl tokens are rejected.

## Related

- [Deployment safety](deployment-safety.md): the canonical authorization, plan, backup and recovery rules.
- [SQL through ORDS](ords.md): the `ords` database transport.
- [APEX 26.2 partial imports](apex-26.2.md): the 26.2 toolchain and import modes.
- [Development status](status.md): read the current configuration and connections.
