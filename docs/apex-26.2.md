# APEX 26.2 partial APEXlang imports

**Import a changed page and its shared list of values without re-importing the rest of the application.** APEXREST selects eligible `.apx` files automatically or accepts an explicit list, validates dependencies using retained application context and fresh selected server sources, and preserves unrelated remote changes.

> **Source version:** this guide describes the `2.9.0` source bundle. Use its bundled runtime or plugin; a separately published package must be checked for feature compatibility. APEX 26.1 projects use full imports.

## Choose an import mode

| Mode             | Planner behavior                                                                                                                      | When to use it                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `auto` (default) | Selects eligible application changes, or a database-only plan for pending scripts when the application is unchanged. Conflicts block. | Routine changes to an existing 26.2 development/test app.                   |
| `files`          | Imports only the listed files; rejects an ineligible selection and never widens it to `full`.                                         | A specific page, or a page together with changed shared dependencies.       |
| `full`           | Requests a complete application import through the existing safeguards.                                                               | Initial application creation or changes requiring the complete application. |
| `none`           | Plans pending migrations and changed package scripts without importing the application.                                               | Explicit database-only work.                                                |

- The CLI and the `apexrest_ship` MCP tool expose the same modes.
- The requirement to use **direct SQLcl CLI** describes how APEXREST connects to Oracle; it does not prevent using the feature through Codex or Claude Code's APEXREST MCP tools.
- SQLcl's own `mcp` execution mode and the ORDS transport are separate options and do not support partial import in this implementation.

## Generate routine pages

For supported reports, cards, charts, calendars, query forms and native page behavior on an Oracle-generated 26.1 or 26.2 Universal Theme starter, use one JSON specification containing verified queries, PL/SQL, column aliases/types and labels. `project scaffold` emits native APEXlang and navigation together. See the [specification guide](../plugins/apexrest-apex/skills/apexrest-work/references/scaffold.md). Partial import described on this page remains specific to 26.2.

```sh
apexrest project scaffold --project /abs/project --spec-file catalog.json --env dev --json
apexrest ship --project /abs/project --env dev --mode apply --user-request "Create the catalog pages in the configured dev app" --json
```

Scaffolding changes local sources only. It retains Oracle metadata and authentication, appends to a blank Home and refuses to replace unowned or manually edited pages. Unchanged pages it generated can be updated by re-running a specification. Ship remains responsible for compiler validation, exact planning and the normal deployment safeguards; a separate validate/plan call is unnecessary for routine generated output.

If a task requests server metadata and query observations on 26.2, supplying `env` also generates `readback.sqlFile` in private `.apexrest/` storage. The 26.1 scaffold reports this helper as unavailable. After a successful import, the caller can run the generated file manually with the authorized SQLcl saved connection. It checks target identity and returns imported metadata, query row counts and bounded samples in a read-only transaction. It does not contain expected business values or a test verdict. Neither scaffold nor ship executes it or adds a deployment gate. Keep observation scripts outside application sources. Browser behavior is checked separately on request.

## Edit existing pages

`apexrest project patch` changes one property without rewriting the page: a page title, region title, item or button label, report-column heading or format mask, or a layout sequence. Only the value bytes of that property change, and a missing property or group is inserted in the file's own style. The edit is bound to the digest of the page file you read and checked again right before the atomic write; a dry run, or a call without the digest, returns the current digest and writes nothing.

```sh
apexrest project patch --project /abs/project --page 10 --operations '[{"target":"column:customers.EMAIL","property":"heading","value":"E-mail address"}]' --dry-run --json
apexrest project patch --project /abs/project --page 10 --operations '[{"target":"column:customers.EMAIL","property":"heading","value":"E-mail address"}]' --expected-digest <currentDigest> --json
```

A source edit is not a compiler or import result; validate or ship afterwards. See the [patch guide](../plugins/apexrest-apex/skills/apexrest-work/references/patch.md).

