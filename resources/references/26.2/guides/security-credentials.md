# Security and managed credentials in APEX 26.2

APEX Web Credentials can reference DBMS_CLOUD credentials for OCI Native Authentication, including Autonomous Resource Principal and Database Tools Identity. Treat OCI IAM, database credentials and APEX credential references as distinct configuration. IAM grants access; an APEX reference does not.

Database-backed credential requests run as the parsing schema. Validate its outbound HTTPS/ACL access and the exact credential identity. `Valid for URLs` is not enforced for database-backed credentials, so do not treat it as an endpoint restriction. Use an unqualified database credential name accessible to the parsing schema. Prefer schema scope; instance scope requires broader preparation and has database-version-specific behavior.

The credential recipe contains only a symbolic database credential name. Its compiler result does not establish that DBMS_CLOUD, an IAM policy or the credential exists. Provisioning and authentication changes require separate authorization; they are never implicit application-import prerequisites.

Deep Data Security requires a supporting Oracle AI Database and verified end-user identity propagation. APEX authorization still controls application access while database Data Roles and Data Grants constrain SQL. Test two users with different access through pages, reports and permitted AI tools before claiming enforcement. Do not invent an APEXlang property when inventory lacks it; use documented APEX_APPLICATION_ADMIN/INSTALL.SET_DEEP_SEC interfaces within an authorized migration.

WEBSERVICE_USE_SCHEMA_ACL defaults N. Enabling Y is an administrator-controlled security change and affects legacy SOAP support; inspect existing integrations first. Review OAuth token scopes on upgrade. None of these features requires APEXREST control tables.

Sources: [managed credential details](https://blogs.oracle.com/apex/using-dbms_cloud-credentials-with-resource-principal-and-dbtools-identity), [security release notes](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/new-features.html).
