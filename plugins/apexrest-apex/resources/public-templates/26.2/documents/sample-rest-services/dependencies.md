# Sample Rest Services: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

35 included page templates of 37 source pages; 91 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00002-connection-setup.apx
- pages/p00100-rest-integrations1.apx
- pages/p00101-simple-http.apx
- pages/p00102-ords1.apx
- pages/p00103-odata1.apx
- pages/p00104-employee.apx
- pages/p00200-combine-with-relational-data.apx
- pages/p00201-post-processing-sql.apx
- pages/p00202-derived-columns1.apx
- pages/p00300-data-display-options.apx
- pages/p00301-simple-report1.apx
- pages/p00302-report-with-pagination1.apx
- pages/p00303-report-with-query1.apx
- pages/p00304-cards-layout1.apx
- pages/p00305-oracle-jet-charts1.apx
- pages/p00306-faceted-search1.apx
- pages/p00307-map1.apx
- pages/p00308-calendar1.apx
- pages/p00400-advanced-features1.apx
- pages/p00401-rest-synchronization.apx
- pages/p00402-invoke-api-process1.apx
- pages/p00403-raise-employee-salary.apx
- pages/p00404-rest-data-pl-sql2.apx
- pages/p00405-nested-json-dynamic-actions.apx
- pages/p00406-rest-data-source-plugins1.apx
- pages/p00407-rest-and-workflow.apx
- pages/p00408-workflow-console.apx
- pages/p00409-workflow-details.apx
- pages/p00500-administration1.apx
- pages/p00501-application-appearance1.apx
- pages/p00502-reset-data1.apx
- pages/p00503-web-credentials-settings1.apx
- pages/p00504-network-setup1.apx
- pages/p00600-help1.apx
- pages/p09999-login.apx
- shared-components/app-items.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/email-templates/STORE-ORDER-SUMMARY.apx
- shared-components/lists/advanced-features.apx
- shared-components/lists/combine-with-relational-data.apx
- shared-components/lists/data-display-options.apx
- shared-components/lists/home.apx
- shared-components/lists/interactivity.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/rest-data-sources.apx
- shared-components/lists/user-interface.apx
- shared-components/lovs/desktop-theme-styles.apx
- shared-components/lovs/employee-popup-lov.apx
- shared-components/lovs/user-theme-preference.apx
- shared-components/lovs/workflow-console-lov-initiated.apx
- shared-components/lovs/workflow-console-lov-workflow-state.apx
- shared-components/messages.apx
- shared-components/plugins/web-source/fixedPageSizePlugInForApiThemoviedbOrg/plugin.apx
- shared-components/rest-data-sources/Employee-ords-rest-source.apx
- shared-components/rest-data-sources/eba-movie-plug.apx
- shared-components/rest-data-sources/eba-rest-department.apx
- shared-components/rest-data-sources/eba-rest-employee-data.apx
- shared-components/rest-data-sources/eba-rest-employee-derived.apx
- shared-components/rest-data-sources/eba-rest-employee-invoke.apx
- shared-components/rest-data-sources/eba-rest-employee-invokeapi.apx
- shared-components/rest-data-sources/eba-rest-employees.apx
- shared-components/rest-data-sources/eba-rest-movie-synchronization.apx
- shared-components/rest-data-sources/eba-rest-movies.apx
- shared-components/rest-data-sources/eba-rest-orders.apx
- shared-components/rest-data-sources/eba-rest-pagination.apx
- shared-components/rest-data-sources/eba-rest-product-workflows.apx
- shared-components/rest-data-sources/eba-rest-purchase-order.apx
- shared-components/rest-data-sources/eba-rest-stores.apx
- shared-components/rest-data-sources/eba-rest-tasks.apx
- shared-components/rest-data-sources/post.apx
- shared-components/rest-data-sources/prod-odata.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/theme.apx
- shared-components/workflows/CREATE-ORDER.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/data-installation.sql
- supporting-objects/install-scripts/etlprocess.sql
- supporting-objects/install-scripts/ords-definition.sql
- supporting-objects/install-scripts/sequences-objects-definition.sql
- supporting-objects/install-scripts/table-definition.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/credentials/moviedb-api-key.apx
- workspace-components/rest-data-source-servers/OData-Flexible-Remote-Server.apx
- workspace-components/rest-data-source-servers/api-themoviedb-org-3-2-.apx
- workspace-components/rest-data-source-servers/api-themoviedb-org-3-search.apx
- workspace-components/rest-data-source-servers/flexible-remote-servers.apx
