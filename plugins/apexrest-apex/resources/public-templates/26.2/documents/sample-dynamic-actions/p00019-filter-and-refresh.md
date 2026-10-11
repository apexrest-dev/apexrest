# Filter and Refresh — Sample Dynamic Actions

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-dynamic-actions/apexlang/sample-dynamic-actions/pages/p00019-filter-and-refresh.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 59f8f31142c54e90e276406e0ab6116760ef7ed21c08d4cff1f2f686b962aa75.

Application dependency inventory: oracle:26.2:public-template/sample-dynamic-actions/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 19 (
    name: Filter and Refresh
    alias: FILTER-AND-REFRESH
    title: Filter and Refresh
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
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
                AND   e.deptno = nvl(:P19_DEPTNO, e.deptno)
                AND   e.job = nvl(:P19_JOB, e.job)
                ```
            pageItemsToSubmit: [
                P19_DEPTNO
                P19_JOB
            ]
        }
        layout {
            sequence: 20
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
        heading {
            fixedTo: none
        }
        advanced {
            savedReportMappingIdentifier: 2025439306593227936
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
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
        )

        savedReport 20254405 (
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
            sequence: 10
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
                <p>This page contains 2 dynamic actions, 'FILTER REFRESH' and 'RESET REPORT'.</p>
                <p>'FILTER REFRESH' fires when either the 'Department' or 'Job' select list values are changed and refreshes the report via Ajax to show the newly scoped employees.</p>
                <p>'RESET REPORT' fires when the 'Reset' button is pressed, which resets the report via Ajax, by clearing the select lists and refreshing the report.</p>
                <p>'FILTER REFRESH' uses one native action ('Refresh'). 'RESET REPORT' uses 2 native actions ('Set Value' and 'Refresh').</p>
                ```
        }
        layout {
            sequence: 4
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
        name: Server Side - Refresh 3
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

    pageItem P19_DEPTNO (
        type: selectList
        label {
            label: Department
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @department
            displayExtraValues: false
            nullDisplayValue: - Show All -
        }
        layout {
            sequence: 20
            region: @filters
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
            height: 1
        }
        security {
            restrictedChars: webSafe
        }
    )

    pageItem P19_JOB (
        type: selectList
        label {
            label: Job
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @job
            nullDisplayValue: - Show All -
        }
        layout {
            sequence: 10
            region: @filters
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
            height: 1
        }
        security {
            restrictedChars: webSafe
        }
    )

    button p19-reset (
        buttonName: P19_RESET
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
            action: definedByDynamicAction
        }
        advanced {
            htmlDomId: P19_RESET
            requestSourceType: null
        }
    )

    dynamicAction filter-refresh (
        name: FILTER REFRESH
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: [
                P19_DEPTNO
                P19_JOB
            ]
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

    dynamicAction reset-report (
        name: RESET REPORT
        execution {
            sequence: 20
        }
        when {
            event: click
            selectionType: button
            button: @p19-reset
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @employees
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-set-value (
            action: setValue
            settings {
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: [
                    P19_DEPTNO
                    P19_JOB
                ]
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
