# Polar — Sample Charts

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-charts/apexlang/sample-charts/pages/p00019-polar.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d5bf14d1bc0a812dffab547d7a9e36cb6368e7451901dd965d7e0f55997aa528.

Application dependency inventory: oracle:26.2:public-template/sample-charts/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 19 (
    name: Polar
    alias: POLAR
    title: Polar
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    help {
        helpText: No help is available for this page.
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>&PRODUCT_NAME. native Polar charts, using Oracle JET Data Visualizations, are showcased on this page.  A polar chart has a radial y-axis and a tangential x-axis. Polar charts support a variety of series types, such as Bar, Line, Area, Line with Area, Combination, scatter, Bubble, Area Range, and Bar Range. Polar charts are recommended for directional data. (e.g. air drag vs. boat angle). Polar charts are also recommended for categorical data where all categories are equally important. (e.g performance appraisal categories).</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--customIcons
                t-Alert--info
            ]
            icon: fa-polar-chart
        }
    )

    region breadcrumb (
        name: breadcrumb
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

    region information (
        name: Information
        type: staticContent
        source {
            htmlCode:
                ```html
                This example demonstrates a Polar chart with varying line types and styles.<p/>
                <strong>Maximum Width & Height</strong> - Chart-level attributes Maximum Width and Height have been set to 500px and 450px respectively, to size the chart within its region.  If you wish to default to using 100% width and height of the given region, simply remove these values, and utilitise the Template Options of the region to control the height as you wish.<p/> 
                <strong>Line Style & Type</strong> - Use the series-level attributes to define various line styles, such as dotted, and types, such as curved, to the chart.<p/>
                <strong>Marker</strong> - Use the series-level attribute to define various markers to the data items rendered on the chart.<p/>
                <strong>Label Position</strong> - Use this series-level attribute to control the positioning of the labels on data items of the chart.<p/>
                For more information on the Polar chart settings, refer to the Oracle JET Cookbook <a href="https://www.oracle.com/webfolder/technetwork/jet/jetCookbook.html?component=polarChart&demo=lineTypes" target="_blank" rel="noopener noreferrer external">Polar Chart: Line Types</a> and <a href="https://www.oracle.com/webfolder/technetwork/jet/jetCookbook.html?component=polarChart&demo=default" target="_blank" rel="noopener noreferrer external">Polar Chart: Basic</a> examples.
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--scrollBody
            ]
        }
    )

    region polar (
        name: Polar
        type: chart
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                js-showMaximizeButton
                t-Region--scrollBody
            ]
        }
        security {
            escapeSpecialChars: false
        }
        chart {
            type: polar
        }
        chartAppearance {
            stack: true
        }
        chartLayout {
            maxWidth: 500
            height: 400
        }
        performance {
            lazyLoading: true
        }
        legend {
            position: top
        }

        series acme-store (
            name: Acme Store
            type: lineWithArea
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select a.product_name, b.quantity, b.customer
                    from eba_demo_chart_products a, eba_demo_chart_orders b
                    where a.product_id = b.product_id
                    and customer = 'Acme Store'
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
            }
            line {
                type: straight
            }
            label {
                show: true
            }
        )

        series shop-c (
            name: Shop C
            type: lineWithArea
            execution {
                sequence: 30
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select a.product_name, b.quantity, b.customer
                    from eba_demo_chart_products a, eba_demo_chart_orders b
                    where a.product_id = b.product_id
                    and customer = 'Shop C'
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
            }
            line {
                type: curved
            }
            label {
                show: true
            }
        )

        series store-a (
            name: Store A
            type: lineWithArea
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select a.product_name, b.quantity, b.customer
                    from eba_demo_chart_products a, eba_demo_chart_orders b
                    where a.product_id = b.product_id
                    and customer = 'Store A'
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
                legendTooltip: PRODUCT_NAME
            }
            line {
                type: curved
            }
            label {
                show: true
            }
        )

        axis x (
            name: x
            majorTicks {
                show: auto
            }
        )

        axis y (
            name: y
            value {
                format: decimal
                decimalPlaces: 0
            }
            majorTicks {
                show: auto
            }
        )

    )

)


````
