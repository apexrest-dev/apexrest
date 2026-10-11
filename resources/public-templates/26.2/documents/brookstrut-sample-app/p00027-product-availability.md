# Product Availability — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00027-product-availability.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 140a7ea7c77e5fe78ad0ed2564d1fa12ae167e58a7f8a08388f14b9eff2d3976.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 27 (
    name: Product Availability
    alias: PRODUCT-AVAILABILITY
    title: Product Availability
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
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
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 1
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

    region product-availability (
        name: Product Availability
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select store_id,
                       store_name,
                       available_products,
                       all_products - available_products unavailable_products,
                       all_products,
                       round(100*available_products/all_products) pct_available
                from (
                select s.id store_id,
                       s.store_name,
                       (select count(*) from oow_demo_store_products p where s.id = p.store_id) available_products, 
                       p.product_count all_products
                from oow_demo_stores s,
                     (select count(*) product_count from oow_demo_items) p
                ) x
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 100000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results.
        }
        genAI {
            naturalLanguageSupport: true
        }
        actionsMenu {
            savePublicReport: true
        }
        download {
            formats: [
                csv
                html
            ]
        }
        advanced {
            savedReportMappingIdentifier: 2727376818108431806
        }

        column ALL_PRODUCTS (
            type: plainText
            heading {
                heading: All Products
                alignment: center
            }
            layout {
                sequence: 4
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: D
            }
        )

        column AVAILABLE_PRODUCTS (
            type: plainText
            heading {
                heading: Available Products
                alignment: center
            }
            layout {
                sequence: 3
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: C
            }
        )

        column PCT_AVAILABLE (
            type: plainText
            heading {
                heading: Percent Available
                alignment: center
            }
            layout {
                sequence: 7
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990
            }
            columnFormatting {
                htmlExpression: #PCT_AVAILABLE#%
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        column STORE_ID (
            type: hidden
            heading {
                heading: Store
            }
            layout {
                sequence: 1
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
            security {
                escapeSpecialChars: false
            }
        )

        column STORE_NAME (
            type: link
            heading {
                heading: Store
                alignment: center
            }
            layout {
                sequence: 2
            }
            link {
                target: {
                    page: 3
                    items: {
                        P3_ID: #STORE_ID#
                    }
                    clearCache: 3
                }
                linkText: #STORE_NAME#
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column UNAVAILABLE_PRODUCTS (
            type: plainText
            heading {
                heading: Unavailable Products
                alignment: center
            }
            layout {
                sequence: 6
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: F
            }
        )

        savedReport 27273776 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn AVAILABLE_PRODUCTS (
                sequence: 2
            )

            displayColumn PCT_AVAILABLE (
                sequence: 4
            )

            displayColumn STORE_NAME (
                sequence: 1
            )

            displayColumn UNAVAILABLE_PRODUCTS (
                sequence: 3
            )

            sort (
                column: PCT_AVAILABLE
                sort {
                    direction: desc
                    sequence: 1
                }
            )

            sort (
                column: STORE_NAME
                sort {
                    sequence: 2
                }
            )

        )

    )

    button up (
        buttonName: up
        label: Up
        layout {
            sequence: 10
            region: @breadcrumb
            slot: up
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-arrow-up
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 19
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
