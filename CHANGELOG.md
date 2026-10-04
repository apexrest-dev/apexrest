# Changelog

## Unreleased — redesign phase 1, security hardening and review fixes

These changes are implemented in the working tree and checked locally only; they are not verified against Oracle, APEX or ORDS. See [implementation status](docs/implementation-status.md#redesign-phase-1--local-implementation-2026-10-04) and the [review fixes record](docs/implementation-status.md#review-fixes--local-implementation-2026-10-04).

**Breaking changes (redesign):** the MCP catalog is reduced from 21 tools to 11; removed tool names are `apexrest_doctor`, `apexrest_project_inspect`, `apexrest_reference_search`, `apexrest_reference_read`, `apexrest_apex_generate`, `apexrest_apex_export`, `apexrest_deploy_plan`, `apexrest_deploy_apply`, `apexrest_job_status`, `apexrest_job_cancel`, `apexrest_panel_open`, `apexrest_panel_status`, `apexrest_panel_action`, `apexrest_compose_plan` and `apexrest_compose_materialize` (their operations continue under `apexrest_project`, `apexrest_reference`, `apexrest_ship`, `apexrest_job`, `apexrest_status` or the CLI). Skills are reduced from 14 to 5; `$apexrest-menu`, `$apexrest-panel`, `$apexrest-compose`, `$apexrest-deploy`, `$apexrest-debug`, `$apexrest-database`, `$apexrest-test`, `$apexrest-project`, `$apexrest-review` and `$apexrest-install-dependencies` no longer exist. The terminal UI (`apexrest`, `apexrest tui`, `apexrest panel tui`), the panel HTTP server and worker, panel actions and the MCP UI resource are removed; `apexrest` without arguments prints help. The `deploymentControl` configuration field and database-backed coordination are removed; coordination is always local. Ukrainian `.uk.md` documentation and `.uk.svg` diagrams are removed. The repository moved to `apexrest-dev/apexrest`.

**Breaking changes (review fixes):** production apply needs an administrator-owned `production-trust.json` and attestations that also carry `planId` and `projectId`; every local deploy grant needs a matching `planDigest`; migrations must be flat and uniquely versioned; ORDS `http:` URLs are limited to loopback and `--password-file` must be owner-only; the release runtime is one `apexrest-runtime-<version>.zip`.

### Redesign phase 1

- **Engine.** Offline compiler work (generate, validate, help) in SQLcl `cli` mode and every SQLcl `mcp`-mode connection now run on a pooled SQLcl server process (`sql -mcp`) that lives for the MCP server process: commands on one session are serialized, idle sessions are reaped after ten minutes and a timed-out, cancelled or failed command kills its session. The capability probe runs once per SQLcl installation per process. Measured locally: `apex validate` 3.2 s cold → about 43 ms warm; capability probe 1.5 s → 0 ms. Connected `cli`-mode sessions (saved `-name` connections, ORDS `connect -orest`) keep one process per call.
- **Diagnostics.** Compiler results return structured `diagnostics[]` with `file`, `line`, `column`, `type`, `message`, `validValues` and `hint`; `VALIDATION_FAILED` and other domain faults carry `nextActions`.
- **Agent surface.** Eleven MCP tools: `apexrest_project` (init, adopt, inspect, connection_add, connection_list, connection_test), `apexrest_reference` (`mode:search|read`, any-term EN/UK ranking with stemming and aliases, top hit includes its primary code block and resolved `requires`/`related` IDs, `include`, `includeUnresolved`), `apexrest_metadata_read`, `apexrest_apex_validate` (in-process), `apexrest_ship` (`mode:plan|apply` with `userRequest`), `apexrest_apex_sync`, `apexrest_test_run`, `apexrest_browser_open`, `apexrest_job` (status, cancel), `apexrest_artifact_read` and `apexrest_status` (doctor, project). The catalog shrinks from about 24 KB to 12.2 KB. Jobs run inside the MCP process except `ship` apply and remote test suites, which keep the detached worker.
- **Ship.** `apexrest_ship` `mode:apply` records a deploy grant from the user's literal request under the authorized-import rule, bound to the exact project, target and plan digest, then backs up, imports, verifies, runs required suites and removes the grant. Phases `backing_up` → `migrating` → `importing` → `verifying` → `testing` are reported through `apexrest_job`; the call waits up to 120 s. Production targets are refused and keep the external approval path. CLI: `apexrest ship --env NAME --mode plan|apply --user-request TEXT`.
- **Skills.** Five host-neutral skills for Codex or Claude Code: `apexrest-work` (the eight-step cycle), `apexrest-apexlang`, `apexrest-safety`, `apexrest-setup` and the maintainer-only `apexrest-pattern-catalog`; about 41 KB → 17.6 KB of `SKILL.md`.
- **Claude Code.** The built plugin carries `.claude-plugin/plugin.json` (name `apexrest`, MCP server `node ${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs`) and the repository root `.claude-plugin/marketplace.json`: `claude plugin marketplace add apexrest-dev/apexrest`, then `claude plugin install apexrest@apexrest`. Both manifests pass `claude plugin validate --strict`; the Codex route is unchanged.
- **CLI.** New `apexrest ship`, `apexrest status --detail doctor|project` and the aliases `job` (for `jobs`) and `reference` (for `docs`). `apexrest panel status` remains a read-only snapshot. Composer stays available as `apexrest compose plan|materialize` (experimental) until an App Spec compiler replaces it.
- **Removed.** Terminal UI, panel server/worker/actions and MCP UI resource, database-backed deployment coordination and control tables, Ukrainian documentation and the `.uk` site routes, and the Composer MCP tools. The panel is now a read-only status snapshot (`apexrest_status` / `apexrest panel status`).
- **Repository.** Renamed from `apexrest-codex` to `apexrest`; the GitHub rename itself is performed by the organization owner.

### Deployment safety

- Require administrator-owned `$APEXREST_HOME/production-trust.json` with trusted approval-key fingerprints (SHA-256 of SPKI DER) and production target digests. Listed targets are production regardless of `apexrest.json`. Production approval is refused on Windows and when the process owns or can modify the file. See [production approval](docs/deployment-safety.md#production-approval).
- Bind every local deploy grant to the exact `planDigest` and an expiry no later than the plan (`DEPLOY_APPROVAL_REQUIRED`).
- Compare the live target and migration history with the plan, recompute authentication/authorization risk from a live export, back up whenever the live application exists and cap plan lifetime at 30 minutes (`PLAN_TAMPERED`).
- Block SQLcl/SQL*Plus client commands in migrations, package scripts (`sqlcl-script-control`) and SQL tests (`SQL_TEST_SCRIPT_CONTROL`); start CLI-mode migration/package script, `apex import`, restore and SQL test sessions with `-R 2`.
- Enforce flat, uniquely and increasingly versioned migrations in numeric order (`INVALID_MIGRATION_LAYOUT`, `DUPLICATE_MIGRATION_VERSION`, `MIGRATION_OUT_OF_ORDER`).
- Accept ORDS `http:` only for loopback and reject unsafe password files (`PASSWORD_FILE_UNSAFE`).
- Write backups owner-only, clean export staging, flush directories after atomic writes, publish lock files atomically and report ownerless locks older than 30 seconds as `LOCK_CORRUPT`.
- Verify restores of applications absent at plan time by the backup alias; report unexpected post-import verification errors as `POST_DEPLOY_VERIFICATION_FAILED`; require a compiler success marker without error indications (`VALIDATION_UNCONFIRMED`).

### Composer

- Refuse to bind source-only materializations into deployment plans (`COMPOSITION_UNQUALIFIED`) and block plans with owned sources over 1 MiB (`PLAN_LIMIT`).
- Restrict row predicates to an allowlisted dialect, deny dangerous packages in extensions after comment normalization, reject unsafe labels (`LABEL_UNSAFE`) and multi-line or backtick literals.
- Re-check row visibility on edit saves; block page removal on alias, `f?p`, `p_page` and dynamic references; include derived names in collision checks.
- Refresh stale receipts on no-op apply; require the frozen plan record and enforce write scope during recovery; match timestamp precision and unquoted identifiers case-insensitively in connected binding.

### MCP and CLI

- Require project trust for `metadata.read`, `deploy.status` and `deploy.restore-plan`.
- Stop archiving `panel.status` snapshots, prune result archives at most hourly and list the newest 2000 history records with omitted counts. (The panel actions these fixes first adjusted were removed entirely by the redesign above.)
- Report the operation's own `failed`, `outcome_unknown` or `cancelled` job outcome, mark jobs whose worker never started as failed, and add MCP `completed_unreadable`.
- Exit with code 2 for `--help` on an unknown command and for invalid `--action` JSON; accept multi-word `docs search` queries.

### Installer

- Time out stalled downloads after 60 seconds without data with up to three attempts; honor `HTTPS_PROXY`/`NO_PROXY` through Node environment proxy support or fail with `PROXY_UNSUPPORTED`.
- Support Codex `.cmd` shims and add an `apexrest.cmd` launcher on Windows; reject unsafe arguments and launcher paths (`UNSAFE_COMMAND_ARGUMENT`, `UNSAFE_LAUNCHER_PATH`).
- Require a user-owned, non-shared download cache (`UNSAFE_CACHE_DIRECTORY`); stop executing found tools during dry runs; record toolchain integrity in `runtime.json`; ignore ambient Playwright download-host variables.
- Hold the installation lock and validate the recorded destination during uninstall; add `--codex` to setup and uninstall.

### Repository and documentation

- `npm run release:dry-run` builds local unsigned artifacts from a dirty tree; the new `npm run release:package` refuses a dirty tree and is used by the release workflow. Packaging rebuilds the plugin and site itself.
- Ship one platform-neutral runtime archive and limit third-party notices to redistributed production dependencies.
- Check that documented `node scripts/...` and `npm run` commands exist; update deployment, configuration, ORDS, testing, troubleshooting, panel, Composer and installation guides.

## 1.3.0-beta.1 — experimental Composer and working copies

- Add local Composer with six experimental renderers, two blueprints, reviewed plans, materialization, recovery, CLI/MCP routes and an in-app Catalog. See the [Composer guide](docs/composer.md).
- Add single-editor working copies for existing applications: explicit `apex sync`, immutable local baselines, source-bound plans and imports from frozen local source. The legacy full-export path remains available.
- The package contains 21 MCP tools and 14 focused skills, including `$apexrest-compose`. The [Composer audit](docs/composer/audit.md) records unfinished CMP-000–041 requirements; live Oracle import, roles, authenticated browser behavior and new-chat native loading remain open.

`apexrest@1.3.0-beta.1` is published under the npm `beta` tag; stable `latest` remains `1.2.0`. The [publication record](docs/evidence/npm-130-beta1-publication.json) confirms registry integrity, clean local/global installs and CI success on macOS, Ubuntu and Windows. No Git tag or production deployment is claimed.

## 1.2.0 — reusable APEX pattern catalog

- Find 58 reusable patterns through offline `corpus: "patterns"` retrieval and stable `pattern:` IDs. Adapt 84 recipes: 69 have compiler-checked implementations and 15 retain explicit unresolved reasons.
- Review 150 source pages and 818 meaningful variants from Universal Theme Reference and Oracle APEX UX Pattern Catalog, with coverage records bound to exact source hashes.
- Add the `$apexrest-pattern-catalog` skill for extending the catalog from identified APEX applications. The plugin provided 18 MCP tools and 13 skills in this release. See the [pattern catalog guide](docs/pattern-catalog.md).

The existing component catalog, `apexlang` default and Oracle reference IDs are preserved. `apexrest@1.2.0` is published as npm `latest`; the [publication record](docs/evidence/npm-120-publication.json) confirms registry integrity and clean local/global installs.

## 1.1.0 — component catalog

- Add offline Universal Theme discovery across 109 component families, contextual parameters and 138 compiler-checked APEXlang recipes through the existing MCP reference tools and CLI. One unsupported recipe remains discoverable with an explicit unresolved reason.
- Capture an identity-checked read-only application snapshot, preserve full inventory and separate compiler, SQL, import and browser evidence.
- Package reviewed source facts, UPL-licensed parameter help and synthetic examples with hashes, stable IDs and bounded retrieval. See the [catalog guide](docs/component-catalog.md).

The optional `corpus: "components"` selector preserves the existing `apexlang` default and reference IDs. `apexrest@1.1.0` was published as npm `latest`; the [publication record](docs/evidence/npm-110-publication.json) confirms registry integrity and clean local/global installs.

## 1.0.0 — current-session release

- Work directly in the open Codex conversation; remove plugin-owned model sessions, task registration, role routing, team tools/skill and panel controls.
- Keep 18 MCP tools and 12 focused skills, Oracle/APEX operations, SQLcl/ORDS, bounded references, recoverable jobs and deployment/test safeguards.
- Simplify the bilingual guides and site; preserve the original specification and past JSON evidence as historical input.

See [release notes](docs/release-notes.md) and [current local evidence](docs/evidence/current-session-100-local.json) for validation and distribution status.

## Historical entries

The entries below describe earlier releases. Their removed features remain unavailable in later releases; publication statements refer to the date/version recorded.

## 0.5.0 — stable release

- Promote the reviewed `0.5.0-beta.1` code and pinned Oracle APEXlang reference snapshot to package and plugin version `0.5.0`; no new component behavior is claimed.
- Publish `apexrest@0.5.0` as npm `latest` and remove the npm `beta` dist-tag. The [publication record](docs/evidence/npm-050-stable-publication.json) tracks the actual registry outcome; the earlier beta remains available by exact version.
- Keep the release-readiness gate honest: native-platform, Oracle integration and recovery evidence required for full qualification is still incomplete. See the [release notes](docs/release-notes.md).

## 0.5.0-beta.1 — minor beta

- Refresh the pinned Oracle APEXlang references and plugin skills from Oracle's September 21 release notes and the upstream snapshot merged on September 22.
- Cover Media List, Comments and Metric Card report/partial workflows; Smart Filters and Search; and the expanded Cards and Region Display Selector contracts.
- Preserve the reviewed APEX 26.1 compiler baseline and the existing source-preservation, validation and deployment safeguards.

The npm release target is `apexrest@0.5.0-beta.1` on the `beta` channel; the [publication record](docs/evidence/npm-050-publication.json) tracks publication status and registry verification. No Git tag or GitHub release is part of this update. Earlier verification reports retain their original versions and scope; refreshing references does not establish new Oracle or native-host coverage. See the [release notes](docs/release-notes.md) for this update and its verification.

## 0.4.0-beta.1 — minor beta

- Let six long MCP tools start once and wait for completion in the same call. Preserve the job identity, propagate terminal failure to the MCP error result and retain diagnostics, run IDs and artifacts.
- Batch up to eight scoped metadata reads with one target verification; return compact project context without source hashing or Oracle access when full inspection is unnecessary.
- Shorten skills and tool descriptions, reuse reference normalization and preserve bounded output with recoverable details and deployment-plan safety information.

The product remains exclusive to Codex desktop and CLI. Deployment authorization, target identity, backups, drift checks and unknown-outcome safeguards remain enforced. See [version-specific local verification](docs/evidence/minor-040-local.json) and [release notes](docs/release-notes.md). Earlier reports retain their versions and source digests; this minor release does not establish new Oracle/native task coverage or billed-token savings. The authorized commit/push does not create a Git tag, GitHub release or npm publication; stable qualification remains open.

## 0.3.0-beta.1 — local minor beta (unpublished)

- Return three reference search results by default, with explicit pagination for more. Keep alternative APEXlang process types separate from required dependencies.
- Keep large MCP results compact while preserving success, failure and unknown outcomes. Store recoverable details outside project sources, preserve JSON pagination and deliver complete panel snapshots through UI metadata. Add UTF-8 payload budgets and repair the local optimization benchmark.

These changes retain the existing deployment safeguards and ORDS functionality. Historical Oracle evidence keeps its original version and scope; this entry claims no new connected verification or measured billing reduction. This candidate has no Git tag, GitHub release or npm publication. See [release notes](docs/release-notes.md) and [remaining gates](docs/next-actions.md).

## 0.2.0-beta.1 — local minor beta (unpublished)

- Add plugin-wide **Direct Oracle listener / ORDS HTTP(S)** selection for SQL access when the database listener is unavailable. Store ORDS schema URL, database username and password locally at plugin level, with independent read/deploy references.
- Implement ORDS APEXlang export/adoption and import, SQL backup export and restore. Import uses the Oracle compiler and one REST request to preserve installation state; export preserves Oracle metadata and binary files. Existing approval, identity, backup, drift and unknown-outcome checks remain enforced.
- Clarify **Database username** and **Database password** as credentials of an existing Oracle database account. Add a direct-mode saved SQLcl connection selector with loading, refresh, empty and retry states; preserve both direct mappings and ORDS credentials when switching transport.

- Maintain English and Ukrainian guides, README files and diagrams, with reciprocal language links.
- Add Ukrainian site routes, localized navigation and search, and a switch to the same page in the other language.
- Check documentation coverage, executable-example parity and local links alongside the site packaging checks.

Existing [connected evidence](docs/evidence/ords-connected.json) verifies one unchanged APEXlang round trip: all 21 files matched byte for byte, and the SQL backup was created and checksum-verified. A separate installed-plugin MCP export matched those files. SQL restore, changed imports, broader component variants, interrupted-response recovery and Windows remain unverified; application browser verification was deferred. [Settings checks](docs/evidence/connection-settings-local.json) and [native discovery](docs/evidence/connection-settings-native.json) retain their separate UI/local-store scope. These reports retain their original `0.1.0-beta.1` build versions and source digests; they are not new connected runs of this minor beta.

This version is a local candidate, not a published GitHub or npm release. No tag or publication is implied by the version change. See [release notes](docs/release-notes.md) and [remaining gates](docs/next-actions.md).

## 0.1.0-beta.1 — repository distribution

- Install directly from the GitHub repository through a native Codex marketplace. The checked-in bundle includes the CLI, MCP server, references, templates and eight skills.
- Verify bundled files against source and artifact hashes in local checks and Linux, macOS and Windows CI. Regenerate the bundle with `npm run plugin:sync` after source changes.
- Fix native MCP startup from Codex's installed cache; require an explicit workspace path for project operations.
- Add English onboarding, configuration, architecture, testing, security and contributor documentation, plus accessible architecture and deployment diagrams.
- Render documentation tables, diagrams, lists and anchors on the static site, with validated links and safe Markdown handling.
- Preserve the optimized APEX workflow: reuse discovery, combine independent reads, validate during planning, and complete authorized test-app imports with backup, identity and drift checks.

This is the initial public beta source distribution. It is not a signed stable release. Real Oracle and native-host results retain their scope and source digests; the [release gates](docs/next-actions.md) remain authoritative.
