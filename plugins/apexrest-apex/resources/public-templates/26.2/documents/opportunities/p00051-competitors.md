# Competitors — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00051-competitors.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b5c29406bd40672f57da14718f3774693430a7abef2e3c5f9aca28ae73edc580.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 51 (
    name: Competitors
    alias: COMPETITORS
    title: Competitors
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
        helpText: Manage a list of competitors. Manage the domain of competitors available to be identified by opportunities. Click the <strong>Create Competitor</strong> button to create a new competitor. Click the pencil icon in the report to edit any specific competitor's details. Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.
    }
    config {
        buildOption: @competitors
    }

    region competitors (
        name: Competitors
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                    competitor_name,
                    updated,
                    competitor_desc description,
                    tags,
                    updated_by,
                    created,
                    created_by
                from eba_sales_competitors
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
                page: 52
                items: {
                    P52_ID: #ID#
                }
                clearCache: 52
                action: resetPagination
            }
            linkIcon: <span class="fa fa-edit" aria-hidden="true"></span>
            linkAttributes: title="Edit #COMPETITOR_NAME#"
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
            savedReportMappingIdentifier: 3737373030685931581
        }

        column COMPETITOR_NAME (
            type: plainText
            heading {
                heading: Competitor
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

        column CREATED (
            type: plainText
            heading {
                heading: Created
            }
            layout {
                sequence: 8
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: H
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
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

        column DESCRIPTION (
            type: plainText
            heading {
                heading: Description
            }
            layout {
                sequence: 6
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: F
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

        column TAGS (
            type: plainText
            heading {
                heading: Tags
            }
            layout {
                sequence: 4
            }
            source {
                dataType: varchar2
            }
            columnFilter {
                type: definedLovWordContains
                sqlQuery:
                    ```sql
                    select tag
                      from eba_sales_tags_type_sum
                     where content_type = 'COMPETITOR'
                       and tag_count > 0
                    ```
            }
            advanced {
                endUserAlias: D
            }
        )

        column UPDATED (
            type: plainText
            heading {
                heading: Updated
            }
            layout {
                sequence: 5
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: E
            }
        )

        column UPDATED_BY (
            type: plainText
            heading {
                heading: Updated By
            }
            layout {
                sequence: 7
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: G
            }
        )

        savedReport 9098194 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn COMPETITOR_NAME (
                sequence: 1
            )

            displayColumn DESCRIPTION (
                sequence: 2
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Create Competitor
        layout {
            sequence: 30
            region: @competitors
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
                page: 52
                clearCache: 52
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 20
            region: @competitors
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
                page: 51
                clearCache: [
                    51
                    RIR
                ]
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
                region: @competitors
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
