# Sample Reporting: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

42 included page templates of 42 source pages; 77 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00001-interactive-report.apx
- pages/p00002-maintain-project.apx
- pages/p00003-classic-report.apx
- pages/p00004-manage-sample-data.apx
- pages/p00005-filtering.apx
- pages/p00006-drill-down-ir.apx
- pages/p00007-highlighting.apx
- pages/p00008-format-masks.apx
- pages/p00009-use-cases.apx
- pages/p00010-home.apx
- pages/p00011-interactive-report2.apx
- pages/p00012-custom-buttons.apx
- pages/p00013-non-tabular-templates.apx
- pages/p00014-help.apx
- pages/p00015-bind-variables.apx
- pages/p00017-interactive-grid.apx
- pages/p00018-linking-to-interactive-reports.apx
- pages/p00019-case-statement.apx
- pages/p00020-top-n-queries.apx
- pages/p00021-analytic-function-examples.apx
- pages/p00022-inline-views.apx
- pages/p00023-group-by-clause.apx
- pages/p00024-lead-and-lag.apx
- pages/p00025-pivot-syntax.apx
- pages/p00026-connect-by.apx
- pages/p00027-string-functions.apx
- pages/p00028-regular-expressions.apx
- pages/p00029-soundex.apx
- pages/p00030-listagg.apx
- pages/p00031-rank-and-dense-rank.apx
- pages/p00032-row-number.apx
- pages/p00033-ratio-to-report.apx
- pages/p00034-application-theme-style.apx
- pages/p00035-pipelined-functions.apx
- pages/p00036-settings.apx
- pages/p00037-linking-to-interactive-grids.apx
- pages/p00038-report-from-collection.apx
- pages/p00039-sql-examples.apx
- pages/p00040-drill-down-ig.apx
- pages/p00041-cards.apx
- pages/p00042-faceted-search.apx
- pages/p00101-login.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/classic-navigation-bar-entries.apx
- shared-components/component-settings.apx
- shared-components/lists/administration.apx
- shared-components/lists/home-page-list.apx
- shared-components/lists/ig-report-linking-examples.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/oracle-apex-advanced-techniques.apx
- shared-components/lists/report-linking-examples.apx
- shared-components/lists/report-use-cases.apx
- shared-components/lists/sql-analytic-examples.apx
- shared-components/lists/sql-examples.apx
- shared-components/lists/string-functions.apx
- shared-components/lovs/distinct-status-values.apx
- shared-components/lovs/number-of-rows-per-page.apx
- shared-components/lovs/projects.apx
- shared-components/messages.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/plugins/region/sourceDisplay/custom-attributes.apx
- shared-components/plugins/region/sourceDisplay/plugin.apx
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/fs-sprite.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/reports_classic.png
- shared-components/static-files/reports_filter.png
- shared-components/static-files/reports_ir.png
- shared-components/static-files/reports_usecases.jpg
- shared-components/themes/universal-theme/classic-report-templates/sample-reporting-active-filters.apx
- shared-components/themes/universal-theme/classic-report-templates/sample-reports-comment-bubbles.apx
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-table.sql
- supporting-objects/install-scripts/emp-and-dept-tables.sql
- supporting-objects/install-scripts/load-data.sql
- supporting-objects/install-scripts/pipelined-function-package.sql
- supporting-objects/install-scripts/set-plscope-settings.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- supporting-objects/upgrade-scripts.apx
- supporting-objects/upgrade-scripts/create-dept-table.sql
- supporting-objects/upgrade-scripts/create-emp-table.sql
- supporting-objects/upgrade-scripts/drop-old-objects.sql
- supporting-objects/upgrade-scripts/pipelined-function-package.sql
- supporting-objects/upgrade-scripts/refresh-data.sql
- supporting-objects/upgrade-scripts/update-data-script.sql
- workspace-components/app-groups/sample-apps.apx
