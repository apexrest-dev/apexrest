# Industries — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00064-industries.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 95d6983a45cd7c91bc35ae92472eb42d30088fcf1461f1d2db50fb7f35458b7f.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 64 (
    name: Industries
    alias: INDUSTRIES
    title: Industries
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
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText:
            ```html
            Manage the list of Industries that will be available to end-users for selection in the application. Click the <strong>Create Industry</strong> button to create a new industry. Click the pencil icon next to any existing industry to edit that specific industry. 
            Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.
            ```
    }

    region industries (
        name: Industries
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id, 
                  industry_name,
                  created_by,
                  created,
                  updated_by,
                  updated
                from eba_sales_industries 
                
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--noBorders
            ]
        }
        link {
            linkColumn: customTarget
            target: {
                page: 65
                items: {
                    P65_ID: #ID#
                }
                clearCache: 65
                action: resetPagination
            }
            linkIcon: <span class="fa fa-edit" aria-hidden="true"></span>
            linkAttributes: title="Edit #INDUSTRY_NAME#"
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 10000
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
        advanced {
            savedReportMappingIdentifier: 3740753630896089791
        }

        column CREATED (
            type: plainText
            heading {
                heading: Created
            }
            layout {
                sequence: 6
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: F
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
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

        column ID (
            type: hidden
            heading {
                heading: Id
            }
            layout {
                sequence: 1
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
            security {
                escapeSpecialChars: false
            }
        )

        column INDUSTRY_NAME (
            type: plainText
            heading {
                heading: Industry
            }
            layout {
                sequence: 2
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column UPDATED (
            type: plainText
            heading {
                heading: Updated
            }
            layout {
                sequence: 7
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: G
            }
        )

        column UPDATED_BY (
            type: plainText
            heading {
                heading: Updated By
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

        savedReport 9132003 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn INDUSTRY_NAME (
                sequence: 1
            )

            sort (
                column: INDUSTRY_NAME
                sort {
                    sequence: 1
                }
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Create Industry
        layout {
            sequence: 30
            region: @industries
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 65
                clearCache: 65
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 20
            region: @industries
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
                page: 64
                clearCache: [
                    64
                    RIR
                    CIR
                ]
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction dialog-closed (
        name: Dialog Closed
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: jsExpression
            javaScriptExpression: window
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode: apex.message.showPageSuccess('Action Processed.');
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
                region: @industries
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