## Requirements

| Requirement       | Reviewed support                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Target and source | Existing development/test application on APEX 26.2, with Oracle-exported 26.2 APEXlang sources.         |
| Compiler          | SQLcl `26.3.0.260.1620`, Oracle-generated MMD `26.2.0+3479`, and observed `apex import -files` support. |
| Connection        | SQLcl `cli` mode with a `direct` database connection.                                                   |
| Project           | Configured target identity, named connection references and a valid sync checkpoint.                    |
| Selection         | Supported new/modified page and shared-component `.apx` files, including required changed dependencies. |

APEX 26.2 requires SQLcl and ORDS 26.3 or later. APEXREST's partial-import gate deliberately accepts the exact reviewed compiler/MMD tuple and 26.2 target stream. Target releases are checked; a future version is not automatically qualified.

### Select the 26.2 toolchain

- Install the matching compiler with `node "$APEXREST_CLI" dependencies install --project "$APEXREST_PROJECT" --json` (or `setup --project`). The first run previews the plan; add `--yes --accept-oracle-license` to install. Both use the project's toolchain lock, also when run from the project root (the folder that holds `apexrest.json`; subfolders are not searched). Without a project the managed installer keeps the 26.1 baseline. `APEXREST_SQLCL` still selects an external compiler.
- Set `toolchain.profile` to `26.2` for authoring references and use the reviewed `toolchains/toolchain-26.2.lock.json` as the project's toolchain lock.
- Changing the reference profile alone does not install a compiler or upgrade source metadata.
- Existing project/toolchain changes require explicit refresh or re-establishment of the sync baseline.
- A new app generated by the selected 26.2 compiler records its profile and matching lock.

## Quick start from an updated checkout

The following examples assume a configured application project with an environment named `dev`. Replace the absolute paths and example page/LOV filenames with your project's values. These commands use the checkout runtime described in this guide.

### 1. Configure SQLcl and initialize the baseline

```sh
APEXREST_CLI="/absolute/path/to/apexrest/plugins/apexrest-apex/runtime/apexrest.mjs"
APEXREST_PROJECT="/absolute/path/to/application-project"

node "$APEXREST_CLI" sqlcl configure --mode cli --database-transport direct --json
node "$APEXREST_CLI" apex sync --project "$APEXREST_PROJECT" --env dev --action init --json
```

- Initialize the baseline before editing.
- Initial sync refuses conflicting local sources; retain and reconcile them rather than overwriting them.
- A freshly generated application is the exception for two rewrites Oracle makes on import: `deployments/default.json` gains the configured `app.id`, and an empty deinstall script and its reference are dropped. When those are the only differences, init adopts the server form of the affected files and lists them in `normalized`.
- After a successful full `ship` of local sources (for example after `--action invalidate`), init also adopts the server export when the local sources are exactly what that run imported to the same target and the target's update metadata is unchanged since that import. The differences are then Oracle's canonical rewrites of the imported bytes (unquoted names, inline `sqlQuery`, canonical slot names, dropped defaults, added identifiers). The adopted files are listed in `normalized` with rule `last-import-rewrite`, and `normalizedFromDeploymentRunId` names the run; its `snapshot/` keeps the imported bytes. A local edit after the import, a server change, another target, a selected-file or restore run, or no recorded import still conflicts.
- `SYNC_SOURCE_CONFLICT` names each differing file in its diagnostics and lists them in `addedFiles` (local only), `removedFiles` (expected but missing locally) and `changedFiles`, up to 50 each with `differingFileCount`. During init, `importProof` says why the last import did not explain the difference: `no-recorded-import`, `local-changed-since-import` or `server-changed-since-import`.
- An already initialized ready working copy can be reused.

### 2. Edit, then apply

After editing, ordinary authorized work needs one apply call: it compiles and plans before import. Use a separate plan preview only when review is useful:

