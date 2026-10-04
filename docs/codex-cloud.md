# Run APEXREST in Codex Cloud

English | [Українська](codex-cloud.uk.md)

Run APEXREST's bundled **CLI inside the Cloud container**, using ORDS over HTTPS for database access. The example below adapts a project-specific Cloud bootstrap into reusable scripts. It does not register the desktop plugin, expose its MCP tools to the Cloud agent, or start the desktop development panel. Those integrations require their own host verification; see the [Codex integration audit](codex-integration.md).

## 1. Prepare your application repository

Copy the files in [the Cloud example directory](examples/codex-cloud/) into `scripts/codex-cloud/` in the application repository connected to Codex Cloud. Keep all files together. From your application repository, with a local APEXREST checkout available:

```sh
mkdir -p scripts/codex-cloud
cp /path/to/apexrest-codex/docs/examples/codex-cloud/* scripts/codex-cloud/
```

Add these entries to the application's `.gitignore` before running setup:

```gitignore
.codex/cloud/
.apexrest/
```

Commit the example scripts and ignore rules to the repository's default branch used for Cloud cache preparation, and ensure they are also present on the task branch. Cloud checks out the task branch when resuming the cache; see [container caching](https://learn.chatgpt.com/docs/environments/cloud-environment). Generated tools, credentials, logs, plans and backups must remain private. The scripts are documentation examples, not files automatically installed by the plugin or its npm package.

The [version file](examples/codex-cloud/version.sh) pins a built distribution at Git commit `d8405d935d621d021523d4a17d9dd3d5e959fcb5`, with manifest version `0.2.0-beta.1+codex.20260919143707`. Setup verifies both values and uses `plugins/apexrest-apex/runtime/apexrest.mjs`; it needs neither an npm release nor a TypeScript build. Review and change both pins together when adopting a later build.

## 2. Configure the Cloud environment

Select your application repository in Codex Cloud environment settings. Select **Node.js 24** and **Java 21** under package versions. Java must be a **JDK with `jdk.compiler`**, not just a JRE. Git and Bash must also be available.

Set the following environment variables. Replace every target placeholder with values supplied for your development/test environment:

| Variable                         | Value or purpose                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CODEX_CLOUD`                    | `1`; explicit opt-in to this example's Linux setup.                                                              |
| `APEXREST_ACCEPT_ORACLE_LICENSE` | `1` only after accepting the [Oracle terms](https://www.oracle.com/downloads/licenses/oracle-free-license.html). |
| `APEXREST_PERSIST_CREDENTIALS`   | `1` only if you authorize the credential retention described below.                                              |
| `APEXREST_ORDS_URL`              | Schema URL, for example `https://ords.example.invalid/ords/app_user/`.                                           |
| `APEXREST_ORDS_USERNAME`         | Database username, for example `app_user`; the schema alias may differ.                                          |
| `APEXREST_CONNECTION_REF`        | A local reference name, for example `cloud-dev` (the default).                                                   |
| `APEXREST_EXPECTED_SCHEMA`       | Optional exact expected parsing schema from the identity check.                                                  |
| `APEXREST_EXPECTED_SERVICE`      | Optional exact expected database service from the identity check.                                                |

Add **`APEXREST_ORDS_PASSWORD` as a Secret**, not a normal environment variable or repository file. The account must already have authorized access to REST-Enabled SQL on that ORDS schema. Use the schema URL, not an APEX application URL or the `/_/sql` endpoint; see [ORDS configuration](ords.md).

