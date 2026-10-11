# Event Log — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00021-event-log.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a239a325ce40c57c392e5f9cbe0319574f5e32b7ed7103a698f7bbf024140187.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 21 (
    name: Event Log
    alias: EVENT-LOG
    title: Event Log
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: rw-pillar--sienna
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

    region event-log (
        name: Event Log
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    ID,
                    LOG_SEQ,
                    EVENT_TYPE,
                    EVENT_NAME,
                    EVENT_DETAIL,
                    ERROR_MESSAGE,
                    CREATED_BY,
                    CREATED_ON,
                    CREATED_ON time_since,
                    A1,
                    A2,
                    dbms_lob.substr(error_trace,4000,1) trace,
                    dbms_lob.substr(error_trace,4000,4001) trace2
                from OOW_DEMO_EVENT_LOG
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
            savedReportMappingIdentifier: 2730827907869246318
        }

        column A1 (
            type: plainText
            heading {
                heading: A1
                alignment: center
            }
            layout {
                sequence: 9
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: I
            }
        )

        column A2 (
            type: plainText
            heading {
                heading: A2
                alignment: center
            }
            layout {
                sequence: 10
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: J
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
                alignment: center
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

        column CREATED_ON (
            type: plainText
            heading {
                heading: Created On
                alignment: center
            }
            layout {
                sequence: 8
            }
            appearance {
                formatMask: DD-MON-YYYY HH24.MI.SSXFF
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: H
            }
        )

        column ERROR_MESSAGE (
            type: plainText
            heading {
                heading: Error Message
                alignment: center
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

        column EVENT_DETAIL (
            type: plainText
            heading {
                heading: Event Detail
                alignment: center
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

        column EVENT_NAME (
            type: plainText
            heading {
                heading: Event Name
                alignment: center
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

        column EVENT_TYPE (
            type: plainText
            heading {
                heading: Event Type
                alignment: center
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
            type: plainText
            heading {
                heading: ID
                alignment: center
            }
            layout {
                sequence: 1
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
        )

        column LOG_SEQ (
            type: plainText
            heading {
                heading: Log Seq
                alignment: center
            }
            layout {
                sequence: 2
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: B
            }
        )

        column TIME_SINCE (
            type: plainText
            heading {
                heading: Time
                alignment: center
            }
            layout {
                sequence: 13
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: M
            }
        )

        column TRACE (
            type: plainText
            heading {
                heading: Trace
                alignment: center
            }
            layout {
                sequence: 11
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: K
            }
        )

        column TRACE2 (
            type: plainText
            heading {
                heading: Trace2
                alignment: center
            }
            layout {
                sequence: 12
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: L
            }
        )

        savedReport 27308292 (
            visibility: primaryDefault
            view {
                rowsPerPage: 100
            }

            displayColumn CREATED_BY (
                sequence: 6
            )

            displayColumn CREATED_ON (
                sequence: 7
            )

            displayColumn ERROR_MESSAGE (
                sequence: 5
            )

            displayColumn EVENT_DETAIL (
                sequence: 4
            )

            displayColumn EVENT_NAME (
                sequence: 3
            )

            displayColumn EVENT_TYPE (
                sequence: 2
            )

            displayColumn LOG_SEQ (
                sequence: 1
            )

            displayColumn TIME_SINCE (
                sequence: 8
            )

            sort (
                column: TIME_SINCE
                sort {
                    direction: desc
                    sequence: 1
                }
            )

            sort (
                column: LOG_SEQ
                sort {
                    direction: desc
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
                page: 4
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
