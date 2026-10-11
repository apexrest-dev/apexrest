# Interactive Grid — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01410-interactive-grid.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 95ae16305adbf6e01f1ad63c5c2762ace431bcbd12388b08bc872070c6a5d157.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1410 (
    name: Interactive Grid
    alias: INTERACTIVE-GRID
    title: Interactive Grid - &APP_TITLE.
    pageGroup: @components
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: [
            dm-Page
            dm-Page--center
        ]
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region basic-reporting (
        name: Basic Reporting
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    task_name,
                    status,
                    start_date,
                    end_date,
                    assigned_to,
                    cost,
                    budget,
                    updated_by,
                    updated
                from
                    EBA_UT_chart_tasks
                ```
        }
        layout {
            sequence: 10
            parentRegion: @demo
            slot: subRegions
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: Demo1
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
            savedReportMappingIdentifier: 246615572384698829
        }

        savedReport 15009 (
            visibility: primary
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }

            displayColumn (
                column: @TASK_NAME
                layout {
                    sequence: 1
                }
            )

            displayColumn (
                column: @STATUS
                layout {
                    sequence: 2
                }
            )

            displayColumn (
                column: @START_DATE
                layout {
                    sequence: 3
                }
            )

            displayColumn (
                column: @END_DATE
                layout {
                    sequence: 4
                }
            )

            displayColumn (
                column: @ASSIGNED_TO
                layout {
                    sequence: 5
                }
            )

            displayColumn (
                column: @COST
                layout {
                    sequence: 6
                }
            )

            displayColumn (
                column: @BUDGET
                layout {
                    sequence: 7
                }
            )

            displayColumn (
                column: @UPDATED_BY
                layout {
                    sequence: 8
                }
            )

            displayColumn (
                column: @UPDATED
                layout {
                    sequence: 9
                }
            )

        )

        column ASSIGNED_TO (
            type: textField
            heading {
                heading: Assigned to
            }
            layout {
                sequence: 50
            }
            source {
                databaseColumn: ASSIGNED_TO
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

        column BUDGET (
            type: numberField
            heading {
                heading: Budget
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
            source {
                databaseColumn: BUDGET
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column COST (
            type: numberField
            heading {
                heading: Cost
                alignment: end
            }
            settings {
                numberAlignment: end
                virtualKeyboard: text
            }
            layout {
                sequence: 60
                columnAlignment: end
            }
            source {
                databaseColumn: COST
                dataType: number
            }
            columnFilter {
                lovType: none
            }
        )

        column END_DATE (
            type: datePickerJquery
            heading {
                heading: End date
                alignment: center
            }
            layout {
                sequence: 40
                columnAlignment: center
            }
            source {
                databaseColumn: END_DATE
                dataType: date
            }
        )

        column START_DATE (
            type: datePickerJquery
            heading {
                heading: Start date
                alignment: center
            }
            layout {
                sequence: 30
                columnAlignment: center
            }
            source {
                databaseColumn: START_DATE
                dataType: date
            }
        )

        column STATUS (
            type: textField
            heading {
                heading: Status
            }
            layout {
                sequence: 20
            }
            source {
                databaseColumn: STATUS
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

        column TASK_NAME (
            type: textField
            heading {
                heading: Task name
            }
            layout {
                sequence: 10
            }
            source {
                databaseColumn: TASK_NAME
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

        column UPDATED (
            type: datePickerJquery
            heading {
                heading: Updated
                alignment: center
            }
            layout {
                sequence: 90
                columnAlignment: center
            }
            source {
                databaseColumn: UPDATED
                dataType: timestampWithLocalTimeZone
            }
        )

        column UPDATED_BY (
            type: textField
            heading {
                heading: Updated by
            }
            layout {
                sequence: 80
            }
            source {
                databaseColumn: UPDATED_BY
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

    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
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

    region demo (
        name: Demo
        type: staticContent
        layout {
            sequence: 50
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 40
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            staticId: Demo1
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Interactive Grid includes all the features you expect for powerful reporting, including fixed headers, frozen columns, scroll pagination, multiple filters, sorting, aggregates, computations, and more.</p>
                <p>For more examples, please install the <strong>Sample Interactive Grids</strong> from Packaged Apps > Sample Apps.</p>
                ```
        }
        layout {
            sequence: 30
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-display-selector (
        name: Region Display Selector
        type: regionDisplaySelector
        layout {
            sequence: 20
            slot: breadcrumbBar
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    region template-options (
        name: Template Options
        type: plugin/previewTemplateOptions
        layout {
            sequence: 60
            slot: body
            startNewRow: false
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            staticId: Demo1
        }
    )

)


````
