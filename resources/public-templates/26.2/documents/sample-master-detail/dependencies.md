# Sample Master Detail: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-master-detail/apexlang/sample-master-detail/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

33 included page templates of 34 source pages; 67 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00002-side-by-side.apx
- pages/p00004-report-and-marquee-report.apx
- pages/p00005-project-detail.apx
- pages/p00006-milestones.apx
- pages/p00007-milestone-detail.apx
- pages/p00008-tasks.apx
- pages/p00009-task-detail.apx
- pages/p00010-project.apx
- pages/p00011-report-and-marquee-marquee.apx
- pages/p00012-comments.apx
- pages/p00013-add-comment.apx
- pages/p00014-todos.apx
- pages/p00015-to-do-detail.apx
- pages/p00016-milestone.apx
- pages/p00017-stacked-with-sub-detail.apx
- pages/p00018-task.apx
- pages/p00019-comment.apx
- pages/p00022-links.apx
- pages/p00023-link-detail.apx
- pages/p00024-settings.apx
- pages/p00025-preferences.apx
- pages/p00026-manage-sample-data.apx
- pages/p00027-application-theme-style.apx
- pages/p00028-activity-calendar.apx
- pages/p00029-page-views.apx
- pages/p00030-top-users.apx
- pages/p00031-task-details.apx
- pages/p00033-stacked.apx
- pages/p00048-drill-down.apx
- pages/p00049-two-page-master-detail-detail.apx
- pages/p00101-login-desktop.apx
- pages/p00102-feedback.apx
- shared-components/app-items.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/component-settings.apx
- shared-components/lists/admin-reports.apx
- shared-components/lists/administration.apx
- shared-components/lists/desktop-navigation-bar.apx
- shared-components/lists/desktop-navigation-menu.apx
- shared-components/lists/master-detail-pages.apx
- shared-components/lists/project-actions.apx
- shared-components/lists/task-actions.apx
- shared-components/lovs/link-types.apx
- shared-components/lovs/milestones.apx
- shared-components/lovs/p18-milestones.apx
- shared-components/lovs/projects.apx
- shared-components/lovs/status.apx
- shared-components/lovs/tasks-with-dates.apx
- shared-components/lovs/tasks.apx
- shared-components/lovs/team-members.apx
- shared-components/lovs/timeframe.apx
- shared-components/lovs/username.apx
- shared-components/lovs/yes-no.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-data-package.sql
- supporting-objects/install-scripts/create-tables.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/app-groups/sample-apps.apx
