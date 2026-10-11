# Application User Log — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00060-application-user-log.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7a84fe58572cde2f86d6749803fbd9c6f200ae5087b85139201b7c27ceaa07b0.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 60 (
    name: Application User Log
    alias: APPLICATION-USER-LOG
    title: Application User Log
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

    region application-user-log (
        name: Application User Log
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    id,
                    upper(username) username,
                    email_address,
                    activity,
                    details,
                    created,
                    created_by
                from eba_qpoll_user_log
                order by
                    2,3,6
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
            whenNoDataFound: No user log data found.
            whenMoreDataFound: The maximum row count for this report is #MAX_ROW_COUNT# rows.  Please apply a filter to reduce the number of records in your query.
        }
        actionsMenu {
            pivot: false
            subscription: false
        }
        download {
            formats: [
                csv
                html
            ]
        }
        heading {
            fixedTo: none
        }
        advanced {
            savedReportMappingIdentifier: 911920227304875888
        }

        column ACTIVITY (
            type: plainText
            heading {
                heading: Activity
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
            enableUsersTo {
                pivot: false
            }
        )

        column CREATED (
            type: plainText
            heading {
                heading: Created
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
            enableUsersTo {
                pivot: false
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
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
            enableUsersTo {
                pivot: false
            }
        )

        column DETAILS (
            type: plainText
            heading {
                heading: Details
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
            enableUsersTo {
                pivot: false
            }
        )

        column EMAIL_ADDRESS (
            type: plainText
            heading {
                heading: Email Address
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
            enableUsersTo {
                pivot: false
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

        column USERNAME (
            type: plainText
            heading {
                heading: Username
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
            enableUsersTo {
                pivot: false
            }
        )

        savedReport 9119251 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn ACTIVITY (
                sequence: 4
            )

            displayColumn CREATED (
                sequence: 6
            )

            displayColumn CREATED_BY (
                sequence: 7
            )

            displayColumn DETAILS (
                sequence: 5
            )

            displayColumn EMAIL_ADDRESS (
                sequence: 3
            )

            displayColumn ID (
                sequence: 1
            )

            displayColumn USERNAME (
                sequence: 2
            )

        )

    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @application-user-log
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
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

)


````
