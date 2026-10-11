# Categories — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00003-categories.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b64b4ca71f5ae049fb9fca09b9617a6cba28124a3f68257f4f73c91aa0ffc83a.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3 (
    name: Categories
    alias: CATEGORIES
    title: Categories
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
        cursorFocus: firstItemOnPage
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
        helpText: &CATEGORY_HELP.
    }

    region categories (
        name: Categories
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                    category,
                    description,
                    decode(is_active,'Y',:ACTIVE_MSG,:INACTIVE_MSG) status
                from eba_cust_categories
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--noBorders
            ]
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 10000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results.
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
            savedReportMappingIdentifier: 3741421224251032723
        }

        column CATEGORY (
            type: link
            heading {
                heading: Category
            }
            layout {
                sequence: 2
            }
            link {
                target: {
                    page: 4
                    items: {
                        P4_ID: #ID#
                    }
                    clearCache: 4
                    action: resetPagination
                }
                linkText: #CATEGORY#
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
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
                heading: Edit
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

        column STATUS (
            type: plainText
            heading {
                heading: Status
            }
            layout {
                sequence: 4
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: D
            }
        )

        savedReport 9136221 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn CATEGORY (
                sequence: 2
            )

            displayColumn DESCRIPTION (
                sequence: 3
            )

            displayColumn ID (
                sequence: 1
            )

            displayColumn STATUS (
                sequence: 4
            )

            sort (
                column: CATEGORY
                sort {
                    sequence: 1
                }
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Add Category
        layout {
            sequence: 20
            region: @categories
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
                page: 4
                clearCache: 4
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @categories
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
                page: 3
                clearCache: [
                    3
                    RIR
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction refresh-report (
        name: Refresh Report
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: jsExpression
            javaScriptExpression: window
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode: apex.message.showPageSuccess('Action Processed.');
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @categories
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
