# Access Control List — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00057-manage-acl.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 377012c976c4372f0e16db31a3d47bc7d4141caa64914feda393a1c917feedb9.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 57 (
    name: Access Control List
    alias: MANAGE_ACL
    title: Access Control List
    pageGroup: @acl
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
    javaScript {
        executeWhenPageLoads:
            ```javascript-browser
            window.onunload = refreshParent;
            function refreshParent() {
                parent.location.reload();
            }
            ```
    }
    security {
        authorizationScheme: @administration-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: <p>When Access Control is enabled, Administrators have the ability to restrict access to certain application features, for authenticated users. Customers supports the following 3 access levels; Reader, Contributor and Administrator. <b>Reader's</b> have read-only access and can also view reports. <b>Contributor's</b> can create, edit, delete and view reports. <b>Administrator's</b>, in addition to Contributor's capability, can also perform Customers administration, including configuration of access control, managing application look-up data and installing or uninstalling sample data.</p>
    }

    region users (
        name: Users
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                       username,
                       access_level_id,
                       case when account_locked = 'Y' then 'Yes' else 'No' end account_locked,
                       created_by,
                       created
                  from eba_cust_users
                
                ```
        }
        layout {
            sequence: 30
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: [
                #DEFAULT#
                t-IRR-region--noBorders
            ]
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
            savedReportMappingIdentifier: 1624849211670648387
        }

        column ACCESS_LEVEL_ID (
            type: plainTextBasedOnLov
            heading {
                heading: Access Level
            }
            lov {
                lov: @access-levels
            }
            layout {
                sequence: 3
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: C
            }
        )

        column ACCOUNT_LOCKED (
            type: plainText
            heading {
                heading: Account Locked
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
                sequence: 4
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: D
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

        column USERNAME (
            type: link
            heading {
                heading: Username
            }
            layout {
                sequence: 2
            }
            link {
                target: {
                    page: 58
                    items: {
                        P58_ID: #ID#
                    }
                    clearCache: 58
                    action: resetPagination
                }
                linkText: #USERNAME#
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        savedReport 16248539 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn ACCESS_LEVEL_ID (
                sequence: 2
            )

            displayColumn ACCOUNT_LOCKED (
                sequence: 3
            )

            displayColumn CREATED (
                sequence: 5
            )

            displayColumn CREATED_BY (
                sequence: 4
            )

            displayColumn USERNAME (
                sequence: 1
            )

            sort (
                column: CREATED
                sort {
                    direction: desc
                    sequence: 1
                }
            )

            sort (
                column: ACCESS_LEVEL_ID
                sort {
                    sequence: 2
                }
            )

            sort (
                column: USERNAME
                sort {
                    sequence: 3
                }
            )

        )

    )

    button bulk-add-users (
        buttonName: BULK_ADD_USERS
        label: Add Multiple Users
        layout {
            sequence: 40
            region: @users
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 73
                clearCache: [
                    73
                    74
                ]
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button create (
        buttonName: CREATE
        label: Add User
        layout {
            sequence: 50
            region: @users
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
                page: 58
                clearCache: 58
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 30
            region: @users
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

    dynamicAction refresh-report (
        name: Refresh Report
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
                region: @users
            }
            execution {
                sequence: 10
            }
        )

    )

    computation last-view (
        itemName: LAST_VIEW
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: staticValue
            staticValue: &APP_PAGE_ID.
        }
    )

)


````
