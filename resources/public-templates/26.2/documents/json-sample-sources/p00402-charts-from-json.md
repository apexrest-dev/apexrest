# Charts from JSON — Json Sample Sources

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/pages/p00402-charts-from-json.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 81b131a231d21de47df4581865a1d81d3ef4e9131f3327106b9c63293404e30f.

Application dependency inventory: oracle:26.2:public-template/json-sample-sources/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 402 (
    name: Charts from JSON
    alias: CHARTS-FROM-JSON
    title: Charts from JSON
    pageGroup: @data-presentation
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region order-distribution-per-city (
        name: Order Distribution Per City
        type: chart
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        security {
            escapeSpecialChars: false
        }
        chart {
            type: line
        }
        chartLayout {
            height: 400
        }
        performance {
            lazyLoading: true
        }
        tooltip {
            showSeriesName: false
        }

        series cities (
            name: Cities
            execution {
                sequence: 10
            }
            source {
                location: jsonSource
                jsonSource: @eba_demo_json_orders
            }
            columnMapping {
                label: DELIVERY_ADDRESS_CITY
                valueAggregation: count
            }
            performance {
                maxRowsToProcess: 20
            }
        )

        axis x (
            name: x
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            minorTicks {
                show: false
            }
        )

    )

    region order-status-distribution (
        name: Order Status Distribution
        type: chart
        layout {
            sequence: 40
            slot: body
            startNewRow: false
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        security {
            escapeSpecialChars: false
        }
        chartLayout {
            height: 400
        }
        performance {
            lazyLoading: true
        }
        dataCursor {
            dimOnHover: false
        }
        tooltip {
            showSeriesName: false
        }

        series order-status (
            name: Order Status
            execution {
                sequence: 10
            }
            source {
                location: jsonSource
                jsonSource: @eba_demo_json_orders
            }
            columnMapping {
                label: ORDER_STATUS
                valueAggregation: count
            }
            performance {
                maxRowsToProcess: 20
            }
        )

        axis x (
            name: x
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            minorTicks {
                show: false
            }
        )

    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                This page demonstrates how to create interactive charts directly from JSON data in Oracle APEX using the <strong>EBA_DEMO_JSON_ORDERS</strong> JSON source as the data source.
                </p>
                
                <ul>
                <li>The first chart is a line chart showing the number of orders per <strong>delivery_address_city</strong>.</li>
                <li>The second chart is a pie chart illustrating the distribution of <strong>order_status</strong> across all orders.</li>
                <li>The third chart is a bar chart showing the distribution of <strong>shipment_status</strong>.</li>
                </ul>
                
                <p>
                To get started, explore the charts to analyze order activity, order status distribution, and shipment progress directly from the JSON-based dataset. 
                You can interact with the chart regions to better understand trends and patterns within the order data stored in Oracle APEX.
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
    )

    region shipment-status-distribution (
        name: Shipment Status Distribution
        type: chart
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        security {
            escapeSpecialChars: false
        }
        chart {
            type: pie
        }
        chartLayout {
            height: 400
        }
        performance {
            lazyLoading: true
        }
        value {
            format: decimal
            decimalPlaces: 0
            formatScaling: none
        }
        tooltip {
            showSeriesName: false
        }

        series shipment-status (
            name: Shipment Status
            execution {
                sequence: 10
            }
            source {
                location: jsonSource
                jsonSource: @eba_demo_json_orders
            }
            columnMapping {
                label: SHIPMENT_STATUS
                valueAggregation: count
            }
            label {
                show: true
            }
            performance {
                maxRowsToProcess: 20
            }
        )

    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 403
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 401
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
