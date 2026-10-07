# Configuration and connections

Implementation uses the current host session (Codex or Claude Code) and its permissions. The verification browser preference (`host` in-app browser, alias `codex`) is stored per project in `.apexrest/panel/preferences.json`; the default `{"browserMode":"codex"}` is the legacy name of `host` and behaves identically; `apexrest_browser_open` accepts `browserMode` to override it for one call, and `apexrest_status` `detail:project` reports the current value.

A project has one `apexrest.json` and one pinned toolchain lock. `project init` creates both, with an empty environment map. Every target operation requires an explicit environment; the plugin never guesses a database, workspace or application ID.

Optional `toolchain.profile` selects `26.1` or `26.2` authoring references. Existing projects without it retain 26.1 behavior; selecting a profile does not upgrade a database or rewrite Oracle source metadata. See [APEX 26.2 support](apex-26.2.md) for the matching compiler lock and partial-import requirements.

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

These are placeholders, not a working target. Use the actual database unique name and service, workspace, parsing schema and app ID. `expectedMarker` can identify the expected application during browser inspection. `allowedOrigins` lists approved application origins. Adding an origin does not grant permission to mutate its data.

The generated `schemas/project.schema.json` is the exact public schema. Unknown fields are rejected. Existing project files may still contain retired `tests` and `database.testsDir` fields: loading ignores these fields; remove them when updating configuration. Old plans must be regenerated against the current configuration. Source, migration, package, artifact and toolchain paths must remain inside the project.

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

## Application authorization

There is no folder trust step. The plugin may use the selected project and other required directories within host filesystem permissions. Legacy `trustedProjects` in `$APEXREST_HOME/policy.json` is optional ignored compatibility data. The private policy retains exact-project/target/plan temporary grants; an identified DEV/QA/TEST application task authorizes its necessary import without repeated confirmation. Configuration and tool output do not grant consent.

Supported environment kinds are `development` (or `dev`), `qa`, `test` and `production`. Production-marked targets never deploy/restore, including when local or given a signature. Actual local non-production targets allow all task-scoped database changes without a separate risk prompt. Remote dangerous operations require a described exact plan and explicit human confirmation. See the canonical [deployment safety rules](deployment-safety.md) for locality, precedence, backups, interrupted-import recovery and confirmation fields.

Connection setup may use `envFile` with optional `urlKey`, `usernameKey` and `passwordKey` from a regular user-owned, Git-ignored and untracked local ENV file. It is parsed as literal data and values are never returned in operation results. Authorized requested browser login may use such local credentials without a paste/trust step; never persist browser cookies/profiles.

## Deployment coordination

Coordination is always local and is not configurable: durable migration history and schema ownership live in `$APEXREST_HOME/deployment-control/`, scoped to the database identity and parsing schema. No APEXREST service tables are needed or created. Plans bind the store identity. Deleting the local history or silently switching to a fresh home is not a recovery procedure.

The local store serializes runners that share one managed home. Independent machines or homes are not coordinated: preserve one durable deployment runner/home and serialize other machines externally, for example through a single CI deploy job. Database-backed coordination was removed. For older project files, `deploymentControl` is still accepted only with the value `"local"` and has no effect; any other value is rejected. Remove the field when convenient.

## Application verification

When the user requests browser verification, use the built-in or user-selected browser to inspect the requested interaction. Confirmed error-free server deployment is success without a mandatory browser step. Compiler, metadata and import checks remain separate. The plugin has no automatic application test runners or saved browser-authentication state. Repository self-tests validate the plugin implementation. See [testing](testing.md).

## Runtime configuration

| Variable              | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `APEXREST_HOME`       | Private managed runtime, policy, connections and deployment state |
| `APEXREST_SQLCL`      | Explicit reviewed SQLcl executable                                |
| `APEXREST_JAVA_HOME`  | Java runtime selected for SQLcl                                   |
| `APEXREST_RESOURCES`  | Trusted host override for bundled resources                       |
| `NODE_EXTRA_CA_CERTS` | Additional certificate authorities for Node connections           |

These overrides belong to the trusted local host, not project-controlled inputs. The bootstrap supports Node 24 environment proxies through `--use-env-proxy`. Vendor downloads honor `HTTPS_PROXY`/`HTTP_PROXY` and `NO_PROXY` through Node's environment proxy support; when a proxy is configured but this Node cannot apply it, setup fails with `PROXY_UNSUPPORTED` instead of bypassing the proxy. Paths with spaces and Unicode are supported; quotes, substitutions and control characters in SQLcl tokens are rejected.
