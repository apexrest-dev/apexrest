# Transaction Detail — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00036-transaction-detail.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 76487115a3d85adec9ad1bfa2750cdaffbf84f490d1d76f0976192abb41a3d68.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 36 (
    name: Transaction Detail
    alias: TRANSACTION-DETAIL
    title: Transaction Detail
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

    region transaction-detail (
        name: Transaction Detail
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    count(distinct h.store_id) stores,
                    count(distinct p.item_id)  products,
                    sum(h.QUANTITY * h.ITEM_PRICE) Transaction_amount,
                    count(*) line_items
                from #OWNER#.OOW_DEMO_SALES_HISTORY h,
                     #OWNER#.OOW_DEMO_STORE_PRODUCTS p
                where 
                      p.ITEM_ID = h.PRODUCT_ID and
                      h.ID = :P36_TRANSACTION_ENTRY_ID
                 
                
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        reportLayout {
            numberOfRows: 50
        }
        componentAppearance {
            template: @/badge-list
            templateOptions: [
                #DEFAULT#
                u-colors
                t-BadgeList--large
                t-BadgeList--dash
                t-BadgeList--fixed
            ]
        }
        pagination {
            type: showAll
        }
        performance {
            maxRowsToProcess: 500
        }
        messages {
            whenNoDataFound: no data found
        }

        column LINE_ITEMS (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Line Items
                alignment: end
            }
            layout {
                sequence: 70
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
        )

        column PRODUCTS (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Products
                alignment: end
            }
            layout {
                sequence: 60
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
        )

        column STORES (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Stores
                alignment: end
            }
            layout {
                sequence: 10
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
        )

        column TRANSACTION_AMOUNT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Transaction Amount
                alignment: end
            }
            layout {
                sequence: 80
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
        )

    )

    region transaction-line-items (
        name: Transaction Line Items
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    h.id,
                    h.store_id stores_ID,
                    (select store_name from #OWNER#.oow_demo_stores s where s.id = h.store_id) store,
                    p.item_id  product_ID,
                    (select item_name from OOW_DEMO_ITEMS p where p.id = h.product_id) product,
                    h.QUANTITY,
                    h.ITEM_PRICE,
                    h.QUANTITY * h.ITEM_PRICE Transaction_amount
                from OOW_DEMO_SALES_HISTORY h,
                     OOW_DEMO_STORE_PRODUCTS p
                where 
                      p.ITEM_ID = h.PRODUCT_ID and
                      h.ID = :P36_TRANSACTION_ENTRY_ID
                 
                
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        reportLayout {
            numberOfRows: 150
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 110
            }
        )

        column ITEM_PRICE (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Item Price
                alignment: end
            }
            layout {
                sequence: 90
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
        )

        column PRODUCT (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Product
            }
            layout {
                sequence: 70
            }
        )

        column PRODUCT_ID (
            reportColumnQueryId: 4
            derivedColumn: N
            type: hidden
            layout {
                sequence: 60
            }
        )

        column QUANTITY (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Quantity
                alignment: end
            }
            layout {
                sequence: 80
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            advanced {
                computeSum: true
            }
        )

        column STORE (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Store
            }
            layout {
                sequence: 50
            }
        )

        column STORES_ID (
            reportColumnQueryId: 2
            derivedColumn: N
            type: hidden
            layout {
                sequence: 40
            }
        )

        column TRANSACTION_AMOUNT (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Transaction Amount
                alignment: end
            }
            layout {
                sequence: 100
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            advanced {
                computeSum: true
            }
        )

    )

    pageItem P36_TRANSACTION_DATE (
        type: displayOnly
        label {
            label: Transaction Date
            alignment: left
        }
        layout {
            sequence: 30
            region: @transaction-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P36_TRANSACTION_ENTRY_ID (
        type: displayOnly
        label {
            label: Transaction Line Item ID
            alignment: left
        }
        layout {
            sequence: 10
            region: @transaction-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P36_TRANSACTION_ID (
        type: displayOnly
        label {
            label: Transaction ID
            alignment: left
        }
        layout {
            sequence: 20
            region: @transaction-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    computation p36-transaction-date (
        itemName: P36_TRANSACTION_DATE
        execution {
            sequence: 10
            point: afterHeader
        }
        computation {
            sqlQuery:
                ```sql
                select to_char(DATE_OF_SALE,'DD-MON-YYYY HH24:MI:SS') TRANSACTION_DATE
                from   OOW_DEMO_SALES_HISTORY
                where  ID = :P36_TRANSACTION_ENTRY_ID
                ```
        }
    )

    computation p36-transaction-id (
        itemName: P36_TRANSACTION_ID
        execution {
            sequence: 20
            point: afterHeader
        }
        computation {
            sqlQuery:
                ```sql
                select transaction_id
                from   OOW_DEMO_SALES_HISTORY
                where  ID = :P36_TRANSACTION_ENTRY_ID
                ```
        }
    )

)


````
