# APEX 26.2 upgrade audit

Updating Oracle skills does not upgrade an application. Keep 26.1 source and compiler metadata intact until an authorized target upgrade; do not edit `.apex/apexlang.json` to change versions.

For source-controlled applications, refresh every application's source after a major APEX upgrade, even when its features are unchanged:

1. Isolate the structural refresh on an upgrade branch. Back up uncommitted/project-owned files and the server application; resolve drift before import.
2. Confirm the upgraded DEV/QA/TEST target and the tool used for import: SQLcl for CLI, ORDS for App Builder, or SQL Developer for VS Code. Do not install or upgrade tools implicitly.
3. Use the authorized APEXREST full-import flow to establish the reviewed source on that target. Importing the same application ID overwrites server changes; retain identity, backup, drift and recovery checks.
4. Re-export APEXlang into disposable staging. SQLcl `apex export -exptype apexlang -applicationid <verified-id> -force` removes the app alias directory in the current directory before export; run it inside the staging directory, never in the working tree.
5. Review added, changed and removed files, reconcile project-owned files, and adopt the new baseline through working-copy sync. Keep structural changes in a separate commit. Preserve generated `translations.sql`.

Use the refreshed export for 26.2 file-level work. A successful import, source refresh and requested browser verification remain separate outcomes.

If compiler/profile checks or baseline refresh refuse the upgrade, report the blocker. Do not rewrite metadata or delete checkpoints to bypass it.

Audit these compatibility changes:

- Static IDs containing tabs fail validation when edited.
- App Builder exports always include existing supporting objects; use SQLcl/APEX_EXPORT when exclusion is required.
- Manual OAuth token reuse now requires matching scopes.
- Application-based translations can be exported as APEXlang and carry generated-artifacts/translations.sql.
- Export Repository, SQL Workshop Query Builder and SQL Workshop RESTful Services authoring are removed. Existing ORDS modules remain, but legacy APEX_REST_RESOURCE_* views no longer expose REST Workshop data. Fresh installations do not create APEX_LISTENER.
- Data Generator, Oracle AS SSO and APEX Advisor are deprecated. Review replacements without changing authentication automatically.
- APEX_AI.t_chat_message.tool_calls is deprecated: use normalized tool-call messages with CHAT_ROLE=C_ROLE_TOOL_CALL and TOOL_CALL. t_chat_response.message is deprecated: consume MESSAGES.

SQLcl 26.3 CodeScan adds APEXlang rules. Capture its installed command contract, findings and exit behavior separately from compiler results. Preserve reviewed suppressions; do not claim scanner success means Oracle runtime correctness.

Sources: [source upgrade](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/upgrading-apexlang-source-with-new-apex-release.html), [changes](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/changed-behavior.html), [deprecations](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/deprecated-features.html), [removals](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/desupported-features.html), [SQLcl changelog](https://www.oracle.com/tools/sqlcl/sqlcl-changelog.html).
