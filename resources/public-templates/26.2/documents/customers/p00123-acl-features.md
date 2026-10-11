# ACL Features — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00123-acl-features.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f6d2603dc1b942983814086764c4cd2edae3e81dc176a6d74be1f11348411508.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 123 (
    name: ACL Features
    alias: ACL-FEATURES
    title: ACL Features
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
            t-Dialog--noPadding
        ]
    }
    dialog {
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
        formAutoComplete: true
    }
    help {
        helpText:
            ```html
            <p>ACL Features allow for specific application functionality to be set to specific access levels.  Use ACL options to limit which users can perform the specified feature when running your application.</p>
            <p>Select the appropriate <strong>Access Level</strong> for each of the Authorizations listed.</p>
            ```
    }

    region acl-features (
        name: ACL Features
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 
                       initcap(replace(authorization_name,'_',' ')) authorization,
                       feature,
                       access_level_id,
                       updated,
                       lower(updated_by) updated_by
                  from eba_cust_acl_features a
                
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--noBorders
            ]
        }
        edit {
            enabled: true
            allowedOperations: update
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
                excel
                pdf
            ]
        }
        advanced {
            savedReportMappingIdentifier: 1103355000012168619
        }

        savedReport 13033 (
            visibility: primary
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }

            displayColumn (
                column: @APEX$ROW_ACTION
                layout {
                    sequence: 1
                }
            )

            displayColumn (
                column: @ROWID
                layout {
                    sequence: 2
                }
            )

            displayColumn (
                column: @AUTHORIZATION
                layout {
                    width: 149
                    sequence: 3
                }
            )

            displayColumn (
                column: @FEATURE
                layout {
                    width: 357
                    sequence: 4
                }
            )

            displayColumn (
                column: @ACCESS_LEVEL_ID
                layout {
                    width: 289
                    sequence: 5
                }
            )

            displayColumn (
                column: @UPDATED
                layout {
                    width: 94
                    sequence: 6
                }
            )

            displayColumn (
                column: @UPDATED_BY
                layout {
                    sequence: 7
                }
            )

        )

        column ACCESS_LEVEL_ID (
            type: selectList
            heading {
                heading: Access Level
            }
            lov {
                type: sharedComponent
                lov: @access-levels
                displayExtraValues: false
                nullDisplayValue: - Select Access Level -
            }
            layout {
                sequence: 60
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: ACCESS_LEVEL_ID
                dataType: number
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
        )

        column APEX$ROW_ACTION (
            type: actionsMenu
            layout {
                sequence: 20
            }
        )

        column APEX$ROW_SELECTOR (
            type: rowSelector
            layout {
                sequence: 10
            }
        )

        column AUTHORIZATION (
            type: displayOnly
            heading {
                heading: Authorization
            }
            layout {
                sequence: 40
            }
            source {
                databaseColumn: AUTHORIZATION
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
                lovType: none
            }
        )

        column FEATURE (
            type: displayOnly
            heading {
                heading: Feature
            }
            layout {
                sequence: 50
            }
            source {
                databaseColumn: FEATURE
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
        )

        column ROWID (
            type: hidden
            layout {
                sequence: 30
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

        column UPDATED (
            type: displayOnly
            heading {
                heading: Updated
                alignment: center
            }
            layout {
                sequence: 70
                columnAlignment: center
            }
            source {
                databaseColumn: UPDATED
                dataType: timestampWithLocalTimeZone
                queryOnly: true
            }
        )

        column UPDATED_BY (
            type: displayOnly
            heading {
                heading: Updated By
            }
            layout {
                sequence: 80
            }
            source {
                databaseColumn: UPDATED_BY
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
                lovType: none
            }
        )

        page {
            borderWidth: 0.5
            borderColor: #666666
        }
        columnHeadings {
            fontWeight: normal
            backgroundColor: #9bafde
        }
        columns {
            backgroundColor: #efefef
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 20
            region: @acl-features
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
                page: 123
                clearCache: [
                    9
                    RIR
                ]
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process acl-features-save-interactive-grid-data (
        name: ACL Features - Save Interactive Grid Data
        type: interactiveGridAutoRowProcessing
        editableRegion: @acl-features
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: ACL Feature Access Levels updated.
        }
        advanced {
            executionMappingIdentifier: 1105866801547847969
        }
    )

)


````