```sh
node "$APEXREST_CLI" ship --project "$APEXREST_PROJECT" --env dev --mode plan --import-mode auto --user-request "Update the Home page and status LOV in the configured dev application" --json
node "$APEXREST_CLI" ship --project "$APEXREST_PROJECT" --env dev --mode apply --import-mode auto --user-request "Update the Home page and status LOV in the configured dev application" --json
```

### 3. Or import an explicit selection

For an explicit selection, list exact files. Shared components use a full APEXlang observation because native component export is not qualified on the tested server; the import still touches only these files:

```sh
node "$APEXREST_CLI" ship --project "$APEXREST_PROJECT" --env dev --mode plan --import-mode files --files pages/p00001-home.apx shared-components/lovs/status.apx --user-request "Import only the Home page and status LOV into the configured dev application" --json
node "$APEXREST_CLI" ship --project "$APEXREST_PROJECT" --env dev --mode apply --import-mode files --files pages/p00001-home.apx shared-components/lovs/status.apx --user-request "Import only the Home page and status LOV into the configured dev application" --json
```

- Paths are relative to the configured application source directory.
- `files` requires a nonempty list; globs, path escapes, symlinks and duplicates are rejected.
- The MCP equivalents are `importMode: "files"` and `files: ["pages/p00001-home.apx", "shared-components/lovs/status.apx"]` on `apexrest_ship`.

### Apply a particular saved plan

- `ship --mode apply` prepares a fresh plan and then binds its grant to that plan; it does not consume the earlier preview file.
- To execute a particular saved plan, use the granular `deploy plan` / `deploy apply` flow with its exact-plan authorization.
- Once a plan is bound for apply, its selection cannot widen.

## What the planner checks

### Baseline, local edits and server export

The planner compares the **saved baseline**, **local edits** and **fresh export of the selected server components**.

- Local changes identify the intended update.
- Unselected remote changes are preserved on the server and are not fetched into local context.
- Unequal local/server edits to the same component block planning.
- Retained dependency context and the selected server sources form an effective application validated as a whole, so a selected page cannot depend on an unselected new local LOV missing from the server.
- Include required changed dependencies in the reviewed list.

Review `importSelection.requestedMode`, `resolvedMode`, `files`, supporting-component selections and `reasons`. The compact preview shows at most 50 selected paths; use the full saved plan for a longer list.

### Pages and shared components

- Fast native export mappings cover page files.
- Supported shared-component files also use selected imports, but Oracle 26.2 rejects native APEXlang LOV/list export selectors.
- Their plans therefore expose `exportScope:full` and `shared-components-require-full-apexlang-observation`: a full APEXlang read is filtered to the selected sources for conflicts, backups and readback. This is a performance limit, not a full import.

### What requires a full import or blocks

- Themes, templates, plug-ins, workspace components, static assets and authentication/authorization changes require a full import; explicit files mode refuses them.
- Deletions, initial application creation, production, database operations and unsupported transports can require a full plan or block the operation under existing safeguards.
- Known remote changes must be reconciled before an automatic full fallback.
- Explicit `files` mode never becomes `full`.
- Database scripts require a full application import and the local/remote safety policy; production deployment is forbidden.

## Backup, verification and recovery

### Plans and grants

- Version 4 plans bind the exact file list, source/configuration/toolchain hashes, target, fresh server export and validated effective tree.
- Existing saved plans keep their previous full-import semantics.
- The temporary deploy grant binds the whole plan digest.

### Exports and backups

- Page-only plan/apply uses native `apex export -expComponents` in the selected scope and never exports the complete application.
- Shared-component selections use the explicitly recorded full APEXlang observation; their retained snapshots and import scope remain selected.
- Existing pages need a selected export; new pages have a live ID collision check and no export when absent.
- The pre-apply selected export is also the backup source, avoiding a separate backup round trip.
- Backups record scope, exact files, checksums and absent components.
- Full changes use full APEXlang snapshots.
- Ordinary operation creates no SQL application dumps; explicitly requested restore of an existing legacy SQL backup remains compatible.

