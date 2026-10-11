# Sample Cards: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

23 included page templates of 25 source pages; 59 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00002-blob-column.apx
- pages/p00003-basic-cards.apx
- pages/p00004-image-url.apx
- pages/p00005-blob-column-as-url.apx
- pages/p00006-movies.apx
- pages/p00007-background-image.apx
- pages/p00008-app-static-files.apx
- pages/p00009-template-directives.apx
- pages/p00010-apex-play-list.apx
- pages/p00011-gauge-meter-chart-cards.apx
- pages/p00012-faceted-search-with-cards.apx
- pages/p00013-star-icons.apx
- pages/p00014-employee-detail.apx
- pages/p00015-full-card-aciton.apx
- pages/p00016-conditional-actions.apx
- pages/p00017-no-data-found-message.apx
- pages/p00018-color-coded-cards.apx
- pages/p00019-advanced.apx
- pages/p00020-basics.apx
- pages/p00021-images-and-media.apx
- pages/p00022-card-actions.apx
- pages/p00023-help.apx
- pages/p09999-login.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/component-settings.apx
- shared-components/lists/advanced.apx
- shared-components/lists/basics.apx
- shared-components/lists/card-actions.apx
- shared-components/lists/desktop-navigation-bar.apx
- shared-components/lists/desktop-navigation-menu.apx
- shared-components/lists/home.apx
- shared-components/lists/images-and-media.apx
- shared-components/lists/page-navigation.apx
- shared-components/lovs/dept-dname.apx
- shared-components/lovs/emp-mgr.apx
- shared-components/lovs/login-remember-username.apx
- shared-components/rest-data-sources/APEX-Youtube-PlayList-Items.apx
- shared-components/rest-data-sources/APEX-Youtube-Playlists.apx
- shared-components/rest-data-sources/APEX-Youtube-Videos.apx
- shared-components/rest-data-sources/Movie-Database.apx
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/apex-mountain-range_light.png
- shared-components/static-files/app-icon.css
- shared-components/static-files/app-icon.svg
- shared-components/static-files/app-sample-cards-16x16.png
- shared-components/static-files/app-sample-cards-32x32.png
- shared-components/static-files/app-sample-cards.ico
- shared-components/static-files/app-sample-cards.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/themes/universal-theme/page-templates/bare.apx
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/eba-demo-card-pkg.sql
- supporting-objects/install-scripts/emp-adams.sql
- supporting-objects/install-scripts/emp-allen.sql
- supporting-objects/install-scripts/emp-blake.sql
- supporting-objects/install-scripts/emp-dept-tables.sql
- supporting-objects/install-scripts/emp-diana.sql
- supporting-objects/install-scripts/emp-james.sql
- supporting-objects/install-scripts/emp-jones.sql
- supporting-objects/install-scripts/emp-king.sql
- supporting-objects/install-scripts/emp-martin.sql
- supporting-objects/install-scripts/emp-mee.sql
- supporting-objects/install-scripts/emp-sari.sql
- supporting-objects/install-scripts/emp-sarita.sql
- supporting-objects/install-scripts/emp-susan.sql
- supporting-objects/install-scripts/emp-thea.sql
- supporting-objects/install-scripts/emp-wei.sql
- supporting-objects/install-scripts/load-dept-data.sql
- supporting-objects/install-scripts/random-image.sql
- supporting-objects/install-scripts/vehicle-speed.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- workspace-components/app-groups/sample-apps.apx
- workspace-components/credentials/Moviedb-API-Key.apx
- workspace-components/credentials/google-api-key.apx
- workspace-components/rest-data-source-servers/api-themoviedb-org-3-list.apx
- workspace-components/rest-data-source-servers/www-googleapis-com-youtube-v3.apx
