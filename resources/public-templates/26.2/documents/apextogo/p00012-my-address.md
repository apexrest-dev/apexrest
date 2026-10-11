# My Address — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00012-my-address.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f47424667a656f0ed19ac90adf5095fef224252cad73a502c0ca77a49adb62a1.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 12 (
    name: My Address
    alias: MY-ADDRESS
    title: My Address
    pageGroup: @user-settings
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }

    region actions (
        name: Actions
        type: staticContent
        layout {
            sequence: 60
            slot: dialogFooter
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--stacked
                t-Region--scrollBody
            ]
        }
    )

    region location-map (
        name: Location Map
        type: map
        source {
            pageItemsToSubmit: [
                P12_LATITUDE
                P12_LONGITUDE
            ]
        }
        layout {
            sequence: 50
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        controls {
            options: [
                mousewheelZoom
                rectangleZoom
                scaleBar
                infiniteMap
                getBrowserLocation
            ]
        }
        initialPositionAndZoom {
            getPositionFromBrowser: true
            type: staticValues
            longitude: 0
            latitude: 0
        }
        legend {
            show: false
        }
        attributes {
            messagesPosition: below
        }
        performance {
            lazyLoading: false
        }

        layer map (
            name: Map
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select to_number( :P12_LATITUDE ) lat,
                           to_number( :P12_LONGITUDE ) lon
                      from sys.dual
                    ```
                pageItemsToSubmit: [
                    P15_LATITUDE
                    P15_LONGITUDE
                ]
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LON
                latitudeColumn: LAT
            }
            appearance {
                fillColor: #de5234
            }
        )

    )

    pageItem P12_LATITUDE (
        type: hidden
        layout {
            sequence: 30
            slot: contentBody
        }
    )

    pageItem P12_LONGITUDE (
        type: hidden
        layout {
            sequence: 40
            slot: contentBody
        }
    )

    button back (
        buttonName: BACK
        label: Account
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--simple
                t-Button--iconLeft
                t-Button--gapBottom
            ]
            icon: fa-chevron-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 20000
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 10
            region: @actions
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
                t-Button--stretch
                t-Button--padTop
            ]
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 20000
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction get-current-position-onload (
        name: Get Current Position onLoad
        execution {
            sequence: 10
        }
        when {
            event: ready
        }

        action native-get-current-position (
            action: getCurrentPosition
            settings {
                returnType: latitudeAndLongitude
                latitudeItem: P12_LATITUDE
                longitudeItem: P12_LONGITUDE
                enableHighAccuracy: true
            }
            execution {
                sequence: 20
            }
        )

    )

)


````
