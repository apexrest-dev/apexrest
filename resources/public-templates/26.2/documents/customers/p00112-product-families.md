# Product Families — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00112-product-families.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6755fa3352f14cbca76a465f8fb807bbcea18a94f2febb0b3a2042866e646b65.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 112 (
    name: Product Families
    alias: PRODUCT-FAMILIES
    title: Product Families
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
            t-Dialog--noPadding
        ]
    }
    dialog {
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region product-families (
        name: Product Families
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select "ID", 
                "NAME",
                "DESCRIPTION",
                "CREATED",
                lower(created_by) CREATED_BY,
                "UPDATED",
                lower(updated_by) UPDATED_BY,
                ( select count(*) from eba_cust_products p where p.product_family_id = pf.id ) products
                from EBA_CUST_PRODUCT_FAMILIES pf
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--noBorders
            ]
        }
        link {
            linkColumn: customTarget
            target: {
                page: 113
                items: {
                    P113_ID: #ID#
                }
            }
            linkIcon: <img src="#IMAGE_PREFIX#app_ui/img/icons/apex-edit-pencil.png" class="apex-edit-pencil" alt="">
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 1000000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: The maximum row count for this report is #MAX_ROW_COUNT# rows.  Please apply a filter to reduce the number of records in your query.
        }
        actionsMenu {
            subscription: false
        }
        advanced {
            savedReportMappingIdentifier: 16705461858108510136
        }

        column CREATED (
            type: plainText
            heading {
                heading: Created
            }
            layout {
                sequence: 4
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: D
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
            }
            layout {
                sequence: 5
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: E
            }
        )

        column DESCRIPTION (
            type: plainText
            heading {
                heading: Description
            }
            layout {
                sequence: 3
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: C
            }
        )

        column ID (
            type: hidden
            heading {
                heading: Id
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

        column NAME (
            type: plainText
            heading {
                heading: Product Family
            }
            layout {
                sequence: 2
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column PRODUCTS (
            type: plainText
            heading {
                heading: Products
                alignment: end
            }
            layout {
                sequence: 17
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: H
            }
        )

        column UPDATED (
            type: plainText
            heading {
                heading: Updated
            }
            layout {
                sequence: 6
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: F
            }
        )

        column UPDATED_BY (
            type: plainText
            heading {
                heading: Updated By
            }
            layout {
                sequence: 7
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: G
            }
        )

        page {
            borderWidth: 0.5
            borderColor: #666666
        }

        savedReport 167055047 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn DESCRIPTION (
                sequence: 3
            )

            displayColumn NAME (
                sequence: 1
            )

            displayColumn PRODUCTS (
                sequence: 2
            )

            displayColumn UPDATED (
                sequence: 4
            )

            displayColumn UPDATED_BY (
                sequence: 5
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Create Product Family
        layout {
            sequence: 20
            region: @product-families
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 113
                clearCache: 113
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @product-families
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: &APP_PAGE_ID.
                clearCache: [
                    RIR
                    &APP_PAGE_ID.
                ]
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction create-button-dialog-closed (
        name: Create Button - Dialog Closed
        execution {
            sequence: 20
        }
        when {
            event: apexafterclosedialog
            selectionType: button
            button: @create
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @product-families
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction edit-report-dialog-closed (
        name: Edit Report - Dialog Closed
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @product-families
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @product-families
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
