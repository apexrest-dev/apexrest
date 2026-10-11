# LEAD and LAG — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00024-lead-and-lag.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 30e9f4361c087c67f29016d0f940d9b1767178c62214a0de49d7f1eee412af5b.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 24 (
    name: LEAD and LAG
    alias: LEAD-AND-LAG
    title: LEAD and LAG
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
            htmlCode: <p>The following query highlights LEAD and LAG functions.  Use LEAD function to return data from the next row.  Use LAG function to return data from a previous row.  Expand the <strong>SQL Source</strong> to see an example.</p>
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

    region lead-and-lag (
        name: LEAD and LAG
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                SELECT ename,
                       sal,
                       LEAD(sal, 1, 0) OVER (ORDER BY sal DESC NULLS LAST) next_lower_sal,
                       LAG(sal, 1, 0) OVER (ORDER BY sal DESC NULLS LAST) prev_higher_sal
                FROM eba_demo_ir_emp
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
            savedReportMappingIdentifier: 657302113463829841
        }

        column ENAME (
            type: plainText
            heading {
                heading: Employee
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

        column NEXT_LOWER_SAL (
            type: plainText
            heading {
                heading: Next Lower Salary
                alignment: end
            }
            layout {
                sequence: 4
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: D
            }
        )

        column PREV_HIGHER_SAL (
            type: plainText
            heading {
                heading: Prev Higher Salary
                alignment: end
            }
            layout {
                sequence: 5
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: E
            }
        )

        column SAL (
            type: plainText
            heading {
                heading: Salary
                alignment: end
            }
            layout {
                sequence: 3
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: C
            }
        )

        savedReport 6573032 (
            visibility: primaryDefault
            view {
                rowsPerPage: 5
            }

            displayColumn ENAME (
                sequence: 1
            )

            displayColumn NEXT_LOWER_SAL (
                sequence: 3
            )

            displayColumn PREV_HIGHER_SAL (
                sequence: 4
            )

            displayColumn SAL (
                sequence: 2
            )

            sort (
                column: SAL
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
            startNewRow: false
            newColumn: false
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
            region: @lead-and-lag
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
                page: 24
                clearCache: [
                    24
                    RIR
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
