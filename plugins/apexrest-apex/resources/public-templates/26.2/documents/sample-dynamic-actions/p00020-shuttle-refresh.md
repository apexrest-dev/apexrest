# Shuttle Refresh — Sample Dynamic Actions

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-dynamic-actions/apexlang/sample-dynamic-actions/pages/p00020-shuttle-refresh.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e4bb34aed8a0106382bbaab9f1efb2171a693e6038df2f04c48af0661c4b2509.

Application dependency inventory: oracle:26.2:public-template/sample-dynamic-actions/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 20 (
    name: Shuttle Refresh
    alias: SHUTTLE-REFRESH
    title: Shuttle Refresh
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    htmlHeader {
        htmlHeader:
            ```html
            <style>
            .shuttleSelect1 select, .shuttleSelect2 select {
            width: 300px;
            height: 200px;
            }
            table.formlayout table.shuttle td {
            vertical-align: middle;
            }
            </style>
            ```
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region employees (
        name: Employees
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                SELECT e.ROWID
                ,      e.EMPNO
                ,      e.ENAME
                ,      e.JOB
                ,      m.ename MGR
                ,      e.HIREDATE
                ,      e.SAL
                ,      e.COMM
                ,      d.dname DEPTNO
                FROM EBA_DEMO_DA_EMP e
                ,    EBA_DEMO_DA_EMP m
                ,    EBA_DEMO_DA_DEPT d
                WHERE e.mgr = m.empno (+)
                AND   e.deptno = d.deptno (+)
                AND   instr(':'||:P20_DEPTNO||':',':'||e.deptno||':') > 0
                ```
            pageItemsToSubmit: P20_DEPTNO
        }
        layout {
            sequence: 30
            slot: body
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
            whenNoDataFound: No employees found for the department(s) selected.
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
        heading {
            fixedTo: none
        }
        advanced {
            savedReportMappingIdentifier: 2025952823662338819
        }

        column COMM (
            type: plainText
            heading {
                heading: Commission
                alignment: end
            }
            layout {
                sequence: 8
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: H
            }
        )

        column DEPTNO (
            type: plainText
            heading {
                heading: Department
            }
            layout {
                sequence: 9
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: I
            }
        )

        column EMPNO (
            type: plainText
            heading {
                heading: Employee #
                alignment: end
            }
            layout {
                sequence: 2
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: B
            }
        )

        column ENAME (
            type: plainText
            heading {
                heading: Name
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

        column HIREDATE (
            type: plainText
            heading {
                heading: Hire date
            }
            layout {
                sequence: 6
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: F
            }
        )

        column JOB (
            type: plainText
            heading {
                heading: Job
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

        column MGR (
            type: plainText
            heading {
                heading: Manager
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

        column ROWID (
            type: hidden
            heading {
                heading: Rowid
            }
            layout {
                sequence: 1
            }
            source {
                dataType: other
            }
            advanced {
                endUserAlias: A
            }
            security {
                escapeSpecialChars: false
            }
        )

        column SAL (
            type: plainText
            heading {
                heading: Salary
                alignment: end
            }
            layout {
                sequence: 7
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G990D00
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        savedReport 20259539 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn COMM (
                sequence: 8
            )

            displayColumn CURRENT_TIMESTAMP (
                sequence: 10
            )

            displayColumn DEPTNO (
                sequence: 9
            )

            displayColumn EMPNO (
                sequence: 2
            )

            displayColumn ENAME (
                sequence: 3
            )

            displayColumn HIREDATE (
                sequence: 6
            )

            displayColumn JOB (
                sequence: 4
            )

            displayColumn MGR (
                sequence: 5
            )

            displayColumn ROWID (
                sequence: 1
            )

            displayColumn SAL (
                sequence: 7
            )

        )

    )

    region filters (
        name: Filters
        type: staticContent
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noPadding
                t-ButtonRegion--noUI
            ]
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This page demonstrates how custom filters can be added to reports, very easily with dynamic actions. When one or more 'Department' records are selected via the shuttle item, the report is refreshed via Ajax to show the newly scoped employees.</p>
                <p>To achieve this, this page contains one dynamic action called 'FILTER REFRESH'. This refreshes the report after a different 'Department' has been selected. This makes use of the 'Refresh' action.</p>
                <p>It uses one native action ('Refresh').</p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
            ]
        }
    )

    region server-side-refresh (
        name: Server Side - Refresh 4
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

    pageItem P20_DEPTNO (
        type: shuttle
        label {
            label: Department (shuttle departments to see to right side)
            alignment: left
        }
        settings {
            showControls: movingOnly
        }
        lov {
            type: sharedComponent
            lov: @department
        }
        layout {
            sequence: 10
            region: @filters
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 5
        }
        security {
            restrictedChars: webSafe
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @employees
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
                page: &APP_PAGE_ID.
                clearCache: [
                    RIR
                    &APP_PAGE_ID.
                ]
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction filter-refresh (
        name: FILTER REFRESH
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P20_DEPTNO
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @employees
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
