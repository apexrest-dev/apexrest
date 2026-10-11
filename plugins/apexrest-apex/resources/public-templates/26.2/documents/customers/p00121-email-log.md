# Email Log — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00121-email-log.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fca69ce57fd574289bcc42ef114b3c7597b46a09c5968fce24f8abf8148dc8e5.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 121 (
    name: Email Log
    alias: EMAIL-LOG
    title: Email Log
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
        helpText: <p>Use this Interactive Report to view the log of emails sent from this application. Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.</p>
    }
    config {
        buildOption: @feedback
    }

    region status-update-requests (
        name: Status Update Requests
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select email_from, email_to, email_first_to, 
                    body_size, created, initcap(replace(email_type,'_',' ')) as email_type
                from eba_cust_email_log
                where created is not null
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
            whenNoDataFound: No sent emails found.
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
            savedReportMappingIdentifier: 17678314000680038760
        }

        column BODY_SIZE (
            type: plainText
            heading {
                heading: Message Length (bytes)
                alignment: end
            }
            layout {
                sequence: 18
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: L
            }
        )

        column CREATED (
            type: plainText
            heading {
                heading: Update Request
            }
            layout {
                sequence: 8
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: H
            }
        )

        column EMAIL_FIRST_TO (
            type: plainText
            heading {
                heading: To
            }
            layout {
                sequence: 6
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: F
            }
        )

        column EMAIL_FROM (
            type: plainText
            heading {
                heading: Email From
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

        column EMAIL_TO (
            type: plainText
            heading {
                heading: Full Email To List
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

        column EMAIL_TYPE (
            type: plainText
            heading {
                heading: Email Type
            }
            layout {
                sequence: 28
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: M
            }
        )

        savedReport 176783166 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn BODY_SIZE (
                sequence: 2
            )

            displayColumn CREATED (
                sequence: 3
            )

            displayColumn EMAIL_FIRST_TO (
                sequence: 1
            )

            displayColumn EMAIL_TYPE (
                sequence: 4
            )

            sort (
                column: CREATED
                sort {
                    direction: desc
                    sequence: 1
                }
            )

        )

    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @status-update-requests
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
                page: 121
                clearCache: [
                    56
                    RIR
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
