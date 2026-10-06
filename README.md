# APEXREST

Historical redesign timing, ranking and size-baseline estimates are unverified. Current exact sizes and fresh offline SQLcl timings are recorded in [local redesign evidence](docs/evidence/redesign-phase1-local.json).

> The repository is now `apexrest-dev/apexrest` (renamed from `apexrest-codex`; GitHub redirects the old URLs).

![APEXREST pencil and ruler symbol](docs/assets/apexrest-logo.svg)

[![Local quality gates](https://github.com/apexrest-dev/apexrest/actions/workflows/ci.yml/badge.svg)](https://github.com/apexrest-dev/apexrest/actions/workflows/ci.yml)

**Build and change Oracle APEX applications with Codex or Claude Code, from source to a verified import.**

Oracle APEX is a platform for building business web applications (forms, dashboards, reports and internal tools) on Oracle Database. APEXREST is a plugin for coding agents: a request such as "add an order status report" becomes APEXlang source changes, a real Oracle compiler check, a reviewed deployment plan, an authorized import into a development or test application and a browser check of the result.

The plugin provides five skills and eleven MCP tools backed by one runtime that runs Oracle SQLcl. The same bundle installs into Codex (desktop and CLI) and Claude Code, and the `apexrest` CLI exposes the same operations for scripts and Codex Cloud.

[Get started](docs/getting-started.md) · [Documentation](docs/index.md) · [Deployment safety](docs/deployment-safety.md) · [Verification status](docs/implementation-status.md) · [Contributing](CONTRIBUTING.md)

![APEXREST connects an agent request to APEXlang source, a verified deployment plan, Oracle APEX and runtime checks.](docs/assets/overview.svg)

> **Release status.** npm `latest` is `1.2.0`; the npm `beta` tag is `1.3.0-beta.1` (21 tools, 14 skills, experimental Composer). The redesigned surface described in this README (11 tools, 5 skills, persistent SQLcl engine, Claude Code support) is implemented in the source repository and verified locally only; it is **not yet published**. See the [changelog](CHANGELOG.md) and [release notes](docs/release-notes.md). Independent tooling; not an official Oracle, OpenAI or Anthropic product.

## Install

The repository ships the built plugin under `plugins/apexrest-apex`, so no `npm ci` or TypeScript build is needed. Keep Node 24 LTS on `PATH` (supported range: Node 24–26). Oracle work also needs Java 21 and SQLcl 26.1.2; the plugin can install them for you (below).

**Codex** (desktop or CLI with native plugin support):

```sh
codex plugin marketplace add apexrest-dev/apexrest
codex plugin add apexrest-apex@apexrest
```

**Claude Code:**

```sh
claude plugin marketplace add apexrest-dev/apexrest
claude plugin install apexrest@apexrest
```

For a local checkout, pass its path to `marketplace add` instead of `apexrest-dev/apexrest`. Start a new session after installation. Then ask the agent to check your setup:

> Use APEXREST to check my setup. Report the compiler, connection and target checks that still need attention.

The agent calls `apexrest_status` (`detail: "doctor"`) and, when Java or SQLcl is missing, previews and runs the bundled installer (`apexrest dependencies install --dry-run`, then `--yes`; `--accept-oracle-license` records your separate consent to the Oracle terms shown in the preview). Installation never creates a database or deploys an application.

**CLI from npm** (optional; the same runtime without a host plugin):

```sh
npm install -g apexrest   # latest = 1.2.0; apexrest@1.3.0-beta.1 for the beta
apexrest --help
```

The published packages still carry the previous surface; the commands in this README describe the source repository. From a checkout, run `node plugins/apexrest-apex/runtime/apexrest.mjs --help`. The [installation guide](docs/getting-started.md) covers connections, managed installation and removal.

## Work in one session

Describe the change in the conversation or invoke `$apexrest-work`. The skill follows this cycle, with every project-scoped tool taking the absolute project directory as `project`:

1. **Project.** New app: `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`) generates real Oracle sources. Existing app: `action:inspect`; `apexrest_apex_sync` `action:status` shows a working copy.
2. **References**, at most three lookups per change: `apexrest_reference` `mode:search` with short terms, `kind` and `limit:3`, then `mode:read` the chosen ID.
3. **Edit** `.apx` files under the application source directory, keeping `.apex/apexlang.json`, Oracle IDs, authentication and authorization.
4. **Validate** with `apexrest_apex_validate` until `diagnostics` is empty; each diagnostic names the file, line, column, type and a hint.
5. **Plan** with `apexrest_ship` `mode:plan`, `env` and `userRequest` (your literal instruction); review `risks`, `sources` and `target`.
6. **Apply** with `apexrest_ship` `mode:apply` and the same `userRequest` when you asked for the change in that dev/test environment. The runtime records a deploy grant bound to that plan, backs up, imports, verifies, runs required suites and removes the grant. If the call is still running after `waitSeconds`, the agent reads `apexrest_job` with the returned `jobId` instead of rerunning.
7. **Verify** visibly changed pages: `apexrest_browser_open` returns the URL, then the agent opens it with the selected browser (`codex` host browser or `external` system browser) and checks rendering, navigation and the changed interaction.
8. **Report** files changed, validation result, ship status and `runId`, pages verified in the browser, and anything not verified with its reason.

An explicit request to create, update or import an identified development/test application is the authorization for step 6; the agent does not ask again. Production targets refuse `mode:apply` and need a signed external approval on a protected runner ([production approval](docs/deployment-safety.md#production-approval)). Blocked, failed or unknown outcomes follow `$apexrest-safety`; missing tools or connections follow `$apexrest-setup`.

## Tools

| Tool                     | Purpose                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apexrest_project`       | `init`, `adopt`, `inspect`, `connection_add`, `connection_list`, `connection_test`; passwords only through `passwordFile`                                              |
| `apexrest_reference`     | Offline Oracle APEXlang references, component recipes and UX patterns: `mode:search` (any-term EN/UK ranking, top hit with its code block) and `mode:read`             |
| `apexrest_metadata_read` | Allowlisted, paginated metadata reads; `requests[]` batches up to 8 scoped queries with one target verification                                                        |
| `apexrest_apex_validate` | Real Oracle compiler on a staging copy, in-process, with structured diagnostics (`file`, `line`, `column`, `type`, `message`, `validValues`, `hint`)                   |
| `apexrest_ship`          | `mode:plan` validates and plans; `mode:apply` records a plan-bound grant, backs up, imports, verifies and tests in a detached worker (phases `backing_up` → `testing`) |
| `apexrest_apex_sync`     | Single-editor working copy of an existing dev/test app: `init`, `status`, `refresh`, `invalidate`                                                                      |
| `apexrest_test_run`      | `unit` locally; `sql`, `api`, `e2e` or `all` against a configured non-production environment                                                                           |
| `apexrest_browser_open`  | Resolve the configured application URL for the `codex` or `external` verification browser; opening is not verification                                                 |
| `apexrest_job`           | `status` (waits up to 120 s, reports `phase`) and `cancel` for an existing `jobId`                                                                                     |
| `apexrest_artifact_read` | Bounded, sanitized text of a registered artifact                                                                                                                       |
| `apexrest_status`        | `doctor` probes SQLcl, Java and the host without downloads; `project` returns the read-only status snapshot (settings, connections, sync, jobs, deployments, grants)   |

Validation, planning, references, metadata, sync and local unit tests run inside the MCP server process on a pooled SQLcl engine; only `ship` apply and remote test suites run in a detached worker so a database write survives host termination. The tool catalog is about 12 KB. The CLI keeps granular commands (`project`, `connection`, `apex`, `deploy`, `test`, `jobs`, `compose`, `sqlcl`, `dependencies`) plus `ship`, `status`, `job` and `reference`; run `apexrest --help`.

## Skills

| Skill                       | Use                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$apexrest-work`            | Create or change an application end to end: the eight-step cycle above                                                                             |
| `$apexrest-apexlang`        | Write or edit APEXlang with pinned Oracle references, component and pattern recipes, contract notes and compiler validation                        |
| `$apexrest-safety`          | Authorization, trust, plan drift, unknown outcomes and test policy when `apexrest_ship`, `apexrest_test_run` or `apexrest_job` is blocked or fails |
| `$apexrest-setup`           | Doctor, dependency installation, SQLcl mode and ORDS transport, connection references and the project status snapshot                              |
| `$apexrest-pattern-catalog` | Maintainers only: add reviewed UX patterns to the bundled catalog from an identified application                                                   |

The skills are host-neutral; the linked local evidence reports their exact `SKILL.md` byte count; reference files load on demand. Bundled offline catalogs: 109 component families with 138 compiler-checked recipes ([component catalog](docs/component-catalog.md)) and 58 UX patterns with 84 recipes, 69 compiler-checked ([pattern catalog](docs/pattern-catalog.md)). Compiler readiness does not imply SQL, import or browser verification.

## Oracle access

SQLcl runs in `cli` mode (subprocess) or `mcp` mode (the official SQLcl stdio server); the database transport is `direct` (Oracle listener) or `ords` (REST-Enabled SQL over HTTPS, no port 1521). ORDS requires `cli` mode and plugin-level credentials kept in private local files, never in chat:

```sh
apexrest connection add dev-read --ords-url https://ords.example.invalid/ords/app_user/ --ords-username app_user --password-file /path/to/local/file
apexrest sqlcl configure --mode cli --database-transport ords --json
apexrest connection test dev-read --json
```

ORDS also enables the [Codex Cloud setup](docs/codex-cloud.md): the bundled CLI runs inside the Cloud container and talks to your database over HTTPS. See [SQL through ORDS](docs/ords.md).

## Deployment boundary

A plan binds sources, configuration, toolchain and target and expires after 30 minutes. Apply re-checks identity and drift, takes a checksummed SQL backup of an existing application, freezes the sources and records migration history and ownership in a local durable store under `APEXREST_HOME`. A clean supported APEX installation is sufficient: no APEXREST service tables exist or are created. Coordination is local to one managed home; independent machines need external serialization (for example one CI deploy job). An unknown outcome is never retried blindly. Read [deployment safety](docs/deployment-safety.md).

![Deployment flow: inspect once, edit coherent changes, validate, review the bound plan, back up and import, then verify.](docs/assets/deployment-flow.svg)

## What has been verified

| Area                | Available evidence                                                                                                            | Remaining scope                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Native Codex plugin | Isolated installation, discovery, tool calls and lifecycle on Codex 0.154.0 / macOS arm64 for earlier releases                | Re-verification of the redesigned surface in a live host session; other hosts/platforms |
| Claude Code plugin  | `claude plugin validate --strict` on both manifests and a local test install from a scratch marketplace                       | An end-to-end session that calls the tools; published marketplace install               |
| Persistent engine   | Offline reuse covered by local fixtures; current timing qualification is NOT RUN         | Connected sessions on an authorized target; SQLcl `mcp` mode against a live database    |
| Oracle APEXlang     | Real blank/CRM compilation with local SQLcl, without a database connection                                                    | Changed imports, broader component coverage                                             |
| ORDS connectivity   | [Authorized unchanged export/import/export](docs/evidence/ords-connected.json) on an earlier release, 21 byte-identical files | The ORDS path is unchanged by the redesign but was not exercised again                  |
| Local runtime       | Unit, CLI/MCP contract, installer and packaging checks with explicitly labelled fixtures                                      | Connected recovery, fault injection, SQL/CRUD integration, application browser checks   |

Unit tests, mocked failure scenarios, real Oracle operations and native-host checks are recorded separately. See the [acceptance matrix](docs/acceptance.json), [implementation status](docs/implementation-status.md) and [next actions](docs/next-actions.md). A missing or skipped integration suite is not a passing result.

## Develop locally

Use Node 24 LTS and the committed lockfile:

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
npm run test:installers
npm run site:build
npm run test:packaging
npm run docs:check
```

After source, skill or resource changes, run `npm run plugin:sync` to refresh the checked-in bundle (including the Codex and Claude Code manifests and both marketplace files); `npm run plugin:check` compares it with a fresh build. `npm run test:repository-plugin` installs the bundle into an isolated Codex profile. `npm run release:dry-run` builds local artifacts and a readiness report; nothing publishes a release. See [contributing](CONTRIBUTING.md) and [testing](docs/testing.md).

## Documentation and support

- [Getting started](docs/getting-started.md): install in Codex or Claude Code, connect, create or adopt, ship and verify.
- [Configuration](docs/configuration.md): environments, connection references, trust policy and deployment coordination.
- [Testing](docs/testing.md): local checks, suites and the browser verification rule.
- [Codex Cloud](docs/codex-cloud.md): container setup, CLI over ORDS, secrets and proxies.
- [Architecture](docs/architecture.md): one core behind the CLI, MCP and skills.
- [Troubleshooting](docs/troubleshooting.md): setup, compiler, authorization and recovery diagnostics.
- [Security](SECURITY.md): credential boundaries, trusted code and private reports.
- [Composer](docs/composer.md): experimental, CLI-only block composition, to be replaced by an App Spec compiler.

Report reproducible bugs through [GitHub issues](https://github.com/apexrest-dev/apexrest/issues) with sanitized diagnostics; follow [SECURITY.md](SECURITY.md) for sensitive reports. Licensed under [Apache-2.0](LICENSE).
