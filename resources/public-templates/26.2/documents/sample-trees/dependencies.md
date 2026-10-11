# Sample Trees: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-trees/apexlang/sample-trees/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

11 included page templates of 11 source pages; 39 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00001-home.apx
- pages/p00002-manage-sample-data.apx
- pages/p00003-project-tracking.apx
- pages/p00004-help.apx
- pages/p00005-settings.apx
- pages/p00006-project-dashboard.apx
- pages/p00007-create-edit-project.apx
- pages/p00008-application-theme-style.apx
- pages/p00009-create-edit-tasks.apx
- pages/p00010-modify-subtask-information.apx
- pages/p00101-login.apx
- shared-components/app-items.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/classic-navigation-bar-entries.apx
- shared-components/component-settings.apx
- shared-components/lists/administration.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/task-tracking-tabs.apx
- shared-components/lists/trees.apx
- shared-components/lovs/priority.apx
- shared-components/lovs/projects.apx
- shared-components/lovs/status.apx
- shared-components/lovs/tasks.apx
- shared-components/messages.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/plugins/region/sourceDisplay/custom-attributes.apx
- shared-components/plugins/region/sourceDisplay/plugin.apx
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/trees_project_doc.jpg
- shared-components/static-files/trees_project_tracking.jpg
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-funtion.sql
- supporting-objects/install-scripts/create-tables.sql
- supporting-objects/install-scripts/create-triggers.sql
- supporting-objects/install-scripts/create-view.sql
- supporting-objects/install-scripts/sample-data.sql
- supporting-objects/install-scripts/set-plscope-settings.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/app-groups/sample-apps.apx
