# Store Details — Sample Application Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-application-search/apexlang/sample-application-search/pages/p00106-store-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c3fc230141b87d40aa2742119b668bbe811ee4a53f6940055637fb8307034e44.

Application dependency inventory: oracle:26.2:public-template/sample-application-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 106 (
    name: Store Details
    alias: STORE-DETAILS
    title: Store Details
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }

    region details (
        name: Details
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select store_id,
                       store_name,
                       web_address,
                       physical_address
                  from eba_demo_search_stores 
                where store_id=:P106_STORE_ID;
                ```
            pageItemsToSubmit: P106_STORE_ID
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleB
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            layout: horizontal
        }
        card {
            primaryKeyColumn1: STORE_ID
        }
        title {
            column: STORE_NAME
        }
        body {
            advancedFormatting: true
            htmlExpression:
                ```html
                {if PHYSICAL_ADDRESS/}<p><span class="fa fa-map-marker-o"></span> &PHYSICAL_ADDRESS.</p>{endif/}
                {if WEB_ADDRESS/}<p><span class="fa fa-globe"></span> &WEB_ADDRESS.</p>{endif/}
                
                ```
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: STORE_NAME
        }
    )

    region location (
        name: Location
        type: map
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select store_id,
                       store_name,
                       web_address,
                       physical_address,
                       latitude,
                       longitude
                  from eba_demo_search_stores
                where store_id = :P106_STORE_ID
                
                ```
            pageItemsToSubmit: P106_STORE_ID
        }
        layout {
            sequence: 30
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        advanced {
            htmlDomId: store-map-region
            regionDisplaySelector: true
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P106_LONGITUDE
        }
        map {
            height: 240
        }
        initialPositionAndZoom {
            type: sqlQuery
            sqlQuery:
                ```sql
                select longitude,
                       latitude, 
                       11 zoom 
                  from eba_demo_search_stores 
                where store_id = :P106_STORE_ID
                ```
            geometryColumnDataType: longitudeLatitude
            initialLongitudeColumn: LONGITUDE
            initialLatitudeColumn: LATITUDE
            initialZoomlevelColumn: ZOOM
        }
        attributes {
            messagesPosition: below
        }

        layer map (
            name: Map
            layout {
                sequence: 10
            }
            source {
                location: regionSource
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LONGITUDE
                latitudeColumn: LATITUDE
                primaryKeyColumn: STORE_ID
            }
            appearance {
                fillColor: #008000
            }
        )

    )

    region store-details (
        name: Store Details
        type: form
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select store_id,
                       store_name,
                       web_address,
                       physical_address,
                       latitude,
                       longitude
                  from eba_demo_search_stores 
                where store_id = :P106_STORE_ID;
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P106_LATITUDE (
        type: hidden
        layout {
            sequence: 50
            region: @store-details
            slot: regionBody
        }
        source {
            formRegion: @store-details
            column: LATITUDE
            dataType: number
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P106_LONGITUDE (
        type: hidden
        layout {
            sequence: 60
            region: @store-details
            slot: regionBody
        }
        source {
            formRegion: @store-details
            column: LONGITUDE
            dataType: number
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P106_PHYSICAL_ADDRESS (
        type: hidden
        layout {
            sequence: 40
            region: @store-details
            slot: regionBody
        }
        source {
            formRegion: @store-details
            column: PHYSICAL_ADDRESS
            dataType: varchar2
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P106_STORE_ID (
        type: hidden
        layout {
            sequence: 10
            region: @store-details
            slot: regionBody
        }
        source {
            formRegion: @store-details
            column: STORE_ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P106_STORE_NAME (
        type: hidden
        layout {
            sequence: 20
            region: @store-details
            slot: regionBody
        }
        source {
            formRegion: @store-details
            column: STORE_NAME
            dataType: varchar2
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P106_WEB_ADDRESS (
        type: hidden
        layout {
            sequence: 30
            region: @store-details
            slot: regionBody
        }
        source {
            formRegion: @store-details
            column: WEB_ADDRESS
            dataType: varchar2
        }
        security {
            sessionStateProtection: restricted
        }
    )

    process initialize-form-store-details (
        name: Initialize form Store Details
        type: formInitialization
        formRegion: @store-details
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 4100441537823979086
        }
    )

)


````
