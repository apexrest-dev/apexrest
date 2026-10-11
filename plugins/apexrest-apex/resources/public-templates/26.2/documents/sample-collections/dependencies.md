# Sample Collections: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-collections/apexlang/sample-collections/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

14 included page templates of 14 source pages; 38 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00001-basic-collections.apx
- pages/p00002-create-collection.apx
- pages/p00003-modify-collection.apx
- pages/p00004-modify-collection-member.apx
- pages/p00005-application-theme-style.apx
- pages/p00006-emp.apx
- pages/p00007-editemp.apx
- pages/p00008-help.apx
- pages/p00012-sample-collections-api-examples.apx
- pages/p00035-settings.apx
- pages/p00036-remove-collections.apx
- pages/p00039-reset-data.apx
- pages/p00100-home.apx
- pages/p00101-login.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/breadcrumbs/breadcrumbs.apx
- shared-components/classic-navigation-bar-entries.apx
- shared-components/component-settings.apx
- shared-components/lists/admin-options.apx
- shared-components/lists/collection-examples.apx
- shared-components/lists/navigation-bar-top.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lovs/deptno-lov.apx
- shared-components/lovs/job-lov.apx
- shared-components/lovs/status-lov.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/plugins/region/sourceDisplay/custom-attributes.apx
- shared-components/plugins/region/sourceDisplay/plugin.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-eba-demo-cs-emp-table.sql
- supporting-objects/install-scripts/sample-data.sql
- supporting-objects/install-scripts/set-plscope-settings.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- supporting-objects/upgrade-scripts.apx
- supporting-objects/upgrade-scripts/create-eba-demo-cs-emp-table.sql
- workspace-components/app-groups/sample-apps.apx
