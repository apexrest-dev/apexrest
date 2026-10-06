# APEXlang 26.2 selected-file import

Use selected-file import for an existing development/test application. Both target APEX and exported source must be 26.2; SQLcl and ORDS must be at least 26.3.0. Retain the 26.1 full-application workflow for 26.1 projects. Always compile the complete reconciled source before planning selected changes.

```text
apex import -input employee-portal -files employee-portal/pages/p00003-employees.apx employee-portal/shared-components/lovs/dept-dname.apx
```

SQLcl resolves dependencies among the listed files, but cannot add a missing dependency for you. File paths are relative to SQLcl's working directory. An initial application creation requires a full import. File imports exclude themes, templates, plug-ins and workspace components. Production uses the reviewed full-application process.

In APEXREST, import is an apply operation. A reviewed plan binds the exact selected paths and bytes, complete validation source, deployment JSON, target identity and drift baseline. Keep backup, coordination, exact-plan authorization and unknown-outcome reconciliation. A changed plan requires a new review. Never silently replace selected-file import with a full application import.

Deployment JSON is selected with SQLcl `-deployment`; its default is `deployments/default.json`. Effective precedence is explicit SQLcl/compiler overrides, supported APEX_APPLICATION_INSTALL settings, selected deployment JSON, then source/defaults. Review app ID, workspace, parsing schema and subscription mappings before apply. Preserve the application's checksum salt because replacing it invalidates existing bookmarked URL checksums. JSON properties do not authorize a different target.

Evidence: [file import](https://blogs.oracle.com/apex/introducing-file-level-import-with-apexlang-in-oracle-apex), [deployment metadata](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/understanding-apexlang-deployment-files.html). This guide describes supported Oracle behavior; it is not native import evidence.
