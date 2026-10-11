# Top N Queries — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00020-top-n-queries.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 78092e7d38b0f83fdaf3ee01c50a7d8ff009f379660c2182b634dccb8f8051a4.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 20 (
    name: Top N Queries
    alias: TOP-N-QUERIES
    title: Top N Queries
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

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>The following use cases highlights how to perform a TOP N query using Oracle Database 11g.  It uses an inline view with where clause to limit <strong>ROWNUM</strong> <= 10.  Expand the <strong>SQL Source</strong> to see an example.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 40
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

    region container (
        name: Container
        type: staticContent
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region query (
        name: Query
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select * 
                from (
                select	
                       PROJECT,
                       TASK_NAME,
                       START_DATE,
                       END_DATE,
                       STATUS,
                       ASSIGNED_TO,
                       COST,
                       BUDGET
                from EBA_DEMO_IR_PROJECTS
                order by budget desc, project, task_name
                ) x
                where rownum <= 10
                ```
        }
        layout {
            sequence: 10
            parentRegion: @container
            slot: subRegions
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--noBorders
            ]
        }
        advanced {
            htmlDomId: topn_report
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
            savedReportMappingIdentifier: 657287007766727343
        }

        column ASSIGNED_TO (
            type: plainText
            heading {
                heading: Assigned To
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

        column BUDGET (
            type: plainText
            heading {
                heading: Budget
                alignment: end
            }
            layout {
                sequence: 8
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: H
            }
        )

        column COST (
            type: plainText
            heading {
                heading: Cost
                alignment: end
            }
            layout {
                sequence: 7
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        column END_DATE (
            type: plainText
            heading {
                heading: End Date
            }
            layout {
                sequence: 4
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: D
            }
        )

        column PROJECT (
            type: plainText
            heading {
                heading: Project
            }
            layout {
                sequence: 1
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: A
            }
        )

        column START_DATE (
            type: plainText
            heading {
                heading: Start Date
            }
            layout {
                sequence: 3
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: C
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
                endUserAlias: E
            }
        )

        column TASK_NAME (
            type: plainText
            heading {
                heading: Task Name
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

        savedReport 6572881 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn ASSIGNED_TO (
                sequence: 6
            )

            displayColumn BUDGET (
                sequence: 8
            )

            displayColumn COST (
                sequence: 7
            )

            displayColumn END_DATE (
                sequence: 4
            )

            displayColumn PROJECT (
                sequence: 1
            )

            displayColumn START_DATE (
                sequence: 3
            )

            displayColumn STATUS (
                sequence: 5
            )

            displayColumn TASK_NAME (
                sequence: 2
            )

            sort (
                column: BUDGET
                sort {
                    direction: desc
                    sequence: 1
                }
            )

        )

    )

    region sql-source (
        name: SQL Source
        type: plugin/sourceDisplay
        layout {
            sequence: 20
            parentRegion: @container
            slot: subRegions
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--noBorder
                t-Region--scrollBody
            ]
        }
        settings {
            regionStaticId: topn_report
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @query
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
                page: 20
                clearCache: [
                    20
                    RIR
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
