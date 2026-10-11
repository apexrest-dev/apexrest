# Page View Activity — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00045-page-view-activity.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7bfd5befbc9d1ddaabcfae660d165f49703eba3613459b1e8930670b42d415c5.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 45 (
    name: Page View Activity
    alias: PAGE-VIEW-ACTIVITY
    title: Page View Activity
    pageGroup: @reports
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region activity (
        name: Activity
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                lower(USERID)      User_id,
                step_id            Page,
                step_id||'. '||(select page_name from apex_application_pages p where p.page_id = l.step_id and p.application_id = :app_id) page_name,
                COMPONENT_NAME,
                TIME_STAMP  timestamp,
                ELAP        Elapsed,
                NUM_ROWS,
                IR_SEARCH,
                SQLERRM     Error,
                PAGE_MODE,
                CONTENT_LENGTH PgSize
                from apex_activity_log l
                where flow_id = :app_id
                and   userid is not null
                order by time_stamp desc
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
            savedReportMappingIdentifier: 3739949924181598519
        }

        column COMPONENT_NAME (
            type: plainText
            heading {
                heading: Component
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

        column ELAPSED (
            type: plainText
            heading {
                heading: Elapsed
                alignment: end
            }
            layout {
                sequence: 8
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990D9999
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: H
            }
        )

        column ERROR (
            type: plainText
            heading {
                heading: Error
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

        column IR_SEARCH (
            type: plainText
            heading {
                heading: IR Search
            }
            layout {
                sequence: 10
            }
            appearance {
                formatMask: 999G999G999G999G999G990
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: J
            }
        )

        column NUM_ROWS (
            type: plainText
            heading {
                heading: Num Rows
                alignment: end
            }
            layout {
                sequence: 9
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: I
            }
        )

        column PAGE (
            type: plainText
            heading {
                heading: Page
                alignment: end
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

        column PAGE_MODE (
            type: plainText
            heading {
                heading: Page Mode
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

        column PAGE_NAME (
            type: plainText
            heading {
                heading: Page Name
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

        column PGSIZE (
            type: plainText
            heading {
                heading: Pgsize
                alignment: end
            }
            layout {
                sequence: 13
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: M
            }
        )

        column TIMESTAMP (
            type: plainText
            heading {
                heading: Timestamp
            }
            layout {
                sequence: 7
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: G
            }
        )

        column USER_ID (
            type: plainText
            heading {
                heading: User Id
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

        savedReport 9121512 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn ELAPSED (
                sequence: 4
            )

            displayColumn ERROR (
                sequence: 7
            )

            displayColumn IR_SEARCH (
                sequence: 6
            )

            displayColumn NUM_ROWS (
                sequence: 5
            )

            displayColumn PAGE_NAME (
                sequence: 1
            )

            displayColumn TIMESTAMP (
                sequence: 3
            )

            displayColumn USER_ID (
                sequence: 2
            )

            sort (
                column: TIMESTAMP
                sort {
                    direction: desc
                    sequence: 1
                }
            )

            sort (
                column: "View"
                sort {
                    direction: desc
                    sequence: 2
                }
            )

        )

    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb-2
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

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @activity
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
                page: 45
                clearCache: RIR
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
