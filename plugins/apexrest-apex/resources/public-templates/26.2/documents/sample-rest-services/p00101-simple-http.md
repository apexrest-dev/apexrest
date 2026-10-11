# Simple HTTP — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00101-simple-http.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b8c728fcdf83006183469ee6ea0db7f8fd2545a2d4121be9a70cf012acf93b1b.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 101 (
    name: Simple HTTP
    alias: SIMPLE-HTTP
    title: Simple HTTP
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

    region employees-data (
        name: Employees Data
        type: interactiveReport
        source {
            location: restSource
            restSource: @Employee_ords_rest_source
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
            savedReportMappingIdentifier: 16490685974484306
        }

        column COMM (
            type: plainText
            heading {
                heading: Commission
                alignment: end
            }
            layout {
                sequence: 60
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: E
            }
        )

        column DEPTNO (
            type: plainText
            heading {
                heading: Department Number
                alignment: end
            }
            layout {
                sequence: 100
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: I
            }
        )

        column EMPNO (
            type: hidden
            heading {
                heading: Empno
            }
            layout {
                sequence: 10
            }
            source {
                dataType: number
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
                sequence: 20
            }
            accessibility {
                valueIdentifiesRow: true
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: G
            }
        )

        column HIREDATE (
            type: plainText
            heading {
                heading: Hire Date
            }
            layout {
                sequence: 90
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: J
            }
        )

        column JOB (
            type: plainText
            heading {
                heading: Job
            }
            layout {
                sequence: 30
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column MGR (
            type: plainText
            heading {
                heading: Manager
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
                endUserAlias: C
            }
        )

        column SAL (
            type: plainText
            heading {
                heading: Salary
                alignment: end
            }
            layout {
                sequence: 50
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

        page {
            borderWidth: 0.5
            borderColor: #666666
        }

        savedReport 22760 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn COMM (
                sequence: 6
            )

            displayColumn DEPTNO (
                sequence: 7
            )

            displayColumn ENAME (
                sequence: 1
            )

            displayColumn HIREDATE (
                sequence: 4
            )

            displayColumn JOB (
                sequence: 2
            )

            displayColumn MGR (
                sequence: 5
            )

            displayColumn SAL (
                sequence: 3
            )

        )

        parameter (
            name: @query
            value {
                type: null
            }
        )

    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                
                  <p>
                    This page demonstrates the <strong>Simple HTTP</strong> REST Data Source type in Oracle APEX. It consumes data
                    from the REST Data Source named <strong>EBA_REST_DATA_EMPLOYEE</strong>, fetching the entire dataset in a single
                    request with no server side filtering.
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
                page: 102
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: previous
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 100
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
