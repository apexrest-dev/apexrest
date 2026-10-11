# Sample Document Generator: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-document-generator/apexlang/sample-docgen/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

1 included page templates of 4 source pages; 27 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p09999-login.apx
- pages/p10010-help.apx
- shared-components/app-computations.apx
- shared-components/app-items.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/lists/configure-docgen.apx
- shared-components/lists/examples.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/plugins/process/ociDocumentGeneratorPrintDocument/attribute-groups.apx
- shared-components/plugins/process/ociDocumentGeneratorPrintDocument/custom-attributes.apx
- shared-components/plugins/process/ociDocumentGeneratorPrintDocument/plugin.apx
- shared-components/static-files.apx
- shared-components/static-files/document-screenshots/customer-order.png
- shared-components/static-files/document-screenshots/emp_per_dept.png
- shared-components/static-files/document-screenshots/employees.png
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/templates/customer-order.docx
- shared-components/static-files/templates/emp_per_dept.docx
- shared-components/static-files/templates/employees.docx
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/emp-dept.sql
- supporting-objects/install-scripts/order-items.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/app-groups/sample-apps.apx
