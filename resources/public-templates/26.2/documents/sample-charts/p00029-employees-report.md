# Employees  Report — Sample Charts

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-charts/apexlang/sample-charts/pages/p00029-employees-report.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2d5cd53c4e542808b0a137e4fd5ca2e895ea99723e19986d052c0650abced81b.

Application dependency inventory: oracle:26.2:public-template/sample-charts/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 29 (
    name: Employees  Report
    alias: EMPLOYEES-REPORT
    title: Employees  Report
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: "<p>This Interactive Grid page demonstrates linking from charts.  You can link your chart to an Interactive Grid saved report by firstly identifying the saved report by setting the REQUEST to <strong>IG[<i>RegionStaticId</i>]_<i>SavedReportName</i></strong>, secondly clearing any existing Interactive Grid filters using the \"Clear Report\" <strong>CR</strong> clear cache setting in the URL, and lastly by passing Interactive Grid column <strong>IG_</strong> filters.  See the chart pages for details on how to construct the links, and view the URL on this page to see the format of the URL.  The drill down from the chart to this report passes the DEPTNO column.  The <strong>CS</strong> attribute in the URL is a checksum that limits exposure to URL tampering and is automatically computed by the Oracle APEX engine.</p>"
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--customIcons
                t-Alert--info
            ]
            icon: fa-layout-grid-3x
        }
    )

    region breadcrumb (
        name: breadcrumb
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

    region employees-report (
        name: Employees  Report
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select * 
                 from eba_demo_chart_emp
                --where deptno = :P29_DEPTNO
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: emp
        }
        componentAppearance {
            showNullValuesAs: -
        }
        toolbar {
            controls: [
                searchCol
                searchField
                actionsMenu
                resetButton
                saveButton
            ]
        }
        download {
            formats: [
                csv
                html
            ]
        }
        advanced {
            savedReportMappingIdentifier: 2285364155900822620
        }

        savedReport 14237 (
            visibility: primary
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }

            displayColumn (
                column: @EMPNO
                layout {
                    sequence: 2
                }
            )

            displayColumn (
                column: @ENAME
                layout {
                    sequence: 3
                }
            )

            displayColumn (
                column: @JOB
                layout {
                    sequence: 4
                }
            )

            displayColumn (
                column: @MGR
                layout {
                    sequence: 5
                }
            )

            displayColumn (
                column: @HIREDATE
                layout {
                    sequence: 6
                }
            )

            displayColumn (
                column: @SAL
                layout {
                    sequence: 7
                }
            )

            displayColumn (
                column: @COMM
                layout {
                    sequence: 8
                }
            )

            displayColumn (
                column: @DEPTNO
                layout {
                    sequence: 9
                }
            )

        )

        savedReport emp_details (
            visibility: alternative
            name: emp_details
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }

            displayColumn (
                column: @EMPNO
                layout {
                    sequence: 2
                }
            )

            displayColumn (
                column: @ENAME
                layout {
                    sequence: 3
                }
            )

            displayColumn (
                column: @JOB
                layout {
                    sequence: 4
                }
            )

            displayColumn (
                column: @MGR
                layout {
                    show: false
                    sequence: 4
                }
            )

            displayColumn (
                column: @HIREDATE
                layout {
                    sequence: 6
                }
            )

            displayColumn (
                column: @SAL
                layout {
                    sequence: 7
                }
            )

            displayColumn (
                column: @COMM
                layout {
                    sequence: 8
                }
            )

            displayColumn (
                column: @DEPTNO
                layout {
                    sequence: 9
                }
            )

        )

        column COMM (
            type: numberField
            heading {
                heading: Commission
                alignment: end
            }
            settings {
                numberAlignment: end
                virtualKeyboard: text
            }
            layout {
                sequence: 80
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                databaseColumn: COMM
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column DEPTNO (
            type: numberField
            heading {
                heading: Department
                alignment: end
            }
            settings {
                numberAlignment: end
                virtualKeyboard: text
            }
            layout {
                sequence: 90
                columnAlignment: end
            }
            source {
                databaseColumn: DEPTNO
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column EMPNO (
            type: numberField
            heading {
                heading: Employee No.
                alignment: end
            }
            settings {
                numberAlignment: end
                virtualKeyboard: text
            }
            layout {
                sequence: 20
                columnAlignment: end
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: EMPNO
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column ENAME (
            type: textField
            heading {
                heading: Name
            }
            layout {
                sequence: 30
            }
            validation {
                maxLength: 10
            }
            source {
                databaseColumn: ENAME
                dataType: varchar2
            }
            columnFilter {
                performanceImpactingOperators: [
                    contains
                    startsWith
                    caseInsensitive
                    regexp
                ]
            }
        )

        column HIREDATE (
            type: datePickerJquery
            heading {
                heading: Hire Date
                alignment: center
            }
            layout {
                sequence: 60
                columnAlignment: center
            }
            source {
                databaseColumn: HIREDATE
                dataType: date
            }
        )

        column JOB (
            type: textField
            heading {
                heading: Job
            }
            layout {
                sequence: 40
            }
            validation {
                maxLength: 9
            }
            source {
                databaseColumn: JOB
                dataType: varchar2
            }
            columnFilter {
                performanceImpactingOperators: [
                    contains
                    startsWith
                    caseInsensitive
                    regexp
                ]
            }
        )

        column MGR (
            type: numberField
            heading {
                heading: Manager
                alignment: end
            }
            settings {
                numberAlignment: end
                virtualKeyboard: text
            }
            layout {
                sequence: 50
                columnAlignment: end
            }
            source {
                databaseColumn: MGR
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column SAL (
            type: numberField
            heading {
                heading: Salary
                alignment: end
            }
            settings {
                numberAlignment: end
                virtualKeyboard: text
            }
            layout {
                sequence: 70
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                databaseColumn: SAL
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

    )

    pageItem P29_DEPTNO (
        type: hidden
        layout {
            sequence: 10
            region: @employees-report
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
