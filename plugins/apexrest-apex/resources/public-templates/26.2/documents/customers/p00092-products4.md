# Products — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00092-products4.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7f2fbd542fba021375b7e8727282a695770492a08dd34d7047736bba3653ac2f.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 92 (
    name: Products
    alias: PRODUCTS4
    title: Products
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
            sequence: 20
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

    region customer-counts-by-product (
        name: Customer Counts by Product
        type: chart
        source {
            pageItemsToSubmit: [
                P92_CATEGORY
                P92_GEO
            ]
        }
        layout {
            sequence: 40
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h480
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
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
            show: false
        }
        legend {
            position: top
            hideAndShowBehavior: none
        }

        series customer-counts-by-product (
            name: Customer Counts by Product
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select product_name, id, customer_users , description
                    from (
                       select product_name, 
                              description, 
                              id, 
                             (select count(distinct c.id) 
                              from   eba_cust_product_uses u, 
                                     eba_cust_customers c
                              where  u.product_id = p.id and 
                                   u.customer_id = c.id and 
                                  (NVL(:P92_CATEGORY,0) = 0 or c.CATEGORY_ID = :P92_CATEGORY) and 
                                 (NVL(:P92_GEO,0) = 0 or :P92_GEO = c.geography_id)
                             ) 
                             customer_users
                       from eba_cust_products p
                    ) x
                    where customer_users > 0
                    order by 1
                    ```
                pageItemsToSubmit: [
                    P92_CATEGORY
                    P92_GEO
                ]
            }
            columnMapping {
                label: PRODUCT_NAME
                value: CUSTOMER_USERS
                labelTooltip: DESCRIPTION
            }
            appearance {
                color: RED
            }
            link {
                type: redirectThisApp
                target: {
                    page: 19
                    items: {
                        IR_PRODUCT_NAME: &PRODUCT_NAME.
                    }
                    clearCache: [
                        19
                        RIR
                    ]
                    action: resetPagination
                }
            }
        )

        axis x (
            name: x
            majorTicks {
                show: false
            }
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

    pageItem P92_CATEGORY (
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

    pageItem P92_GEO (
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
            items: P92_GEO
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @customer-counts-by-product
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

    )

    dynamicAction prod-counts (
        name: prod counts
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P92_CATEGORY
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @customer-counts-by-product
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

    )

)


````