### Apply and concurrency

- Apply acquires managed-home schema ownership before the fresh drift comparison, freezes the effective tree and runs one SQLcl `apex import -files` command.
- Same-component changes after planning block; different-page edits do not.
- Independent homes/machines still require external serialization.
- There is no claim of a distributed atomic compare-and-import protocol.

### Readback verification

- After page imports, only selected APEXlang sources are exported and compared.
- Shared-component imports use a full APEXlang observation and compare only selected files; the observation scope is recorded separately.
- Qualified Oracle 26.2 default elision covers native select-list/region start-new-row, checksum page protection and bar-chart type; uniquely identified regions with explicit unique layout sequences and native chart axes/series may be reordered.
- Scalar strings, fenced code, nondefault security values and ambiguous identities stay strict.
- Unknown forms fail closed.
- Both hashes and rules are retained in `readback-verification.json`, alongside selected scope and an explicit indication that unselected server content was not checked.

### Checkpoint and recovery

- The checkpoint retains local dependency context plus verified selected sources; unselected local work remains dirty.
- Concurrent local edits are retained and require reconciliation.
- A confirmed import with failed readback is a verification failure; an unconfirmed write is `outcome_unknown`.
- Recovery reads only the original scope before deciding whether the result is already applied or needs a fresh plan.
- It does not blindly retry or roll back Oracle.

### Restore

- Selected APEXlang backup restore creates a separate exact plan and uses the same scoped compiler/import/readback flow.
- A creation backup records absence, so it cannot pretend to undo creation by importing an empty file set; component deletion needs a separately reviewed operation.
- Before/effective/readback snapshots, backups and journals remain durable and private.

### One apply call for routine edits

- Use one `ship --mode apply` call for a routine authorized edit. It includes compiler validation and planning; a separate validate and plan preview add duplicate work.
- Preview remains available when review is useful or a remote dangerous operation requires exact-plan confirmation.
- With a valid working-copy checkpoint and unchanged application files, `auto` checks local migration/package history. Pending migrations or changed packages produce a database-only plan; no APEX application import is scheduled. An explicit `files` selection never expands to database work.
- A local no-op (including unchanged applied database scripts) stops before Oracle calls and explicitly reports that server freshness was not checked. Changed applied migration checksums or unresolved migration outcomes block planning.
- Identity and release discovery share a read-only session, identical read/deploy connections reuse the fresh identity observation, and import help is cached by compiler installation.

## Other 26.2 support

- Validation reports advisory CodeScan findings and source-upgrade hints separately from compiler diagnostics. Scanner unavailability is explicit and does not convert compilation success into a scanner pass. Some findings are known false positives; see below.
- The new corpus covers provider APIs, unspecified versus explicit reasoning effort, secure agent navigation, Interactive Reports, workflow/task changes, charts and Universal Theme, DDS, managed credentials and deployment metadata.
- Six original recipe fragments have real offline compiler evidence. They do not establish provider availability, database policies, running-workflow migration, application imports or browser behavior.
- Effective deployment JSON preserves source defaults, subscription mappings and checksum salts while the configured target controls application/workspace/schema identity. Native Oracle Working Copies and application locking remain distinct from APEXREST's local sync state; API examples do not automatically create copies or acquire locks.
- Security readiness requires actual database capabilities, verified identity propagation, OCI IAM and network permissions. Credential/policy provisioning remains operator-managed. Database-backed Web Credentials do not enforce the `Valid for URLs` restriction; use the parsing schema's network controls.

### CodeScan known false positives

