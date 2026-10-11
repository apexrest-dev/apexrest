# Sample Application Search: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-application-search/apexlang/sample-application-search/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

29 included page templates of 31 source pages; 75 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00100-basics.apx
- pages/p00101-single-search-configuration.apx
- pages/p00102-multiple-search-configurations.apx
- pages/p00103-rest-data-source.apx
- pages/p00104-movie-details.apx
- pages/p00105-company-details.apx
- pages/p00106-store-details.apx
- pages/p00200-use-cases.apx
- pages/p00201-search-query-prefix.apx
- pages/p00202-link-search-result-to-form.apx
- pages/p00203-customer-details.apx
- pages/p00204-custom-result-row-template.apx
- pages/p00205-product-details.apx
- pages/p00206-filter-search-configurations.apx
- pages/p00207-multiple-search-regions.apx
- pages/p00300-advanced.apx
- pages/p00301-cards-region.apx
- pages/p00302-map-region.apx
- pages/p00303-highlight-results.apx
- pages/p00304-card-region-details.apx
- pages/p00400-oracle-text.apx
- pages/p00401-standard.apx
- pages/p00402-text-index-function.apx
- pages/p00500-administration.apx
- pages/p00501-manage-sample-data.apx
- pages/p00502-application-theme-style.apx
- pages/p00503-web-credentials-settings.apx
- pages/p00600-help.apx
- pages/p09999-login.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/lists/administration.apx
- shared-components/lists/advanced.apx
- shared-components/lists/basics.apx
- shared-components/lists/home.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/oracle-text.apx
- shared-components/lists/use-cases.apx
- shared-components/lovs/login-remember-username.apx
- shared-components/lovs/product-colors.apx
- shared-components/rest-data-sources/Company-Details.apx
- shared-components/rest-data-sources/Movie-Details.apx
- shared-components/rest-data-sources/MovieDB.apx
- shared-components/rest-data-sources/Search-Company.apx
- shared-components/search-configs/cancelled-orders-search-configuration.apx
- shared-components/search-configs/company.apx
- shared-components/search-configs/complete-orders-search-configuration.apx
- shared-components/search-configs/customer.apx
- shared-components/search-configs/movie.apx
- shared-components/search-configs/product-custom.apx
- shared-components/search-configs/product-image.apx
- shared-components/search-configs/product-prefix.apx
- shared-components/search-configs/product-search-configuration-oracle-text.apx
- shared-components/search-configs/product-text-index-function.apx
- shared-components/search-configs/product.apx
- shared-components/search-configs/store-map.apx
- shared-components/search-configs/store-prefix.apx
- shared-components/search-configs/store.apx
- shared-components/static-files.apx
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/image_not_found.png
- shared-components/static-files/product_images.zip
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/data.sql
- supporting-objects/install-scripts/install.sql
- supporting-objects/install-scripts/oracle-text-helper-package-compiles-without-oracle-text-.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/credentials/tmdb-api-key.apx
- workspace-components/rest-data-source-servers/api-themoviedb-org-3.apx
