# SQL through ORDS

Select the `ords` database transport (`apexrest sqlcl configure --mode cli --database-transport ords`) when the Oracle listener, commonly on port 1521, is unreachable but the schema's ORDS endpoint is available. This is a plugin-wide preference for new operations. Existing operations keep their selected transport. Direct Oracle connections remain available when you switch back.

## Configure the connection

Save an APEXREST connection reference with the schema URL, the database username and a password file (`apexrest connection add`, or `apexrest_project` `action:connection_add` with `ordsUrl`, `ordsUsername` and `passwordFile` in the conversation). Use the credentials of an existing Oracle database account allowed to access the schema through ORDS; no separate ORDS account is needed. Saving the reference configures the plugin to use that account. Use separate references for `readConnectionRef` and `deployConnectionRef` when their privileges differ. The URL identifies the REST-enabled schema, for example `https://ords.example.invalid/ords/app_user/`; its schema alias can differ from the database username. Use the schema URL provided by your administrator, rather than an APEX application URL or a `/_/sql` URL. The URL must use `https:`; plain `http:` is accepted only for `localhost`, `127.0.0.1` or `[::1]`, because it would expose the database password.

The equivalent interactive Oracle connection is:

```sql
connect -orest app_user@https://ords.example.invalid/ords/app_user/
```

APEXREST stores the transport in `$APEXREST_HOME/sqlcl.json`, connection metadata in `$APEXREST_HOME/connections.json`, and passwords separately under `$APEXREST_HOME/credentials/`. These are plugin-level local files, normally under `~/.apexrest`, rather than project files. Secret files use owner-only permissions on POSIX; they are not an encrypted password vault. Do not copy them into source control or share them. SQLcl saved connections are used only for the direct transport; ORDS does not require saving a connection in SQLcl.

Passwords never travel through chat or tool arguments: the CLI and the `apexrest_project` tool read a local password file rather than taking the password as a value. Omitting `--password-file` when updating a reference preserves the existing password for the same endpoint and database username; changing either requires credentials for the new identity. The file must be a regular file, not a symbolic link, and on POSIX it must be accessible only by its owner (`chmod 600`); otherwise the command fails with `PASSWORD_FILE_UNSAFE`.

When you switch back to the `direct` transport, the reference's saved SQLcl connection name (`--sqlcl-name`) applies again. Switching transport preserves both the direct mapping and the saved ORDS credentials for the reference; `apexrest_status` `detail:project` lists the references without secrets.

```sh
apexrest connection add dev-read \
  --ords-url https://ords.example.invalid/ords/app_user/ \
  --ords-username app_user --password-file /path/to/local/ords-password.txt
apexrest sqlcl configure --mode cli --database-transport ords --json
apexrest connection test dev-read --json

# Return to the existing direct connection mappings.
apexrest sqlcl configure --mode cli --database-transport direct --json
```

The sample hostname and username are examples, not a configured or verified target. Add the corresponding `dev-deploy` reference before deploying. A missing ORDS configuration fails explicitly; the plugin never retries through the direct listener. The project's database, service, schema, workspace and application identity checks still apply.

## APEXlang import and export

ORDS uses SQLcl's OREST driver for SQL and metadata queries. The execution backend is CLI; selecting official SQLcl MCP together with ORDS is rejected explicitly. APEXREST's own MCP tools remain available. ORDS sessions keep one SQLcl process per call; the pooled SQLcl engine applies to offline compiler work and SQLcl `mcp` mode only.

For metadata queries, the adapter initializes bind values with SQLcl's client-side `VARIABLE ... = ...` syntax. This avoids a separate `EXEC` request for an output bind, which the REST driver can reject with `ORA-17283`.

APEXlang operations use the Oracle compiler and libraries from the selected SQLcl installation. A bundled Java helper handles APEXlang imports in one REST request so installation package state survives across compiled blocks. Exports use `APEX_EXPORT` and a CLOB containing the base64 ZIP to avoid the REST driver's unsupported BLOB output accessor. The ZIP preserves Oracle-generated APEXlang files and `.apex` metadata. SQL backup exports use the same export path. Offline generation and validation retain the existing Oracle SQLcl commands.

ORDS REST SQL commits successful requests and rolls back failed requests. Separate requests do not share database session state, and a failed later request cannot roll back an earlier successful one. Existing deployment approval, identity, backup, drift and unknown-outcome checks remain in place. A timeout or interruption after an import starts requires reconciliation before retrying.

## Prerequisites and verification

Use SQLcl and APEX 26.1 or later for APEXlang, with the required workspace/schema privileges. ORDS must expose REST-Enabled SQL for the selected schema and accept the supplied database authentication. HTTPS is required for every non-loopback endpoint.

The Java helper requires a JDK 21 or newer containing `jdk.compiler`; the managed SQLcl JRE alone does not provide it. The adapter checks the configured Java first, then an already-installed JDK from `JAVA_HOME` or `PATH`. This fallback applies only to the helper and leaves SQLcl's managed JRE settings unchanged. If no suitable JDK is available, `ORDS_JDK_REQUIRED` blocks the operation before credentials or database requests are submitted. The adapter does not download Java or change runtime configuration automatically.

[Connected CLI verification](evidence/ords-connected.json) records an authorized no-op import/export round trip on a private test target. Repeated exports before import were deterministic, `deploy.apply` created a real SQL backup, and the post-import APEXlang export matched all 21 files byte for byte: 14 APEXlang files, two JSON files and five PNG files. This verifies the tested application's composition and the no-op path. Changed imports, additional component variants, SQL restore, interruption/reconciliation, remote rollback and Windows remain separate checks. Application browser verification was explicitly deferred by the user. See [implementation status](implementation-status.md) and [next checks](next-actions.md) for the full evidence scope.

Oracle references: [CONNECT and OREST](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/26.2/sqcug/connect.html), [APEXlang prerequisites](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/26.1/sqcug/prerequisites-apexlang.html), and [REST-Enabled SQL](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.3/orddg/rest-enabled-sql-service.html).
