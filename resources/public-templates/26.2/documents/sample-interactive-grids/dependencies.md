# Sample Interactive Grids: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-interactive-grids/apexlang/sample-interactive-grids/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

49 included page templates of 49 source pages; 81 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- pages/p00001-home.apx
- pages/p00002-progressive-scroll.apx
- pages/p00003-basic-reporting.apx
- pages/p00004-column-groups.apx
- pages/p00005-add-toolbar-button.apx
- pages/p00006-row-header.apx
- pages/p00007-sequence-row-header.apx
- pages/p00008-multiple-selection.apx
- pages/p00009-saved-reports.apx
- pages/p00010-single-row-view.apx
- pages/p00011-traditional-paging.apx
- pages/p00012-traditional-paging-total-rows.apx
- pages/p00013-icon-and-detail-views.apx
- pages/p00014-chart-view.apx
- pages/p00015-linking-to-interactive-grids.apx
- pages/p00017-traditional-paging-custom.apx
- pages/p00018-traditional-paging-select-list.apx
- pages/p00019-scroll-paging.apx
- pages/p00020-load-more-paging.apx
- pages/p00021-full-page-with-maximize.apx
- pages/p00022-scroll-with-maximize.apx
- pages/p00023-help.apx
- pages/p00024-administration.apx
- pages/p00025-manage-sample-data.apx
- pages/p00026-application-theme-style.apx
- pages/p00030-basic-editing.apx
- pages/p00031-validation.apx
- pages/p00032-delete-only.apx
- pages/p00033-protected-rows.apx
- pages/p00034-form-with-grid.apx
- pages/p00035-master-detail.apx
- pages/p00036-other-column-types.apx
- pages/p00037-read-only-reports.apx
- pages/p00038-pagination.apx
- pages/p00039-editing.apx
- pages/p00040-advanced.apx
- pages/p00050-feature-customization.apx
- pages/p00051-client-validation.apx
- pages/p00052-tooltips.apx
- pages/p00053-advanced-delete.apx
- pages/p00054-editing-dialog.apx
- pages/p00055-editing-in-a-dialog.apx
- pages/p00056-item-type-plug-ins.apx
- pages/p00057-custom-server-processing.apx
- pages/p00058-dynamic-actions.apx
- pages/p00060-people-paging.apx
- pages/p00070-oracle-text.apx
- pages/p00101-login.apx
- pages/p00400-employee.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/component-settings.apx
- shared-components/legacy-data-load-definitions/people.apx
- shared-components/lists/administration.apx
- shared-components/lists/advanced-list.apx
- shared-components/lists/desktop-navigation-menu.apx
- shared-components/lists/editing-list.apx
- shared-components/lists/home-page-list.apx
- shared-components/lists/ig-report-linking-examples.apx
- shared-components/lists/navigation-bar-top.apx
- shared-components/lists/pagination-list.apx
- shared-components/lists/reporting-list.apx
- shared-components/lovs/emp-jobs.apx
- shared-components/lovs/people-categories.apx
- shared-components/lovs/people-gender.apx
- shared-components/messages.apx
- shared-components/plugins/item/modernStarRating/custom-attributes.apx
- shared-components/plugins/item/modernStarRating/plugin.apx
- shared-components/plugins/region/sampleAppsFooter/plugin.apx
- shared-components/plugins/region/sourceDisplay/custom-attributes.apx
- shared-components/plugins/region/sourceDisplay/plugin.apx
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/eba_demo_ig_people.json
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/sample-interactive-grid.css
- shared-components/static-files/sample-interactive-grid.min.css
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/data.sql
- supporting-objects/install-scripts/install.sql
- supporting-objects/install-scripts/oracle-text-helper-package-compiles-without-oracle-text-.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/app-groups/sample-apps.apx
