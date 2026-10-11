# Sample Vector Search: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

25 included page templates of 27 source pages; 73 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00010-movie-vector-search.apx
- pages/p00011-prepare-movie-data-1.apx
- pages/p00012-prepare-movie-data-step-2.apx
- pages/p00013-prepare-movie-data-3.apx
- pages/p00014-prepare-movie-data-4.apx
- pages/p00015-basic-vector-search1.apx
- pages/p00016-vector-vs-oracle-text1.apx
- pages/p00017-vector-and-oracle-text1.apx
- pages/p00024-custom-vector-search.apx
- pages/p00025-prepare-custom-data-1.apx
- pages/p00026-prepare-custom-data-2.apx
- pages/p00027-prepare-custom-data-3.apx
- pages/p00030-prepare-custom-data-4.apx
- pages/p00031-basic-vector-search.apx
- pages/p00032-vector-vs-oracle-text.apx
- pages/p00033-vector-and-oracle-text.apx
- pages/p00041-movie-recommendation.apx
- pages/p00042-mixed-languages.apx
- pages/p00049-movie-details.apx
- pages/p00050-administration.apx
- pages/p00051-reset-sample-data-tables.apx
- pages/p00052-application-theme-style.apx
- pages/p00054-set-ai-provider.apx
- pages/p00100-getting-started.apx
- pages/p09999-login.apx
- shared-components/ai-agents/oci.apx
- shared-components/ai-agents/openai.apx
- shared-components/app-computations.apx
- shared-components/app-items.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/data-load-definitions/genai-csv-load.apx
- shared-components/data-load-definitions/manual-csv-load.apx
- shared-components/lists/administration.apx
- shared-components/lists/ai-generated-data-progress.apx
- shared-components/lists/custom-vector-search.apx
- shared-components/lists/home-page-list.apx
- shared-components/lists/movie-vector-search.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/upload-data-progress.apx
- shared-components/lists/vector-search-custom-data.apx
- shared-components/lists/vector-search-movie-data.apx
- shared-components/messages.apx
- shared-components/search-configs/OCI-ADVANCED-VECTOR-SEARCH.apx
- shared-components/search-configs/OCI-BASIC-VECTOR-SEARCH.apx
- shared-components/search-configs/OCI-MOVIE-RECOMMENDATION.apx
- shared-components/search-configs/OPENAI-ADVANCED-VECTOR-SEARCH.apx
- shared-components/search-configs/OPENAI-BASIC-VECTOR-SEARCH.apx
- shared-components/search-configs/OPENAI-MOVIE-RECOMMENDATION.apx
- shared-components/search-configs/ORACLE-TEXT-SEARCH-AND-VECTOR.apx
- shared-components/search-configs/ORACLE-TEXT-SEARCH.apx
- shared-components/search-configs/oracle-text-search-and-vector-datatable.apx
- shared-components/search-configs/oracle-text-search-moviedata.apx
- shared-components/static-files.apx
- shared-components/static-files/SAMPLE.csv
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-sample-data.sql
- supporting-objects/install-scripts/helper-package.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- supporting-objects/validations.apx
- workspace-components/credentials/EBA-CREDENTIALS-OCI.apx
- workspace-components/credentials/EBA-CREDENTIALS-OPENAI.apx
- workspace-components/generative-ai-services/EBA-GENAI-OCI.apx
- workspace-components/generative-ai-services/EBA-GENAI-OPENAI.apx
- workspace-components/vector-providers/EBA-VECTOR-OCI.apx
- workspace-components/vector-providers/EBA-VECTOR-OPENAI.apx
