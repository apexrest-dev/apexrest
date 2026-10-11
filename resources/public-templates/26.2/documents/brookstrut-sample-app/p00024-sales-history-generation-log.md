# Sales History Generation Log — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00024-sales-history-generation-log.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 99650d41fc59f7d4f854e5ccff9cb694894846a1eb9b78b1e4517d997536f64b.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 24 (
    name: Sales History Generation Log
    alias: SALES-HISTORY-GENERATION-LOG
    title: Sales History Generation Log
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
            sequence: 30
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

    region sales-history-generation-log (
        name: Sales History Generation Log
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                    owner,
                    num_days,
                    max_orders,
                    start_time,
                    end_time,
                    (extract(DAY FROM end_time-start_time)*24*60*60)+ 
                        (extract(HOUR FROM end_time-start_time)*60*60)+
                        (extract(MINUTE FROM end_time-start_time)*60)+
                        extract(SECOND FROM end_time-start_time) duration
                from oow_demo_hist_gen_log
                ```
        }
        layout {
            sequence: 10
            slot: body-3
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
            savedReportMappingIdentifier: 2713031204256408091
        }

        column DURATION (
            type: plainText
            heading {
                heading: Duration (sec)
                alignment: center
            }
            layout {
                sequence: 8
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        column END_TIME (
            type: plainText
            heading {
                heading: End Time
                alignment: center
            }
            layout {
                sequence: 7
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

        column ID (
            type: hidden
            heading {
                heading: ID
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

        column MAX_ORDERS (
            type: plainText
            heading {
                heading: Max Orders
                alignment: center
            }
            layout {
                sequence: 5
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: D
            }
        )

        column NUM_DAYS (
            type: plainText
            heading {
                heading: Num Days
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
                endUserAlias: C
            }
        )

        column OWNER (
            type: plainText
            heading {
                heading: Owner
                alignment: center
            }
            layout {
                sequence: 3
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column START_TIME (
            type: plainText
            heading {
                heading: Start Time
                alignment: center
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
                endUserAlias: E
            }
        )

        savedReport 27130322 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn DURATION (
                sequence: 6
            )

            displayColumn END_TIME (
                sequence: 5
            )

            displayColumn MAX_ORDERS (
                sequence: 3
            )

            displayColumn NUM_DAYS (
                sequence: 2
            )

            displayColumn OWNER (
                sequence: 1
            )

            displayColumn START_TIME (
                sequence: 4
            )

            sort (
                column: START_TIME
                sort {
                    direction: desc
                    sequence: 1
                }
            )

        )

    )

)


````
