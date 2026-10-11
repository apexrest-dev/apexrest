# US States with Links — Sample Maps

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-maps/apexlang/sample-maps/pages/p00114-us-states-with-links.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1d2b6c9198c90df9128f58fe51824f7a170c18418de24183e6d152efaecd8c69.

Application dependency inventory: oracle:26.2:public-template/sample-maps/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 114 (
    name: US States with Links
    alias: US-STATES-WITH-LINKS
    title: &APP_NAME. - US States with Links
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
                This map visualizes US states as <em>Extruded</em> polygons. Polygon color is derived from 
                the "airport count" by state. The states and airports table are joined using the state name. 
                Click on a state to be redirected to a <em>Faceted Search</em> page with more details.
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

    region airports-by-state (
        name: Airports by State
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

        layer airports-by-state (
            name: Airports by State
            layerType: polygons
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    with data as (
                        select s.ID,
                           s.NAME,
                           s.STATE_CODE,
                           ( select count( a.id ) 
                               from eba_sample_map_airports a
                              where commercial_ops > 0 and upper(s.name) = upper(a.state_name) ) airport_count,
                           s.GEOMETRY
                      from EBA_SAMPLE_MAP_SIMPLE_STATES s
                    ) 
                    select id,
                           upper(name) as name,
                           state_code,
                           airport_count,
                           airport_count * 10 as polygon_height,
                           geometry
                      from data
                    ```
            }
            columnMapping {
                geometryColumn: GEOMETRY
                primaryKeyColumn: ID
            }
            appearance {
                useColorScheme: true
                colorScheme: diverging
                schemeName: temps
                colorValueColumn: AIRPORT_COUNT
                fillOpacity: .7
                strokeColor: #101010
            }
            tooltip {
                column: NAME
            }
            link {
                type: redirectThisApp
                target: {
                    page: 110
                    items: {
                        P110_STATE: &NAME.
                    }
                    clearCache: 110
                }
            }
            messages {
                whenNoDataFound: No States found.
            }
        )

    )

)


````
