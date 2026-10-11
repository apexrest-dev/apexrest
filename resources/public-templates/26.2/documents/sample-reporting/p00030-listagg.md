# LISTAGG — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00030-listagg.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d8b7a932ff9d3b04a8791fd8f31ed33b569ee340c59eb83c88a4101cc3278b1a.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 30 (
    name: LISTAGG
    alias: LISTAGG
    title: LISTAGG
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
            htmlCode: <p>This report highlights the use of the LISTAGG function.  Use LISTAGG to order data within each group specified in the ORDER BY clause and then concatenate the values of the column in a comma delimited list.  Expand the <strong>SQL Source</strong> to see an example.</p>
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

    region listagg-query-syntax (
        name: LISTAGG Query Syntax
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select d.dname department,
                       listagg(e.ename, ', ') within group (order by e.ename) dept_employee_list
                from eba_demo_ir_emp e,
                     eba_demo_ir_dept d
                where d.deptno = e.deptno
                group by d.DNAME
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
            savedReportMappingIdentifier: 657475710968115455
        }

        column DEPARTMENT (
            type: plainText
            heading {
                heading: Department
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

        column DEPT_EMPLOYEE_LIST (
            type: plainText
            heading {
                heading: Employee List
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

        savedReport 6574764 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn DEPARTMENT (
                sequence: 1
            )

            displayColumn DEPT_EMPLOYEE_LIST (
                sequence: 2
            )

            sort (
                column: PROJECT
                sort {
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
            regionStaticId: QUERY
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @listagg-query-syntax
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
                page: 30
                clearCache: [
                    30
                    RIR
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