SQLcl 26.3 CodeScan reports three application-level rules on `application.apx` line 0 that APEX 26.2 sources cannot clear. Oracle owns the rules; APEXREST does not change or hide them. With SQLcl 26.3 and an MMD 26.2 source, `staticAnalysis.findings` keeps each finding and adds `knownFalsePositive` (`policy`, `profile`, `reason`, `evidence`) only when `application.apx` itself proves the setting. `staticAnalysis.knownFalsePositives` counts them, and `knownFalsePositivePolicy` names the table version (`apex262-sqlcl263-codescan-v1`, in `packages/core/src/codescan-known-issues.ts`).

| Rule                              | Marked when `application.apx`                                                                                    | Stays actionable when                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| APEX-002 non-public page access   | sets `authentication { scheme }` and `authorization { scheme }` (a component reference or `mustNotBePublicUser`) | either scheme is absent or empty                                                                          |
| APEX-009 session state protection | omits `sessionStateProtection`, omits its `enabled` (default Y) or sets `enabled: true`                          | `enabled` is `false` or another value                                                                     |
| APEX-031 substitution ambiguity   | leaves `advanced.exactSubstitutions` at its default Y                                                            | it sets `exactSubstitutions` (the compiler rejects `true` and accepts `false` with a deprecation warning) |

The source reader fails closed: duplicate groups or properties, unsupported source forms, a missing file, another file, another SQLcl release or another MMD release leave the finding unmarked. Findings marked `knownFalsePositive` need no source change; do not rewrite authentication, authorization or session state protection to clear them.

Reproduced offline on 2026-11-16 with SQLcl 26.3.0.260.1620 `codescan -extensions apx -format json` on copies of an MMD 26.2.0+3479 application. All three findings remained for every variant tried: application authorization with a component or `mustNotBePublicUser`; no application authentication/authorization; `authorizationScheme` (with and without `authentication: required`) on every non-public page; `sessionStateProtection.enabled` true, false, absent or invalid; every page-item checksum protection removed; and `exactSubstitutions` true, false or `Y`. Removing `errorHandling` and `sessionManagement` raised APEX-029 and APEX-024, which shows that application properties are read. This is local scanner evidence, not a security qualification of any application.

### Read-only capability diagnostics

For bounded read-only diagnostics, call `apexrest_metadata_read` with `kind: "apex-capabilities"`, the configured parsing `schema` and `env`. Results include actual releases, visible public APIs, application lock/Working Copy observations, and explicit operator-verification requirements. Metadata visibility does not prove API execution or security enforcement.

### Major-version source upgrades

- Major-version source upgrades require a reviewed import/re-export into a separate directory, followed by explicit checkpoint refresh.
- Never edit `.apex/apexlang.json` to pretend that old sources use the new compiler.
- Keep old source and backup snapshots; an export with `-force` can remove its destination alias directory.

Sources: [APEX 26.2 release notes](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/index.html), [file import rules](https://blogs.oracle.com/apex/introducing-file-level-import-with-apexlang-in-oracle-apex), [requirements](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/about-release-notes.html), [deployment metadata](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/understanding-apexlang-deployment-files.html), [source upgrade](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/upgrading-apexlang-source-with-new-apex-release.html), [managed credentials](https://blogs.oracle.com/apex/using-dbms_cloud-credentials-with-resource-principal-and-dbtools-identity).

## Complete Oracle authoring inventory

The [official inventory coverage](oracle-apexlang-coverage.md) includes all 389 definition documents and the upstream layout/syntax catalog.

- Select `version:26.2`, search `corpus:components` and read the returned `oracle:26.2:inventory/...` ID through all pages.
- Every contextual property, enum and applicability condition is retained.
- Local 26.1 UX recipes remain separately version-bound.
- Full source coverage does not qualify database, provider, import or browser behavior.

## Related

- [Existing applications](existing-app.md): adopt an application and create the sync checkpoint.
- [Deployment safety](deployment-safety.md#apex-262-partial-imports): the canonical rules for partial imports, backups and recovery.
- [Configuration](configuration.md): `toolchain.profile`, environments and connections.
