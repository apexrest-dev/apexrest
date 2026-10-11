# Airports Heat Map — Sample Maps

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-maps/apexlang/sample-maps/pages/p00110-airports-heat-map.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 68640114b3163999c8d160570d3434b2fdbedd638673b06038df349135dded80.

Application dependency inventory: oracle:26.2:public-template/sample-maps/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 110 (
    name: Airports Heat Map
    alias: AIRPORTS-HEAT-MAP
    title: &APP_NAME. - Airports Heat Map
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }

    region about-this-page (
        name: About This Page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                This page visualizes US <strong>Heliports</strong> as 
                 a <em>Heat Map</em>. Heat maps are used to visualize the density of spatial objects. Zoom in and out to see how the heat map visualizes point density.
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

    region state (
        name: State
        type: staticContent
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
    )

    region us-airports (
        name: US Airports
        type: map
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
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

        layer airports-density (
            name: Airports Density
            layerType: heatMap
            layout {
                sequence: 20
            }
            source {
                tableName: EBA_SAMPLE_MAP_AIRPORTS
                whereClause:
                    ```sql
                    STATE_NAME = :P110_STATE or :P110_STATE IS NULL
                    and airport_type = 'HELIPORT' 
                    ```
                pageItemsToSubmit: P110_STATE
                useVectorTiles: true
            }
            columnMapping {
                geometryColumn: GEOMETRY
                primaryKeyColumn: ID
            }
            appearance {
                colorScheme: sequential
                schemeName: sunset
            }
        )

        layer us-state (
            name: US State
            layerType: polygons
            layout {
                sequence: 10
            }
            source {
                tableName: EBA_SAMPLE_MAP_STATES
                whereClause: upper(NAME) = :P110_STATE
                pageItemsToSubmit: P110_STATE
                useVectorTiles: true
            }
            columnMapping {
                geometryColumn: GEOMETRY
            }
            appearance {
                fillColor: #808080
                fillOpacity: .3
                strokeColor: #101010
            }
            tooltip {
                column: NAME
            }
        )

    )

    pageItem P110_STATE (
        type: selectList
        label {
            label: Filter for State
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select distinct initcap( name ) d, upper(name) r
                  from EBA_SAMPLE_MAP_STATES
                 order by 1
                ```
            displayExtraValues: false
            nullDisplayValue: All States
        }
        layout {
            sequence: 10
            region: @state
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--stretchInputs
                t-Form-fieldContainer--large
            ]
            height: 1
        }
    )

    dynamicAction refresh-map (
        name: Refresh Map
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P110_STATE
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @us-airports
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
