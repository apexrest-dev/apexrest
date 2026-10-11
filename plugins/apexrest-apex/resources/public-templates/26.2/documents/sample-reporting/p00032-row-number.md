# ROW_NUMBER — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00032-row-number.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 16c4a254dd6b1ad8129794f4be256d9128eaea751e15050535863cc66c595d00.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 32 (
    name: ROW_NUMBER
    alias: ROW-NUMBER
    title: ROW_NUMBER
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
            htmlCode: <p>The following query highlights ROW_NUMBER function to assign an unique number to a partition of records. This is very useful in reporting, especially in places where different partitions have their own unique numbers.  Expand the <strong>SQL Source</strong> to see an example.</p>
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
            sequence: 10
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

    region row-number (
        name: ROW_NUMBER
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                SELECT e.ename,
                       d.dname,
                       e.hiredate,
                       ROW_NUMBER( ) OVER (PARTITION BY d.deptno ORDER BY e.hiredate NULLS LAST) hiredate_rank_order
                FROM eba_demo_ir_emp e, eba_demo_ir_dept d
                WHERE e.deptno = d.deptno
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
            htmlDomId: QUERY
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
            savedReportMappingIdentifier: 657518030986356851
        }

        column DNAME (
            type: plainText
            heading {
                heading: Dname
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

        column ENAME (
            type: plainText
            heading {
                heading: Employee
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

        column HIREDATE (
            type: plainText
            heading {
                heading: Hiredate
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

        column HIREDATE_RANK_ORDER (
            type: plainText
            heading {
                heading: Hiredate Rank Order
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

        savedReport 6575191 (
            visibility: primaryDefault
            view {
                rowsPerPage: 5
            }

            displayColumn DNAME (
                sequence: 2
            )

            displayColumn ENAME (
                sequence: 1
            )

            displayColumn HIREDATE (
                sequence: 3
            )

            displayColumn HIREDATE_RANK_ORDER (
                sequence: 4
            )

            sort (
                column: DNAME
                sort {
                    sequence: 1
                }
            )

            sort (
                column: HIREDATE_RANK_ORDER
                sort {
                    sequence: 2
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
            regionStaticId: QUERY
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @row-number
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
                page: 32
                clearCache: [
                    32
                    RIR
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
