# Comments — Sample Master Detail

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-master-detail/apexlang/sample-master-detail/pages/p00012-comments.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 00e7f780b216ac7fdf0910054549854ac3e0e07bda68f4325fceb076abf0ea55.

Application dependency inventory: oracle:26.2:public-template/sample-master-detail/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 12 (
    name: Comments
    alias: COMMENTS
    title: Comments
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }
    help {
        helpText: No help is available for this page.
    }

    region comments (
        name: Comments
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select "ID", 
                "PROJECT_ID",
                "COMMENT_TEXT",
                "CREATED",
                "CREATED_BY"
                from EBA_DEMO_MD_COMMENTS
                  
                
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        edit {
            enabled: true
            allowedOperations: [
                update
                delete
            ]
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
            savedReportMappingIdentifier: 1838243706379356702
        }

        savedReport 14375 (
            visibility: primary
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }

            displayColumn (
                column: @ID
                layout {
                    sequence: 1
                }
            )

            displayColumn (
                column: @PROJECT_ID
                layout {
                    show: false
                    sequence: 2
                }
            )

            displayColumn (
                column: @COMMENT_TEXT
                layout {
                    sequence: 3
                }
            )

            displayColumn (
                column: @CREATED
                layout {
                    sequence: 4
                }
            )

            displayColumn (
                column: @CREATED_BY
                layout {
                    sequence: 5
                }
            )

            displayColumn (
                column: @ROWID
                layout {
                    sequence: 6
                }
            )

            controlBreak (
                column: @PROJECT_ID
                layout {
                    sequence: 1
                }
            )

        )

        column COMMENT_TEXT (
            type: textarea
            heading {
                heading: Comment
            }
            layout {
                sequence: 40
            }
            validation {
                valueRequired: true
                maxLength: 4000
            }
            link {
                target: {
                    page: 13
                    items: {
                        P13_ID: &ID.
                    }
                    clearCache: 13
                    action: resetPagination
                }
            }
            source {
                databaseColumn: COMMENT_TEXT
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

        column CREATED (
            type: displayOnly
            heading {
                heading: Created
                alignment: center
            }
            layout {
                sequence: 50
                columnAlignment: center
            }
            appearance {
                formatMask: SINCE
            }
            source {
                databaseColumn: CREATED
                dataType: timestampWithLocalTimeZone
                queryOnly: true
            }
        )

        column CREATED_BY (
            type: displayOnly
            heading {
                heading: By
            }
            settings {
                basedOn: lov
            }
            lov {
                type: sharedComponent
                lov: @username
                displayExtraValues: false
            }
            layout {
                sequence: 60
            }
            source {
                databaseColumn: CREATED_BY
                dataType: varchar2
                queryOnly: true
            }
            columnFilter {
                performanceImpactingOperators: [
                    contains
                    startsWith
                    caseInsensitive
                    regexp
                ]
                lovType: useLov
            }
            enableUsersTo {
                sort: false
            }
        )

        column ID (
            type: hidden
            layout {
                sequence: 20
            }
            source {
                databaseColumn: ID
                dataType: number
            }
            exportPrinting {
                includeInExportPrint: false
            }
        )

        column PROJECT_ID (
            type: displayOnly
            heading {
                heading: Project
            }
            settings {
                basedOn: lov
            }
            lov {
                type: sharedComponent
                lov: @projects
                displayExtraValues: false
            }
            layout {
                sequence: 30
            }
            source {
                databaseColumn: PROJECT_ID
                dataType: number
                queryOnly: true
            }
            columnFilter {
                performanceImpactingOperators: [
                    contains
                    startsWith
                    caseInsensitive
                    regexp
                ]
                lovType: useLov
            }
            exportPrinting {
                includeInExportPrint: false
            }
        )

        column ROWID (
            type: hidden
            layout {
                sequence: 10
            }
            source {
                databaseColumn: ROWID
                dataType: rowid
                primaryKey: true
            }
            exportPrinting {
                includeInExportPrint: false
            }
        )

    )

    dynamicAction edit-report-dialog-closed (
        name: Edit Report - Dialog Closed
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @comments
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @comments
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
