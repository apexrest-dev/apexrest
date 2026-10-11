# Sample Maps: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-maps/apexlang/sample-maps/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

15 included page templates of 17 source pages; 60 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00002-help.apx
- pages/p00110-airports-heat-map.apx
- pages/p00111-airports-map.apx
- pages/p00112-us-states-flat.apx
- pages/p00113-us-states-extruded.apx
- pages/p00114-us-states-with-links.apx
- pages/p00115-us-states-and-large-airports.apx
- pages/p00120-airports.apx
- pages/p00121-airports-search.apx
- pages/p00122-airports-map-circle-search.apx
- pages/p00123-map-and-report.apx
- pages/p00124-nearest-neighbor-search.apx
- pages/p00201-legacy-oracle-maps-plug-in.apx
- pages/p00501-load-full-dataset.apx
- pages/p09999-login.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/component-settings.apx
- shared-components/lists/all-maps.apx
- shared-components/lists/desktop-navigation-bar.apx
- shared-components/lists/desktop-navigation-menu.apx
- shared-components/lists/main-menu.apx
- shared-components/lovs/login-remember-username.apx
- shared-components/lovs/lov-airports.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetCircle/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetCircle/plugin.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetData/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetData/plugin.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetHtml5Location/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetHtml5Location/events.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetHtml5Location/plugin.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetRedline/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsGetRedline/plugin.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsMapActions/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsMapActions/plugin.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsSetCenterZoomlevel/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsSetCenterZoomlevel/plugin.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsSetCustomMarker/custom-attributes.apx
- shared-components/plugins/dynamic-action/legacyOracleMapsSetCustomMarker/plugin.apx
- shared-components/plugins/dynamic-action/oracleElocationGeocoder/custom-attributes.apx
- shared-components/plugins/dynamic-action/oracleElocationGeocoder/events.apx
- shared-components/plugins/dynamic-action/oracleElocationGeocoder/plugin.apx
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/custom-attributes.apx
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/events.apx
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/plugin.apx
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files.apx
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/apx-maps-plugin-html5.js
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-blue.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-cluster.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-darkblue.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-darkgray.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-darkred.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-gray.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-green.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-lightgray.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-orange.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-purple.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-red.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-violet.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/m-yellow.png
- shared-components/plugins/region/legacyOracleHtml5MapsRegion/static-files/transp.png
- shared-components/shortcuts.apx
- shared-components/static-files.apx
- shared-components/static-files/app-icon.css
- shared-components/static-files/app-icon.svg
- shared-components/static-files/app-sample-maps-16x16.png
- shared-components/static-files/app-sample-maps-32x32.png
- shared-components/static-files/app-sample-maps.ico
- shared-components/static-files/app-sample-maps.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/map-screenshots/circle-search.jpg
- shared-components/static-files/map-screenshots/clickable-map.jpg
- shared-components/static-files/map-screenshots/faceted-search.jpg
- shared-components/static-files/map-screenshots/heat-map.jpg
- shared-components/static-files/map-screenshots/legacy.jpg
- shared-components/static-files/map-screenshots/map-and-report.jpg
- shared-components/static-files/map-screenshots/map-placeholder.jpg
- shared-components/static-files/map-screenshots/nearest-neighbor.jpg
- shared-components/static-files/map-screenshots/search-and-show.jpg
- shared-components/static-files/map-screenshots/us-states-and-large-airports.jpg
- shared-components/static-files/map-screenshots/us-states-extruded.jpg
- shared-components/static-files/map-screenshots/us-states-flat.jpg
- shared-components/static-files/map-screenshots/us-states-with-links.jpg
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-spatial-indexes.sql
- supporting-objects/install-scripts/load-data-procedure.sql
- supporting-objects/install-scripts/table-eba-sample-map-airports.sql
- supporting-objects/install-scripts/table-eba-sample-map-states.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
- supporting-objects/validations.apx
- workspace-components/app-groups/sample-apps.apx
