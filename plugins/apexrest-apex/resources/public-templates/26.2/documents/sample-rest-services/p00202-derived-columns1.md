# Derived Columns — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00202-derived-columns1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6f7d217b0e80b011deb3c097fdadd1da66c468e5c3c75244b051df795108765a.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 202 (
    name: Derived Columns
    alias: DERIVED-COLUMNS1
    title: Derived Columns
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
        browserCache: false
    }

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

    region derived-column-results (
        name: Derived Column Results
        type: interactiveReport
        source {
            location: restSource
            restSource: @eba_rest_employee_derived
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        pagination {
            type: rowRangesXToY
        }
        advanced {
            savedReportMappingIdentifier: 9487705586416950
        }

        column COMM (
            type: plainText
            heading {
                heading: Commission
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: D
            }
        )

        column DEPTNO (
            type: plainText
            heading {
                heading: Department
                alignment: end
            }
            layout {
                sequence: 70
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        column EMPNO (
            type: plainText
            heading {
                heading: Employee ID
                alignment: end
            }
            layout {
                sequence: 50
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: E
            }
        )

        column ENAME (
            type: plainText
            heading {
                heading: Employee
            }
            layout {
                sequence: 60
            }
            accessibility {
                valueIdentifiesRow: true
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: F
            }
        )

        column "Full Salary" (
            type: plainText
            heading {
                heading: Full Salary
                alignment: end
            }
            layout {
                sequence: 90
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: I
            }
        )

        column HIREDATE (
            type: plainText
            heading {
                heading: Hiredate
            }
            layout {
                sequence: 80
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: H
            }
        )

        column JOB (
            type: plainText
            heading {
                heading: Job
            }
            layout {
                sequence: 10
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: A
            }
        )

        column MGR (
            type: plainText
            heading {
                heading: Manager
                alignment: end
            }
            layout {
                sequence: 20
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: B
            }
        )

        column SAL (
            type: plainText
            heading {
                heading: Salary
                alignment: end
            }
            layout {
                sequence: 30
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: C
            }
        )

        page {
            borderWidth: 0.5
            borderColor: #666666
        }

        savedReport 107310 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn COMM (
                sequence: 7
            )

            displayColumn DEPTNO (
                sequence: 8
            )

            displayColumn EMPNO (
                sequence: 1
            )

            displayColumn ENAME (
                sequence: 2
            )

            displayColumn "Full Salary" (
                sequence: 9
            )

            displayColumn HIREDATE (
                sequence: 5
            )

            displayColumn JOB (
                sequence: 3
            )

            displayColumn MGR (
                sequence: 4
            )

            displayColumn SAL (
                sequence: 6
            )

            highlight ir-condition (
                condition {
                    column: "Full Salary"
                    operator: isNotNull
                }
                highlight {
                    type: cell
                }
                colors {
                    background: #fff5ce
                }
                execution {
                    sequence: 10
                }
            )

        )

    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                  This page shows how to use <em>derived columns</em> in the <strong>Data Profile</strong> of the REST Data Source to enrich the response from the REST service. Such derived columns are available to all components using the REST Data Source. Using <em>SQL expressions</em>, we use existing columns <strong>SAL</strong> and <strong>COMM</strong> to derive a new column <strong>Full Salary</strong> that doesn't exist in the original payload.
                </p>
                
                
                
                
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
    )

    button next (
        buttonName: Next
        label: Next
        layout {
            sequence: 20
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 300
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: Previous
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 201
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
