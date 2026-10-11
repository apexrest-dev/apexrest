# Customers by Category — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00032-customers-by-category.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a9fde00dbf8039741ecbd72b73ee3e473a581460b3b5d3d5ff4c410be72bd2ae.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 32 (
    name: Customers by Category
    alias: CUSTOMERS-BY-CATEGORY
    title: Customers by Category
    pageGroup: @customers
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb-2
        }
        layout {
            sequence: 30
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

    region button-bar (
        name: Button Bar
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noPadding
                t-ButtonRegion--noUI
            ]
        }
    )

    region customers-by-category (
        name: Customers by Category
        type: chart
        source {
            pageItemsToSubmit: [
                P32_CATEGORY
                P32_GEO
            ]
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
            cssClasses: scrollable-region
        }
        customization {
            customizable: shownByDefault
        }
        performance {
            lazyLoading: true
        }
        dataCursor {
            dimOnHover: false
        }
        animation {
            onDataChange: none
        }
        tooltip {
            showSeriesName: false
        }
        legend {
            show: false
        }

        series category (
            name: Category
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select id, category, cnt, category || ' ('|| cnt || ')' tooltip
                    from (select  
                       b.id,
                       b.category,
                       count(*) cnt
                    from   
                       eba_cust_customers a , 
                       eba_cust_categories b
                    where 
                       a.category_id = b.id and
                       (NVL(:P32_CATEGORY,0) = 0 or a.CATEGORY_ID = :P32_CATEGORY) and
                       (NVL(:P32_GEO,0) = 0 or :P32_GEO = a.geography_id)
                    group by b.id, b.category
                    order by 2)
                    ```
                pageItemsToSubmit: [
                    P32_CATEGORY
                    P32_GEO
                ]
            }
            columnMapping {
                label: CATEGORY
                value: CNT
                customTooltip: TOOLTIP
            }
            link {
                type: redirectThisApp
                target: {
                    page: 59
                    items: {
                        IR_CATEGORY: &CATEGORY.
                        P59_CATEGORY: &ID.
                    }
                    clearCache: RIR
                    action: resetPagination
                }
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
            minorTicks {
                show: false
            }
        )

    )

    pageItem P32_CATEGORY (
        type: selectList
        label {
            label: Category
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @cat
            nullDisplayValue: - All -
            nullReturnValue: 0
        }
        layout {
            sequence: 10
            region: @button-bar
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            type: staticValue
            staticValue: 0
        }
        default {
            type: static
            staticValue: 0
        }
    )

    pageItem P32_GEO (
        type: selectList
        label {
            label: Geography
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @geography
            nullDisplayValue: "- All - "
            nullReturnValue: 0
        }
        layout {
            sequence: 20
            region: @button-bar
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @breadcrumb
            slot: create
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: &APP_PAGE_ID.
                clearCache: [
                    &APP_PAGE_ID.
                    RIR
                ]
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction geo (
        name: geo
        execution {
            sequence: 20
        }
        when {
            selectionType: items
            items: P32_GEO
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @customers-by-category
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

    )

    dynamicAction set-cat (
        name: set cat
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P32_CATEGORY
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @customers-by-category
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

    )

)


````