Cloud secrets are available during setup, then removed from the agent environment. This example deliberately retains a credential file for later CLI commands. Cloud container caching can retain that file, and Business/Enterprise caches can be shared by environment users. Use an environment whose users are authorized for that database account. See [OpenAI's Cloud environment documentation](https://learn.chatgpt.com/docs/environments/cloud-environment).

With `APEXREST_PERSIST_CREDENTIALS=1`, setup passes the secret through a temporary owner-only file to `connection add --password-file`, removes the temporary file, and keeps the APEXREST credential under `.codex/cloud/tools/credentials/` with POSIX mode `0600`. This is **not an encrypted vault**: the agent and processes running as the same user can read it. If this retention is unsuitable, do not enable the flag or use this connected example. Never print the secret, enable shell tracing, or include `.codex/cloud/` in commits or shared artifacts.

## 3. Set setup and maintenance commands

**Setup script:**

```sh
bash scripts/codex-cloud/setup.sh
```

**Maintenance script:**

```sh
bash scripts/codex-cloud/setup.sh --maintenance
```

Setup checks the pinned checkout, previews and installs managed dependencies with `--skip-browser`, prepares a private JDK, selects `sqlcl configure --mode cli --database-transport ords`, saves the connection and runs `doctor` plus a read-only database identity check. It creates no application or business data and grants no deployment permission.

Maintenance reuses the installed build and credentials, refreshes Java proxy/CA settings and repeats the connection check. It does not reinstall dependencies. For a missing build, changed pin or missing credential, rerun setup with the secret available. For credential rotation, update the Secret and rerun setup; retaining an old local credential is not rotation.

The launcher restores `APEXREST_HOME`, `APEXREST_JAVA_HOME` and the selected Node executable on every invocation. A setup-only `export` would not persist into the agent phase. Cloud may resume a cached container and run maintenance; after incompatible setup changes, use **Reset cache**. See [environment lifecycle](https://learn.chatgpt.com/docs/environments/cloud-environment).

## 4. Configure network access

Enable agent internet access for the exact ORDS hostname and allow **POST**, which REST-Enabled SQL needs even for read-only queries. Setup download access and agent-phase access are separate settings. See [OpenAI's agent internet access documentation](https://learn.chatgpt.com/docs/cloud/internet-access).

The example uses HTTPS because a Cloud HTTP proxy does not establish reachability to the Oracle listener on port 1521; plain `http:` ORDS URLs are accepted only for loopback. It makes no listener-connectivity assumption. Setup also needs access to the canonical GitHub repository and the dependency download hosts shown by the installer preview.

The [network helper](examples/codex-cloud/network.sh) enables `NODE_USE_ENV_PROXY=1`. Vendor downloads then honor `HTTPS_PROXY` and `NO_PROXY`; if a proxy is configured but the running Node cannot apply it, setup stops with `PROXY_UNSUPPORTED` rather than bypassing the proxy. The [Java helper](examples/codex-cloud/setup-java.mjs) copies the environment JDK into `.codex/cloud/java`, writes proxy settings to its private `conf/net.properties` and imports the environment CA bundle from `NODE_EXTRA_CA_CERTS` into its private `lib/security/jssecacerts`. It preserves the default trust roots and leaves the host JDK unchanged. APEXREST strips Java option environment variables for Oracle subprocesses, so `JAVA_TOOL_OPTIONS` alone is insufficient here.

The helper accepts an HTTP proxy without URL credentials, reading `https_proxy`, `HTTPS_PROXY`, `http_proxy`, then `HTTP_PROXY`. Host/domain entries in `NO_PROXY` are mapped to Java; CIDR entries remain proxied. Unsupported proxy settings fail explicitly. Keep TLS certificate verification enabled; refresh the private truststore when the environment CA changes.

## 5. Verify from a Cloud task

Start a task after successful setup and run these commands from the application repository. Replace `cloud-dev` if you chose another reference:

```sh
bash scripts/codex-cloud/apexrest doctor --json
bash scripts/codex-cloud/apexrest sqlcl status --json
bash scripts/codex-cloud/apexrest connection list --json
bash scripts/codex-cloud/apexrest connection test --name cloud-dev --json
bash scripts/codex-cloud/apexrest --help
```

Check the actual JSON and exit codes: the selected mode must be `cli`, network transport `ords`, and the connection identity must match your intended database/schema. A successful `doctor` command is insufficient: it reports probes separately and does not test the database. Its `nativeHost: requires-host-verification` and `database: not-configured` fields do not override a separately successful connection test. A missing local Codex executable also does not by itself prevent direct CLI/ORDS operations.

The connection reference belongs to APEXREST, not SQLcl's saved connection store; do not replace the command with `sql -name cloud-dev` or `connection test --saved`. Save only sanitized evidence; identity output can contain private target names.

## 6. Give the agent project instructions

Add a short Cloud-specific section to the application repository's `AGENTS.md`:

```markdown
## APEXREST in Codex Cloud

- Run APEXREST commands with `bash scripts/codex-cloud/apexrest`.
- Check doctor, SQLcl configuration and the configured connection identity first.
- Use SQLcl CLI with ORDS; this bootstrap does not register native plugin tools.
- Keep `.codex/cloud/` and `.apexrest/` private. Never print credentials.
- Do not run setup, native plugin registration or dependency downloads in every task.
- Use the configured project/environment and existing deployment safeguards.
- Report compiler checks, database checks and browser observations separately.
```

Before application work, configure the target in `apexrest.json`, including workspace, schema, application ID, database identity and the correct read/deploy references. Review project trust and retain validation, backup, exact-plan authorization, drift and unknown-outcome protections from [configuration](configuration.md) and [deployment safety](deployment-safety.md). Installation and a successful connection test do not authorize an import.

The example keeps local deployment history under `APEXREST_HOME`. Cloud caches are not durable backup storage or cross-container coordination: preserve private backups/history outside an expiring container and serialize runners before authorizing deployments. Do not reset away an unresolved operation's records or silently start fresh history against the same schema.

Browser dependencies are skipped. Browser checks require separately configured tools, authentication and actual observations. The CLI bootstrap does not establish that `$apexrest-work`, the in-app dashboard or automatic skill/MCP discovery work in Cloud. Use the launcher for the documented flow and report unavailable checks explicitly.

## Troubleshooting

| Symptom                                                  | Action                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Setup exits with “Skipping Cloud setup”                  | Set `CODEX_CLOUD=1` in environment settings.                                                         |
| Unsupported Node or no JDK compiler                      | Select Node 24 and JDK 21, then rerun setup.                                                         |
| Pinned checkout/runtime/credentials missing after resume | Rerun setup with the Secret; maintenance cannot reconstruct an uncached environment.                 |
| HTTP 401/403 or failed identity check                    | Verify the account, REST-Enabled SQL access, schema URL, expected identity and agent POST allowlist. |
| Java timeout or certificate error                        | Check proxy/CA settings and run maintenance; do not disable TLS.                                     |
| CLI works but no plugin tools or panel appear            | Native Cloud integration is not installed or verified by this example; continue through the CLI.     |

## Verification scope

This guide and its generalized scripts were checked locally; an actual Codex Cloud setup/resume, native plugin discovery, connected Oracle operation and browser session were not run for this documentation change. The existing [ORDS evidence](ords.md#prerequisites-and-verification) retains its original target and execution scope. Record fresh Cloud evidence after completing the checks above; see [implementation status](implementation-status.md) and [next actions](next-actions.md).
