# Industry — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00027-industry.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ed8569cdb30206d6dd9c35d8e3a076a642f3330abf3daac7f3f78480e6272062.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 27 (
    name: Industry
    alias: INDUSTRY
    title: Industry
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
        helpText: No help is available for this page.
    }

    region industry (
        name: Industry
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                    industry_name,
                    created,
                    created_by,
                    updated,
                    updated_by,
                    (select count(*) from eba_cust_customers c where c.industry_id = i.id) customer_count
                from eba_cust_industries i
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
            savePublicReport: true
        }
        download {
            formats: [
                csv
                html
            ]
        }
        advanced {
            savedReportMappingIdentifier: 782421302975556684
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

        column CUSTOMER_COUNT (
            type: plainText
            heading {
                heading: Customer Count
                alignment: end
            }
            layout {
                sequence: 8
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: H
            }
        )

        column ID (
            type: plainText
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
        )

        column INDUSTRY_NAME (
            type: link
            heading {
                heading: Industry Name
            }
            layout {
                sequence: 3
            }
            link {
                target: {
                    page: 30
                    items: {
                        P30_ID: #ID#
                    }
                    clearCache: 30
                    action: resetPagination
                }
                linkText: #INDUSTRY_NAME#
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: C
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

        savedReport 7824232 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn CREATED (
                sequence: 2
            )

            displayColumn CREATED_BY (
                sequence: 3
            )

            displayColumn CUSTOMER_COUNT (
                sequence: 6
            )

            displayColumn INDUSTRY_NAME (
                sequence: 1
            )

            displayColumn UPDATED (
                sequence: 4
            )

            displayColumn UPDATED_BY (
                sequence: 5
            )

            sort (
                column: INDUSTRY_NAME
                sort {
                    sequence: 1
                }
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Add Industry
        layout {
            sequence: 50
            region: @industry
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
            icon: fa-chevron-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 30
                clearCache: 30
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 40
            region: @industry
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
                page: 27
                clearCache: [
                    27
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
                region: @industry
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
