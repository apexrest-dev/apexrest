# Configuration and connections

Implementation uses the current host session (Codex or Claude Code) and its permissions. The verification browser preference (`codex` host browser or `external` system browser) is stored per project in `.apexrest/panel/preferences.json` as `{"browserMode":"codex"}`; `apexrest_browser_open` accepts `browserMode` to override it for one call, and `apexrest_status` `detail:project` reports the current value.

A project has one `apexrest.json` and one pinned toolchain lock. `project init` creates both, with an empty environment map. Every target operation requires an explicit environment; the plugin never guesses a database, workspace or application ID.

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

These are placeholders, not a working target. Use the actual database unique name and service, workspace, parsing schema and app ID. `expectedMarker` must match an application-specific DOM marker when your tests require it. `allowedOrigins` must list the origins needed by browser/API tests, including any approved SSO or CDN redirects. Adding an origin does not grant permission to mutate its data.

The generated `schemas/project.schema.json` is the exact public schema. Unknown fields are rejected. Source, test, migration, package, artifact and toolchain paths must remain inside the project.

## List and test saved SQLcl connections

Checking database access requires no project or APEXREST alias:

```sh
apexrest connection list --saved --json
apexrest connection test 'Development connection' --saved --json
```

These commands read the SQLcl store directly and test the exact saved name with a read-only identity query. If the store is empty or credentials are missing, configure them in SQLcl. You can then register references for a project environment as described below. CLI commands without `--saved` use those references; in the conversation, `apexrest_project` `action:connection_list` and `action:connection_test` do the same.

The SQLcl mode (`cli` subprocess or `mcp`, the official SQLcl stdio server) and the database transport (`direct` listener or `ords`) are saved per managed home with `apexrest sqlcl configure --mode cli|mcp --database-transport direct|ords --json`; `apexrest sqlcl status --json` reads them. For HTTP access when the listener is unreachable, configure plugin-level ORDS URL, username and password and select the `ords` transport. See [SQL through ORDS](ords.md). The saved SQLcl connections below apply to direct access.

## Save connection references

Create named connections interactively in SQLcl's local connection store. Then register their names:

```sh
apexrest connection add dev-read --sqlcl-name saved-read-connection
apexrest connection add dev-deploy --sqlcl-name saved-deploy-connection
apexrest connection test dev-read --json
```

The examples assume the [managed CLI launcher](getting-started.md#use-the-cli). APEXREST stores connection names rather than passwords. A read connection can use fewer privileges than its deploy counterpart. Removing an APEXREST reference with `connection remove` preserves the SQLcl store entry. Never put credentials in `apexrest.json`, environment examples, prompts or issue reports.

## Trust and authorize a project

Private policy lives at `$APEXREST_HOME/policy.json`, defaulting to `~/.apexrest/policy.json`. Review executable project code before adding its canonical path to `trustedProjects`:

```json
{
  "schemaVersion": 1,
  "trustedProjects": ["/canonical/reviewed/project"],
  "grants": []
}
```

Keep this policy outside the repository. A grant binds `projectRoot`, the plan's exact `targetDigest`, an expiry and the permitted `deploy` or `test` operations. A deploy grant, including one for restore, must also carry `planDigest` equal to the exact plan digest and an `expiresAt` no later than the plan's expiry; otherwise apply is blocked with `DEPLOY_APPROVAL_REQUIRED`. The policy schema still accepts a grant without `planDigest`, but such a grant never authorizes a deploy. Test grants bind project, target, operation and expiry.

For an explicit request to create, update or import an identified development/test app, `apexrest_ship` `mode:apply` records that already supplied authorization (the `userRequest` text) as a short-lived grant with the exact current `planDigest`, `deploy` only, `grantedBy: "ship"` and expiry no later than the plan. It preserves unrelated grants and removes the task grant after the attempt. A project file or a tool response cannot supply that consent, and the agent never edits grants by hand. Different targets, business-table mutations, authentication changes and protected production actions require their corresponding scope.

Production requires the external signature workflow and the administrator-owned `$APEXREST_HOME/production-trust.json` described in [deployment safety](deployment-safety.md#production-approval); a writable local policy is not a substitute for a protected runner. A target listed in that file's `productionTargets` is production even when its `apexrest.json` environment has another `kind`.

## Deployment coordination

Coordination is always local and is not configurable: durable migration history and schema ownership live in `$APEXREST_HOME/deployment-control/`, scoped to the database identity and parsing schema. No APEXREST service tables are needed or created. Plans bind the store identity. Deleting the local history or silently switching to a fresh home is not a recovery procedure.

The local store serializes runners that share one managed home. Independent machines or homes are not coordinated: preserve one durable deployment runner/home and serialize other machines externally, for example through a single CI deploy job. A former `deploymentControl` field is no longer accepted; remove it from `apexrest.json`.

## Select test scope

`tests.requiredSuites` selects the suites that must pass. `tests.mutationAllowedEnvironments` lists the explicitly configured environments where remote tests may mutate data. Production tests are prohibited, including targets classified as production by `production-trust.json`. An empty, skipped or blocked required suite fails its gate.

A blank application or explicitly authorized isolated application-only profile can have no automated suites. In that case, report that none ran and record actual compiler, source-query and in-app observations separately. Do not remove required CRM or existing integration suites simply to make a gate pass. See [testing](testing.md).

## Runtime configuration

| Variable              | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `APEXREST_HOME`       | Private managed runtime, policy, connections and deployment state |
| `APEXREST_SQLCL`      | Explicit reviewed SQLcl executable                                |
| `APEXREST_JAVA_HOME`  | Java runtime selected for SQLcl                                   |
| `APEXREST_RESOURCES`  | Trusted host override for bundled resources                       |
| `NODE_EXTRA_CA_CERTS` | Additional certificate authorities for Node connections           |

These overrides belong to the trusted local host, not project-controlled inputs. The bootstrap supports Node 24 environment proxies through `--use-env-proxy`. Vendor downloads honor `HTTPS_PROXY`/`HTTP_PROXY` and `NO_PROXY` through Node's environment proxy support; when a proxy is configured but this Node cannot apply it, setup fails with `PROXY_UNSUPPORTED` instead of bypassing the proxy. Paths with spaces and Unicode are supported; quotes, substitutions and control characters in SQLcl tokens are rejected.
