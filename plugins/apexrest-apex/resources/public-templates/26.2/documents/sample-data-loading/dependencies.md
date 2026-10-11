# Sample Data Loading: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-data-loading/apexlang/sample-data-loading/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

18 included page templates of 18 source pages; 59 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00001-sample-data-loading.apx
- pages/p00006-help.apx
- pages/p00007-application-theme-style.apx
- pages/p00008-settings.apx
- pages/p00009-administration.apx
- pages/p00010-data-loading.apx
- pages/p00011-csv-load.apx
- pages/p00015-transform-and-lookup.apx
- pages/p00016-multi-filetypes-load.apx
- pages/p00017-background-load.apx
- pages/p00018-load-status.apx
- pages/p00021-data-load-source.apx
- pages/p00023-data-validation.apx
- pages/p00024-data-load-results.apx
- pages/p00030-manual-data-loading.apx
- pages/p00031-pl-sql-parser.apx
- pages/p00032-load-data-using-pl-sql-api.apx
- pages/p00101-login.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/automations/load-employee-data.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/classic-navigation-bar-entries.apx
- shared-components/component-settings.apx
- shared-components/data-load-definitions/CSV-Load.apx
- shared-components/data-load-definitions/JSON-Load.apx
- shared-components/data-load-definitions/Sales-Data-Load.apx
- shared-components/data-load-definitions/Transform-and-Lookup.apx
- shared-components/data-load-definitions/XLSX-Load.apx
- shared-components/data-load-definitions/XML-Load.apx
- shared-components/legacy-data-load-definitions/load-employees.apx
- shared-components/lists/administration-options.apx
- shared-components/lists/data-load-process-train-load-employees.apx
- shared-components/lists/data-load-wizard-progress-load-employees.apx
- shared-components/lists/data-loading.apx
- shared-components/lists/home.apx
- shared-components/lists/manual-data-loading.apx
- shared-components/lists/navigation-bar-top.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lovs/data-load-charset.apx
- shared-components/lovs/data-load-option.apx
- shared-components/lovs/date-format-opt.apx
- shared-components/lovs/date-format-option.apx
- shared-components/lovs/departments.apx
- shared-components/lovs/employees.apx
- shared-components/lovs/first-row-option.apx
- shared-components/messages.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/plugins/region/sourceDisplay/custom-attributes.apx
- shared-components/plugins/region/sourceDisplay/plugin.apx
- shared-components/static-files.apx
- shared-components/static-files/Employees.csv
- shared-components/static-files/Employees.json
- shared-components/static-files/Employees.xlsx
- shared-components/static-files/Employees.xml
- shared-components/static-files/Employees_TransformNLookup.csv
- shared-components/static-files/SalesData.zip
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-tables.sql
- supporting-objects/install-scripts/eba-demo-data-load.sql
- supporting-objects/install-scripts/seed-sample-data.sql
- supporting-objects/install-scripts/set-plscope-settings.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/app-groups/sample-apps.apx
