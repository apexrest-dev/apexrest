# Customer Statuses — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00102-customer-statuses.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 946aa177ee2e7ef53e6f03fc5abff95ef9885d2d0556a0fec799cfb8c2939d2e.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 102 (
    name: Customer Statuses
    alias: CUSTOMER-STATUSES
    title: Customer Statuses
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
        helpText: &CUSTOMER_STATUS_HELP.
    }
    config {
        buildOption: @customer-status
    }

    region customer-statuses (
        name: Customer Statuses
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    s.id,
                    s.status as customer_status,
                    s.description,
                    decode(s.is_active,'Y',:ACTIVE_MSG,:INACTIVE_MSG) Status,
                    s.updated,
                    s.created,
                    s.updated_by,
                    s.created_by,
                    (select count(*) from eba_cust_customers c where c.status_id = s.id) customer_count
                from
                    eba_cust_status s
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
            whenNoDataFound: No status codes found.
            whenMoreDataFound: This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results.
        }
        actionsMenu {
            savePublicReport: true
        }
        download {
            formats: [
                csv
                html
                pdf
            ]
        }
        advanced {
            savedReportMappingIdentifier: 15944583750506755788
        }

        column CREATED (
            type: plainText
            heading {
                heading: Created
            }
            layout {
                sequence: 25
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: G
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created by
            }
            layout {
                sequence: 45
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: I
            }
        )

        column CUSTOMER_COUNT (
            type: link
            heading {
                heading: Customer Count
                alignment: end
            }
            layout {
                sequence: 55
                columnAlignment: end
            }
            link {
                target: {
                    page: 59
                    items: {
                        P59_STATUS: #ID#
                    }
                    clearCache: 59
                    action: resetPagination
                }
                linkText: #CUSTOMER_COUNT#
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: J
            }
        )

        column CUSTOMER_STATUS (
            type: link
            heading {
                heading: Customer Status
            }
            layout {
                sequence: 3
            }
            link {
                target: {
                    page: 103
                    items: {
                        P103_ID: #ID#
                    }
                    clearCache: 103
                    action: resetPagination
                }
                linkText: #CUSTOMER_STATUS#
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
                sequence: 4
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
                sequence: 5
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: D
            }
        )

        column UPDATED (
            type: plainText
            heading {
                heading: Updated
            }
            layout {
                sequence: 15
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
                heading: Updated by
            }
            layout {
                sequence: 35
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: H
            }
        )

        page {
            borderWidth: 0.5
            borderColor: #666666
        }

        savedReport 159445875 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn CUSTOMER_COUNT (
                sequence: 4
            )

            displayColumn CUSTOMER_STATUS (
                sequence: 1
            )

            displayColumn DESCRIPTION (
                sequence: 2
            )

            displayColumn STATUS (
                sequence: 3
            )

            sort (
                column: CUSTOMER_STATUS
                sort {
                    sequence: 1
                }
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Add Status Code
        layout {
            sequence: 20
            region: @customer-statuses
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
                page: 103
                clearCache: 103
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @customer-statuses
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
                page: 102
                clearCache: [
                    5
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
                region: @customer-statuses
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
