# US States (flat) — Sample Maps

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-maps/apexlang/sample-maps/pages/p00112-us-states-flat.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 97a53e9481380b91735fa8550a6c1598fbab76823ad56ac8cf2cfa349e2a384a.

Application dependency inventory: oracle:26.2:public-template/sample-maps/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 112 (
    name: US States (flat)
    alias: US-STATES-FLAT
    title: &APP_NAME. - US States (flat)
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }

    region about-this-page (
        name: About This Page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                This map visualizes US states as polygons. The polygon color is determined by the <strong>WATER_AREA</strong> column, using the built-in <strong>Blue to Yellow</strong> color scheme. Click on a state to show a info popup with details.
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: dialogsDrawersAndPopups
        }
        appearance {
            template: @/inline-popup
            templateOptions: [
                #DEFAULT#
                js-dialog-autoheight
                js-popup-noOverlay
                js-popup-callout
                js-dialog-size480x320
            ]
        }
        advanced {
            htmlDomId: about_this_page
            customAttributes: data-parent-element="#help_button"
            regionDisplaySelector: true
        }
    )

    region us-states (
        name: US States
        type: map
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: airport-map-region
            regionDisplaySelector: true
        }
        controls {
            options: [
                scaleBar
                infiniteMap
                rectangleZoom
            ]
        }
        initialPositionAndZoom {
            type: staticValues
            longitude: -90
            latitude: 35
            zoomLevel: 3
        }
        attributes {
            messagesPosition: below
        }

        layer us-states (
            name: US States
            layerType: polygons
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select ID,
                           NAME,
                           STATE_CODE,
                           to_char(LAND_AREA / 1000000,'9G999G999G990D000')  land_area,
                           to_char(WATER_AREA / 1000000,'9G999G999G990D000')  water_area,
                           case when water_area > 50000000000 then 50000000000 else water_area end as water_area_color,
                           geometry
                      from EBA_SAMPLE_MAP_SIMPLE_STATES
                    ```
                useVectorTiles: true
            }
            columnMapping {
                geometryColumn: GEOMETRY
                primaryKeyColumn: ID
            }
            appearance {
                useColorScheme: true
                colorScheme: sequential
                schemeName: blueToYellow
                colorValueColumn: WATER_AREA_COLOR
                fillOpacity: .7
                strokeColor: #101010
            }
            tooltip {
                column: NAME
            }
            infoWindow {
                advancedFormatting: true
                htmlExpression:
                    ```html
                    <strong>&NAME. (&STATE_CODE.)</strong><br>
                    Land Area: &LAND_AREA. km&sup2;<br>
                    Water Area: &WATER_AREA. km&sup2;<br>
                    ```
            }
            messages {
                whenNoDataFound: No States found.
            }
        )

    )

    dynamicAction on-click-point (
        name: On Click Point
        execution {
            sequence: 10
        }
        when {
            event: region/map/spatialmapobjectclick
            selectionType: region
            region: @us-states
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    const { lng, lat } = this.data;
                    
                    apex.region("airport-map-region").call( "getMapObject" ).flyTo({ 
                        center: [ lng, lat ],
                        screenSpeed: 0.8
                    });
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
