# Ux Pattern Catalog: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/ux-pattern-catalog/apexlang/ux-pattern-catalog/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

27 included page templates of 28 source pages; 45 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00002-patterns.apx
- pages/p00003-reference.apx
- pages/p00004-component-primitives.apx
- pages/p00100-dashboards.apx
- pages/p00110-dashboard-simple.apx
- pages/p00120-dashboard-advanced.apx
- pages/p00130-dashboard-executive.apx
- pages/p00200-browse-search.apx
- pages/p00210-faceted-search-cards.apx
- pages/p00220-faceted-search-content-row.apx
- pages/p00230-browse-interactive-report.apx
- pages/p00240-full-page-search.apx
- pages/p00250-ai-chat.apx
- pages/p00300-item-details.apx
- pages/p00310-item-detail-summary.apx
- pages/p00320-item-detail-full.apx
- pages/p00330-item-selection.apx
- pages/p00340-tree-selection.apx
- pages/p00400-data-entry.apx
- pages/p00410-data-entry-simple-form.apx
- pages/p00420-data-entry-drawer-form.apx
- pages/p00500-master-detail.apx
- pages/p01100-content-rows.apx
- pages/p01110-cards.apx
- pages/p01120-metrics.apx
- pages/p01130-charts.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/lists/item-details-side-actions.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/page-navigation.apx
- shared-components/lovs/boolean.apx
- shared-components/static-files.apx
- shared-components/static-files/avatars/persona-female01.png
- shared-components/static-files/avatars/persona-female02.png
- shared-components/static-files/avatars/persona-female03.png
- shared-components/static-files/avatars/persona-male01.png
- shared-components/static-files/avatars/persona-male02.png
- shared-components/static-files/avatars/persona-male03.png
- shared-components/static-files/documents/budget-forecast-preview.jpg
- shared-components/static-files/documents/launch-plan-preview.jpg
- shared-components/static-files/documents/project-charter-preview.jpg
- shared-components/static-files/documents/release-readiness-checklist-preview.jpg
- shared-components/static-files/documents/research-findings-preview.jpg
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/js/split-view-selection.js
- shared-components/static-files/js/split-view-selection.min.js
- shared-components/static-files/media-cards/business-travel-hotel.png
- shared-components/static-files/media-cards/city-hostel.png
- shared-components/static-files/media-cards/family-stay-hotel.png
- shared-components/static-files/media-cards/luxury-hotel.png
- shared-components/static-files/standards/shared-guidelines.md
- shared-components/themes/universal-theme/static-files.apx
- shared-components/themes/universal-theme/static-files/24895213365247667045.css
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
