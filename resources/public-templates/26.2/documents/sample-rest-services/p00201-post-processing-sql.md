# Post Processing SQL — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00201-post-processing-sql.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0ba37e513da4f831c684f3d9c95c36e3b90086916055b820c2112f2062b4556d.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 201 (
    name: Post Processing SQL
    alias: POST-PROCESSING-SQL
    title: Post Processing SQL
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
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

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This page uses the <strong>Post Processing SQL</strong> to combine data from the <strong>EBA_REST_DEPARTMENT</strong> REST Data Source with data from the local <strong>EBA_DEMO_REST_EMPLOYEECUSTOM</strong> table.</p>
                
                
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

    region post-processing-sql-query (
        name: Post Processing SQL Query
        type: staticContent
        source {
            htmlCode:
                ```html
                <pre><code>
                    select n.empno,
                           n.emp_name          as ename,
                           n.role_desc         as emp_role,  
                           n.hourly_rate       as hourly_rate,  
                           n.bonus_eligibility as bonus,
                           n.deptno,
                           dept.dname          as dname,
                           dept.loc            as loc
                      from #APEX$SOURCE_DATA#           dept
                      join eba_demo_rest_employeecustom n
                        on n.deptno = dept.deptno
                
                </code></pre>
                
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-expanded
                t-Region--scrollBody
            ]
        }
    )

    region post-processing-sql-results (
        name: Post Processing SQL Results
        type: interactiveReport
        source {
            location: restSource
            restSource: @eba_rest_department
        }
        localPostProcessing {
            type: sqlQuery
            sqlQuery:
                ```sql
                select n.empno,
                       n.emp_name          as ename,
                       n.role_desc         as empRole,  
                       n.hourly_rate       as hourlyRate,  
                       n.bonus_eligibility as Bonus,
                       n.deptno,
                       dept.dname          as dname,
                       dept.loc            as loc
                  from #APEX$SOURCE_DATA# dept
                  join eba_demo_rest_employeecustom  n
                    on n.deptno = dept.deptno
                ```
        }
        layout {
            sequence: 30
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
            savedReportMappingIdentifier: 9486652586416939
        }

        column BONUS (
            type: plainText
            heading {
                heading: Bonus
            }
            layout {
                sequence: 80
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: H
            }
        )

        column DEPTNO (
            type: hidden
            heading {
                heading: Deptno
            }
            layout {
                sequence: 10
            }
            source {
                primaryKey: true
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
        )

        column DNAME (
            type: plainText
            heading {
                heading: Department
            }
            layout {
                sequence: 90
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column EMPNO (
            type: plainText
            heading {
                heading: Employee ID
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: D
            }
        )

        column EMPROLE (
            type: plainText
            heading {
                heading: Role
            }
            layout {
                sequence: 60
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: F
            }
        )

        column ENAME (
            type: plainText
            heading {
                heading: Employee
            }
            layout {
                sequence: 50
            }
            accessibility {
                valueIdentifiesRow: true
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: E
            }
        )

        column HOURLYRATE (
            type: plainText
            heading {
                heading: Hourly Rate
                alignment: end
            }
            layout {
                sequence: 70
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        column LOC (
            type: plainText
            heading {
                heading: Location
            }
            layout {
                sequence: 100
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: C
            }
        )

        page {
            borderWidth: 0.5
            borderColor: #666666
        }

        savedReport 107064 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn BONUS (
                sequence: 5
            )

            displayColumn DNAME (
                sequence: 6
            )

            displayColumn EMPNO (
                sequence: 1
            )

            displayColumn EMPROLE (
                sequence: 3
            )

            displayColumn ENAME (
                sequence: 2
            )

            displayColumn HOURLYRATE (
                sequence: 4
            )

            displayColumn LOC (
                sequence: 7
            )

            highlight ir-condition (
                condition {
                    column: DNAME
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

            highlight ir-condition-2 (
                condition {
                    column: LOC
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

    button next (
        buttonName: NEXT
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
                page: 202
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
                page: 200
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
