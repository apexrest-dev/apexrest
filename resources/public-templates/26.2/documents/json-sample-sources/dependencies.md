# Json Sample Sources: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

31 included page templates of 33 source pages; 77 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00100-json-sources.apx
- pages/p00101-table-with-json-column.apx
- pages/p00102-json-collection-table.apx
- pages/p00103-post-processing.apx
- pages/p00105-edit-ticket.apx
- pages/p00200-duality-view.apx
- pages/p00201-create-edit-store.apx
- pages/p00300-sql-json-functions.apx
- pages/p00301-json-table.apx
- pages/p00302-json-transform.apx
- pages/p00303-edit-customer-s-address.apx
- pages/p00400-data-presentation.apx
- pages/p00401-interactive-grid.apx
- pages/p00402-charts-from-json.apx
- pages/p00403-faceted-search.apx
- pages/p00404-map.apx
- pages/p00405-master-detail.apx
- pages/p00406-customers.apx
- pages/p00407-create-edit-order.apx
- pages/p00408-search-page.apx
- pages/p00411-ticket-details.apx
- pages/p00500-use-cases.apx
- pages/p00502-data-loading.apx
- pages/p00503-json-and-workflow.apx
- pages/p00504-workflow-console.apx
- pages/p00505-workflow-details.apx
- pages/p00600-administration.apx
- pages/p00601-theme-style-selection.apx
- pages/p00602-reset-data.apx
- pages/p00700-about.apx
- pages/p09999-login.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/duality-view-sources/eba-demo-json-customer-orders-dv.apx
- shared-components/duality-view-sources/eba-demo-json-store-dv.apx
- shared-components/email-templates/ORDER-CONFIRMATION.apx
- shared-components/json-collection-sources/eba-demo-json-customers.apx
- shared-components/json-collection-sources/eba-demo-json-orders.apx
- shared-components/json-collection-sources/eba-demo-json-products.apx
- shared-components/json-collection-sources/eba-demo-json-support-ticket.apx
- shared-components/lists/administration.apx
- shared-components/lists/data-presentation.apx
- shared-components/lists/home.apx
- shared-components/lists/json-sources.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/sql-json-functions.apx
- shared-components/lists/use-cases.apx
- shared-components/lovs/countries.apx
- shared-components/lovs/customers.apx
- shared-components/lovs/desktop-theme-styles.apx
- shared-components/lovs/order-status.apx
- shared-components/lovs/payment-method.apx
- shared-components/lovs/priority.apx
- shared-components/lovs/products.apx
- shared-components/lovs/status.apx
- shared-components/lovs/stores.apx
- shared-components/lovs/user-theme-preference.apx
- shared-components/lovs/workflow-console-lov-initiated.apx
- shared-components/lovs/workflow-console-lov-workflow-state.apx
- shared-components/messages.apx
- shared-components/search-configs/product-search.apx
- shared-components/static-files.apx
- shared-components/static-files/additional-json-data.txt
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/product_images.zip
- shared-components/themes/universal-theme/theme.apx
- shared-components/workflows/ORDER-PLACEMENT-WORKFLOW-1.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/-load-data.sql
- supporting-objects/install-scripts/create-sequences.sql
- supporting-objects/install-scripts/tables-definition.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- supporting-objects/validations.apx
