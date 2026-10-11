# Editing (Dialog) — Sample Interactive Grids

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-interactive-grids/apexlang/sample-interactive-grids/pages/p00054-editing-dialog.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 881d7b3d22df66af7f9b51d445b402ede802523e76449f629cbd05e44b71cb5b.

Application dependency inventory: oracle:26.2:public-template/sample-interactive-grids/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 54 (
    name: Editing (Dialog)
    alias: EDITING-DIALOG
    title: Editing (Dialog)
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region department-overview (
        name: Department Overview
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select d.deptno, d.dname,
                       d.loc,
                       case when dname = 'SALES' then 'fa fa-usd fa-2x'
                            when dname = 'RESEARCH' then 'fa fa-flask fa-2x'
                            when dname = 'OPERATIONS' then 'fa fa-calculator fa-2x'
                            when dname = 'ACCOUNTING' then 'fa fa-area-chart fa-2x'
                       end as dicon,
                       '<br>'||dname || ':<br> ' || count( e.empno ) || case when count(e.empno) = 1 then ' employee' else ' employees' end as dlabel,
                       count( e.empno ) EMP_CNT
                  from eba_demo_ig_emp e,
                       eba_demo_ig_dept d
                 where e.deptno (+) = d.deptno
                 group by d.deptno, d.dname, d.loc
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: emp
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: page
        }
        toolbar {
            controls: [
                searchCol
                searchField
                actionsMenu
            ]
        }
        download {
            formats: [
                csv
                html
                excel
                pdf
            ]
        }
        iconView {
            show: true
            icon: DICON
            linkTarget: {
                page: 55
                items: {
                    P55_DEPTNO: &DEPTNO.
                }
                action: resetPagination
            }
            labelColumn: DLABEL
        }
        advanced {
            savedReportMappingIdentifier: 2554500697641300671
        }

        savedReport 14501 (
            visibility: primary
            view {
                default: icon
                rowsPerPage: 5
            }
            singleRowView {
                displayedColumns: true
            }

            displayColumn (
                column: @DEPTNO
                layout {
                    sequence: 18
                }
            )

            displayColumn (
                column: @DNAME
                layout {
                    sequence: 12
                }
            )

            displayColumn (
                column: @LOC
                layout {
                    sequence: 13
                }
            )

            displayColumn (
                column: @EMP_CNT
                layout {
                    sequence: 15
                }
            )

            displayColumn (
                column: @DICON
                layout {
                    show: false
                    sequence: 16
                }
            )

            displayColumn (
                column: @DLABEL
                layout {
                    show: false
                    sequence: 17
                }
            )

        )

        column DEPTNO (
            type: hidden
            layout {
                sequence: 80
            }
            source {
                databaseColumn: DEPTNO
                dataType: number
            }
            exportPrinting {
                includeInExportPrint: false
            }
        )

        column DICON (
            type: textField
            heading {
                heading: Dicon
            }
            layout {
                sequence: 60
            }
            validation {
                maxLength: 22
            }
            source {
                databaseColumn: DICON
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

        column DLABEL (
            type: displayOnly
            heading {
                heading: Dlabel
            }
            settings {
                format: html
            }
            layout {
                sequence: 70
            }
            source {
                databaseColumn: DLABEL
                dataType: varchar2
            }
            columnFilter {
                performanceImpactingOperators: [
                    contains
                    startsWith
                    caseInsensitive
                    regexp
                ]
                lovType: none
            }
            enableUsersTo {
                sort: false
            }
        )

        column DNAME (
            type: link
            heading {
                heading: Department Name
            }
            layout {
                sequence: 30
            }
            link {
                target: {
                    page: 55
                    items: {
                        P55_DEPTNO: &DEPTNO.
                    }
                    action: resetPagination
                }
            }
            source {
                databaseColumn: DNAME
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

        column EMP_CNT (
            type: numberField
            heading {
                heading: Employee Count
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
                databaseColumn: EMP_CNT
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column LOC (
            type: textField
            heading {
                heading: Location
            }
            layout {
                sequence: 40
            }
            validation {
                maxLength: 40
            }
            source {
                databaseColumn: LOC
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

        page {
            borderWidth: 0.5
            borderColor: #666666
        }
    )

    region overview-editing-in-a-dialog (
        name: Overview: Editing in a Dialog
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This page shows how to use Interactive Grid in a modal dialog. The first page is a normal page which shows some overview information, in this example the departments stored in the EBA_DEMO_IG_DEPT table are being shown. Clicking on one of the departments opens a dialog page in which the EBA_DEMO_IG_EMP rows for that department can be modified.</p>
                <p>Here are some things to know about working with interactive grids on a dialog page:</p>
                <ul>
                <li>For the interactive grid itself, there are no differences between a normal page and a modal dialog. It's being created the same way.</li>
                <li>In most cases, the dialog should be closed after changes have been saved. So, on the dialog page, add a <strong>Close Dialog</strong> process to be executed after the interactive grid row processing.</li>
                <li>It's good practice to add another "Cancel" button as well. On click, execute a <strong>Cancel Dialog</strong> dynamic action.</li>
                <li>When the dialog is closed, you may want to refresh some regions on the parent page since the shown information is outdated now. To achieve this, create a dynamic action for the <strong>Dialog Closed</strong> event, as it is done on this page. Beyond the refresh you might also display some notifications.</li>
                </ul>
                ```
        }
        layout {
            sequence: 10
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
        advanced {
            regionDisplaySelector: true
        }
    )

    button next (
        buttonName: Next
        label: Next
        layout {
            sequence: 20
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--pillEnd
            ]
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 40
                action: resetPagination
            }
        }
    )

    button prev (
        buttonName: PREV
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--pillStart
            ]
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 60
                action: resetPagination
            }
        }
    )

    dynamicAction edit-dialog-closed (
        name: Edit Dialog closed.
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: jsExpression
            javaScriptExpression: window
        }
        clientSideCondition {
            type: jsExpression
            javaScriptExpression: this.data && this.data.dialogPageId === 55
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode: apex.message.showPageSuccess( "Changes successfully saved.");
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @department-overview
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
