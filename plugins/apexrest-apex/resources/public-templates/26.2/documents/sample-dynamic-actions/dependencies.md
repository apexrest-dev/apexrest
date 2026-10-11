# Sample Dynamic Actions: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-dynamic-actions/apexlang/sample-dynamic-actions/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

27 included page templates of 27 source pages; 81 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00001-home.apx
- pages/p00002-disable-enable.apx
- pages/p00003-edit.apx
- pages/p00004-hide-show.apx
- pages/p00005-edit2.apx
- pages/p00006-add-remove-class-error.apx
- pages/p00007-edit3.apx
- pages/p00008-add-remove-class-focus.apx
- pages/p00009-edit4.apx
- pages/p00010-stripe-report.apx
- pages/p00011-execute-pl-sql-code.apx
- pages/p00012-set-values-sql.apx
- pages/p00013-edit5.apx
- pages/p00014-set-values-pl-sql.apx
- pages/p00015-edit6.apx
- pages/p00016-timer.apx
- pages/p00017-refresh.apx
- pages/p00018-delete-and-refresh.apx
- pages/p00019-filter-and-refresh.apx
- pages/p00020-shuttle-refresh.apx
- pages/p00021-debounce-and-throttle.apx
- pages/p00022-edit7.apx
- pages/p00023-settings.apx
- pages/p00024-application-theme-style.apx
- pages/p00025-help.apx
- pages/p00026-administration.apx
- pages/p00101-login.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/classic-navigation-bar-entries.apx
- shared-components/component-settings.apx
- shared-components/lists/administration-options.apx
- shared-components/lists/dynamic-actions.apx
- shared-components/lists/navigation-bar-top.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lovs/department.apx
- shared-components/lovs/job.apx
- shared-components/lovs/manager.apx
- shared-components/lovs/p13-eba-demo-da-emp-deptno.apx
- shared-components/lovs/p13-eba-demo-da-emp-job.apx
- shared-components/lovs/p13-eba-demo-da-emp-mgr.apx
- shared-components/lovs/p15-eba-demo-da-emp-deptno.apx
- shared-components/lovs/p15-eba-demo-da-emp-job.apx
- shared-components/lovs/p15-eba-demo-da-emp-mgr.apx
- shared-components/lovs/p22-eba-demo-da-emp-deptno.apx
- shared-components/lovs/p22-eba-demo-da-emp-job.apx
- shared-components/lovs/p22-eba-demo-da-emp-mgr.apx
- shared-components/lovs/p7-eba-demo-da-emp-deptno.apx
- shared-components/lovs/p7-eba-demo-da-emp-job.apx
- shared-components/lovs/p7-eba-demo-da-emp-mgr.apx
- shared-components/lovs/p9-eba-demo-da-emp-deptno.apx
- shared-components/lovs/p9-eba-demo-da-emp-job.apx
- shared-components/lovs/p9-eba-demo-da-emp-mgr.apx
- shared-components/messages.apx
- shared-components/plugins/dynamic-action/highlight/custom-attributes.apx
- shared-components/plugins/dynamic-action/highlight/plugin.apx
- shared-components/plugins/dynamic-action/highlight/static-files.apx
- shared-components/plugins/dynamic-action/highlight/static-files/highlight.js
- shared-components/plugins/dynamic-action/stripeReport/custom-attributes.apx
- shared-components/plugins/dynamic-action/stripeReport/plugin.apx
- shared-components/plugins/dynamic-action/stripeReport/static-files.apx
- shared-components/plugins/dynamic-action/stripeReport/static-files/stripe_report_2_0.js
- shared-components/plugins/dynamic-action/timer/custom-attributes.apx
- shared-components/plugins/dynamic-action/timer/events.apx
- shared-components/plugins/dynamic-action/timer/plugin.apx
- shared-components/plugins/dynamic-action/timer/static-files.apx
- shared-components/plugins/dynamic-action/timer/static-files/com_oracle_apex_timer.min.js
- shared-components/plugins/item/slider/custom-attributes.apx
- shared-components/plugins/item/slider/events.apx
- shared-components/plugins/item/slider/plugin.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/plugins/region/sourceDisplay/custom-attributes.apx
- shared-components/plugins/region/sourceDisplay/plugin.apx
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-tables.sql
- supporting-objects/install-scripts/insert-data.sql
- supporting-objects/install-scripts/set-plscope-settings.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- supporting-objects/upgrade-scripts.apx
- supporting-objects/upgrade-scripts/refresh-data.sql
- workspace-components/app-groups/sample-apps.apx
