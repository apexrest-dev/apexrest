# Run APEXREST in Codex Cloud

This guide sets up APEXREST's bundled **CLI inside the Cloud container**, using ORDS over HTTPS for database access. It is for teams that want a Codex Cloud agent to run `apexrest` commands against a development/test database.

The example below adapts a project-specific Cloud bootstrap into reusable scripts. It does not register the plugin or expose its MCP tools and skills to the Cloud agent. Those integrations require their own host verification; see [host integration](codex-integration.md).

## Before you start

You need:

- an application repository connected to Codex Cloud;
- a local APEXREST checkout, to copy the example scripts from;
- a development/test ORDS schema URL over HTTPS, and a database account that already has authorized access to REST-Enabled SQL on that schema;
- a Cloud environment with Node.js 24, a Java 21 JDK, Git and Bash;
- a decision on credential retention: this example keeps a credential file in the container (see [step 2](#2-configure-the-cloud-environment)).

The steps:

1. [Prepare your application repository](#1-prepare-your-application-repository)
2. [Configure the Cloud environment](#2-configure-the-cloud-environment)
3. [Set setup and maintenance commands](#3-set-setup-and-maintenance-commands)
4. [Configure network access](#4-configure-network-access)
5. [Verify from a Cloud task](#5-verify-from-a-cloud-task)
6. [Give the agent project instructions](#6-give-the-agent-project-instructions)

The bootstrap and connected workflow require verification in the actual Cloud environment. See [Verification scope](#verification-scope).

## 1. Prepare your application repository

1. Copy the files in [the Cloud example directory](examples/codex-cloud/) into `scripts/codex-cloud/` in the application repository connected to Codex Cloud. Keep all files together. From your application repository, with a local APEXREST checkout available:

   ```sh
   mkdir -p scripts/codex-cloud
   cp /path/to/apexrest/docs/examples/codex-cloud/* scripts/codex-cloud/
   ```

2. Add these entries to the application's `.gitignore` before running setup:

   ```gitignore
   .codex/cloud/
   .apexrest/
   ```

3. Commit the example scripts and ignore rules to the repository's default branch used for Cloud cache preparation, and ensure they are also present on the task branch. Cloud checks out the task branch when resuming the cache; see [container caching](https://learn.chatgpt.com/docs/environments/cloud-environment).

Generated tools, credentials, logs, plans and backups must remain private. The scripts are documentation examples, not files automatically installed by the plugin or its npm package.

### The pinned build

- The [version file](examples/codex-cloud/version.sh) pins a reviewed immutable checkout with manifest version `2.0.0`.
- Setup verifies the commit and version, then uses `plugins/apexrest-apex/runtime/apexrest.mjs`; it needs neither an npm release nor a TypeScript build.
- Review and change both pins together when adopting another build.
- The bootstrap and connected workflow require verification in the actual Cloud environment.

## 2. Configure the Cloud environment

1. Select your application repository in Codex Cloud environment settings.
2. Select **Node.js 24** and **Java 21** under package versions. Java must be a **JDK with `jdk.compiler`**, not just a JRE. Git and Bash must also be available.
3. Set the environment variables in the table below. Replace every target placeholder with values supplied for your development/test environment.
4. Add **`APEXREST_ORDS_PASSWORD` as a Secret**, not a normal environment variable or repository file.

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

The account must already have authorized access to REST-Enabled SQL on that ORDS schema. Use the schema URL, not an APEX application URL or the `/_/sql` endpoint; see [ORDS configuration](ords.md).

### Credential retention

Read this before you set `APEXREST_PERSIST_CREDENTIALS=1`.

- Cloud secrets are available during setup, then removed from the agent environment.
- This example deliberately retains a credential file for later CLI commands.
- Cloud container caching can retain that file, and Business/Enterprise caches can be shared by environment users. Use an environment whose users are authorized for that database account. See [OpenAI's Cloud environment documentation](https://learn.chatgpt.com/docs/environments/cloud-environment).

With `APEXREST_PERSIST_CREDENTIALS=1`, setup:

1. passes the secret through a temporary owner-only file to `connection add --password-file`;
2. removes the temporary file;
3. keeps the APEXREST credential under `.codex/cloud/tools/credentials/` with POSIX mode `0600`.

This is **not an encrypted vault**: the agent and processes running as the same user can read it. If this retention is unsuitable, do not enable the flag or use this connected example. Never print the secret, enable shell tracing, or include `.codex/cloud/` in commits or shared artifacts.

## 3. Set setup and maintenance commands

**Setup script:**

```sh
bash scripts/codex-cloud/setup.sh
```

**Maintenance script:**

```sh
bash scripts/codex-cloud/setup.sh --maintenance
```

### What setup does

Setup:

- checks the pinned checkout;
- previews and installs managed dependencies;
- prepares a private JDK;
- selects `sqlcl configure --mode cli --database-transport ords`;
- saves the connection;
- runs `doctor` plus a read-only database identity check.

It creates no application or business data and grants no deployment permission.

### What maintenance does

Maintenance reuses the installed build and credentials, refreshes Java proxy/CA settings and repeats the connection check. It does not reinstall dependencies.

| Situation                                        | Action                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Missing build, changed pin or missing credential | Rerun setup with the secret available.                                                |
| Credential rotation                              | Update the Secret and rerun setup; retaining an old local credential is not rotation. |
| Incompatible setup changes                       | Use **Reset cache**.                                                                  |

### The launcher and cached containers

- The launcher restores `APEXREST_HOME`, `APEXREST_JAVA_HOME` and the selected Node executable on every invocation. A setup-only `export` would not persist into the agent phase.
- Cloud may resume a cached container and run maintenance; after incompatible setup changes, use **Reset cache**. See [environment lifecycle](https://learn.chatgpt.com/docs/environments/cloud-environment).

## 4. Configure network access

Enable agent internet access for the exact ORDS hostname and allow **POST**, which REST-Enabled SQL needs even for read-only queries. Setup download access and agent-phase access are separate settings. See [OpenAI's agent internet access documentation](https://learn.chatgpt.com/docs/cloud/internet-access).

Setup also needs access to the canonical GitHub repository and the dependency download hosts shown by the installer preview.

### Why HTTPS and ORDS

- The example uses HTTPS because a Cloud HTTP proxy does not establish reachability to the Oracle listener on port 1521.
- Plain `http:` ORDS URLs are accepted only for loopback.
- The example makes no listener-connectivity assumption.

### Proxy and certificates

The [network helper](examples/codex-cloud/network.sh) enables `NODE_USE_ENV_PROXY=1`.

- Vendor downloads then honor `HTTPS_PROXY` and `NO_PROXY`.
- If a proxy is configured but the running Node cannot apply it, setup stops with `PROXY_UNSUPPORTED` rather than bypassing the proxy.

The [Java helper](examples/codex-cloud/setup-java.mjs):

- copies the environment JDK into `.codex/cloud/java`;
- writes proxy settings to its private `conf/net.properties`;
- imports the environment CA bundle from `NODE_EXTRA_CA_CERTS` into its private `lib/security/jssecacerts`;
- preserves the default trust roots and leaves the host JDK unchanged.

APEXREST strips Java option environment variables for Oracle subprocesses, so `JAVA_TOOL_OPTIONS` alone is insufficient here.

Proxy rules for the helper:

- It accepts an HTTP proxy without URL credentials, reading `https_proxy`, `HTTPS_PROXY`, `http_proxy`, then `HTTP_PROXY`.
- Host/domain entries in `NO_PROXY` are mapped to Java; CIDR entries remain proxied.
- Unsupported proxy settings fail explicitly.
- Keep TLS certificate verification enabled; refresh the private truststore when the environment CA changes.

## 5. Verify from a Cloud task

Start a task after successful setup and run these commands from the application repository. Replace `cloud-dev` if you chose another reference:

```sh
bash scripts/codex-cloud/apexrest doctor --json
bash scripts/codex-cloud/apexrest sqlcl status --json
bash scripts/codex-cloud/apexrest connection list --json
bash scripts/codex-cloud/apexrest connection test --name cloud-dev --json
bash scripts/codex-cloud/apexrest --help
```

Check the actual JSON and exit codes:

- the selected mode must be `cli`;
- network transport must be `ords`;
- the connection identity must match your intended database/schema.

How to read the results:

- A successful `doctor` command is insufficient: it reports probes separately and does not test the database.
- Its `nativeHost: requires-host-verification` and `database: not-configured` fields do not override a separately successful connection test.
- A missing local Codex executable also does not by itself prevent direct CLI/ORDS operations.
- The connection reference belongs to APEXREST, not SQLcl's saved connection store; do not replace the command with `sql -name cloud-dev` or `connection test --saved`.
- Save only sanitized evidence; identity output can contain private target names.

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

### Before application work

- Configure the target in `apexrest.json`, including workspace, schema, application ID, database identity and the correct read/deploy references.
- Follow the [safety rules](deployment-safety.md) and retain validation, backup, exact-plan authorization, drift and unknown-outcome protections from [configuration](configuration.md) and [deployment safety](deployment-safety.md).
- Installation and a successful connection test do not authorize an import.

### Deployment history and backups

- The example keeps local deployment history under `APEXREST_HOME`.
- Cloud caches are not durable backup storage or cross-container coordination: preserve private backups/history outside an expiring container and serialize runners before authorizing deployments.
- Do not reset away an unresolved operation's records or silently start fresh history against the same schema.

### Browser checks and native plugin features

- Browser dependencies are skipped. Browser checks require separately configured tools, authentication and actual observations.
- The CLI bootstrap does not establish that `$apexrest-work` or automatic skill/MCP discovery work in Cloud.
- The CLI equivalents of the work cycle are `apexrest apex validate`, `apexrest ship --mode plan|apply --user-request TEXT` and `apexrest job status`.
- Use the launcher for the documented flow and report unavailable checks explicitly.

## Troubleshooting

| Symptom                                                  | Action                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Setup exits with “Skipping Cloud setup”                  | Set `CODEX_CLOUD=1` in environment settings.                                                         |
| Unsupported Node or no JDK compiler                      | Select Node 24 and JDK 21, then rerun setup.                                                         |
| Pinned checkout/runtime/credentials missing after resume | Rerun setup with the Secret; maintenance cannot reconstruct an uncached environment.                 |
| HTTP 401/403 or failed identity check                    | Verify the account, REST-Enabled SQL access, schema URL, expected identity and agent POST allowlist. |
| Java timeout or certificate error                        | Check proxy/CA settings and run maintenance; do not disable TLS.                                     |
| CLI works but no plugin tools or skills appear           | Native Cloud integration is not installed or verified by this example; continue through the CLI.     |

## Verification scope

Local script syntax and package checks do not establish an actual Cloud setup/resume, connected Oracle operation, native plugin discovery or browser session. Complete the checks above on the intended environment and record the resulting scope; see [implementation status](implementation-status.md) and [next actions](next-actions.md).

## Related

- [SQL through ORDS](ords.md): the schema URL and REST-Enabled SQL.
- [Configuration](configuration.md): environments, connections and policy.
- [Deployment safety](deployment-safety.md): the plan, grant, import and recovery model.
- [Host integration](codex-integration.md): what native plugin registration involves.
