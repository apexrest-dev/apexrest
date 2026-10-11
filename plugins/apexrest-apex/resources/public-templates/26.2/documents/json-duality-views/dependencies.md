# Json Duality Views: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-duality-views/apexlang/json-duality-views/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

10 included page templates of 12 source pages; 29 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00002-create-purchase-order.apx
- pages/p00006-purchase-order-p6-po-id-details.apx
- pages/p00008-line-item.apx
- pages/p00009-add-line-item.apx
- pages/p00010-purchase-orders-stacked.apx
- pages/p00020-purchase-orders-inbox.apx
- pages/p00021-edit-purchase-order.apx
- pages/p00022-about-duality-view.apx
- pages/p00023-purchase-order-query.apx
- pages/p09999-login.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/component-settings.apx
- shared-components/duality-view-sources/purchase-orders.apx
- shared-components/lists/home.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lovs/boolean.apx
- shared-components/lovs/customers.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-objects.sql
- supporting-objects/install-scripts/insert-data.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
