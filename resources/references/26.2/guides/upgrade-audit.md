# APEX 26.2 upgrade audit

Keep 26.1 source and compiler metadata intact until an authorized target upgrade. Import and re-export in a development environment to obtain the 26.2 structure. Capture structural differences separately from feature changes. Export `-force` deletes the alias directory: use a backed-up, disposable staging path and reconcile before replacing tracked source. Preserve generated translations.sql; do not hand-edit generated artifacts.

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
