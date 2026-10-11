# Team Roles — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00025-team-roles.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a76b261dcc454d9091d87ff581151e319a3d3884ee792b650f8792de34fd7507.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 25 (
    name: Team Roles
    alias: TEAM-ROLES
    title: Team Roles
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
            Manage the list of Team Roles that will be available to end-users for selection in the application. Click the <strong>Create Team Role</strong> button to create a new team role. Click the pencil icon next to any existing team role to edit that specific team role. 
            Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.
            ```
    }

    region rep-title-roles (
        name: &REP_TITLE. Roles
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 
                  id, 
                  role_name,
                  (
                    select count(*) 
                    from eba_sales_salesreps x 
                    where x.rep_role = r.id
                  ) reps,
                  case
                    when is_sales_rep = 'Y'
                    then 'Yes'
                    else 'No'
                  end is_sales_rep,
                  created, 
                  lower(created_by) created_by, 
                  updated, 
                  lower(updated_by) updated_by
                from eba_sales_salesrep_roles r
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
                page: 26
                items: {
                    P26_ID: #ID#
                }
                clearCache: 26
                action: resetPagination
            }
            linkIcon: <span class="fa fa-edit" aria-hidden="true"></span>
            linkAttributes: title="Edit #ROLE_NAME#"
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
            savedReportMappingIdentifier: 3737751914970454521
        }

        column CREATED (
            type: plainText
            heading {
                heading: Created
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

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
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
                heading: Edit
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

        column IS_SALES_REP (
            type: plainText
            heading {
                heading: Is &REP_TITLE.
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

        column REPS (
            type: plainText
            heading {
                heading: Reps
                alignment: end
            }
            layout {
                sequence: 3
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: C
            }
        )

        column ROLE_NAME (
            type: plainText
            heading {
                heading: Role
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
                sequence: 8
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: H
            }
        )

        savedReport 9101983 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn IS_SALES_REP (
                sequence: 3
            )

            displayColumn REPS (
                sequence: 2
            )

            displayColumn ROLE_NAME (
                sequence: 1
            )

            sort (
                column: ROLE_NAME
                sort {
                    sequence: 1
                }
            )

            sort (
                column: REPS
                sort {
                    direction: desc
                    sequence: 2
                }
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Create Team Role
        layout {
            sequence: 20
            region: @rep-title-roles
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
                page: 26
                clearCache: 26
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @rep-title-roles
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
                    &APP_PAGE_ID.
                    RIR
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
                region: @rep-title-roles
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
