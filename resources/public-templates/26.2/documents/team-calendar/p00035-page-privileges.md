# Page Privileges — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00035-page-privileges.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ead41a58c6237213da6ff596224a5a3918ba745a382ff4f630855d095f9160ab.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 35 (
    name: Page Privileges
    alias: PAGE-PRIVILEGES
    title: Page Privileges
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
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: <p>The Page Privileges report shows the roles required to access each page in this application and which pages do not require authentication (the user to be logged in).  It is organized by Page Group which loosely corresponds to the tab to which the page is associated. Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.</p>
    }

    region application-page-security (
        name: Application Page Security
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select page_id, 
                       page_id||'. '||page_name page_title, 
                       page_group, 
                       page_function, 
                       nvl(initcap(replace(authorization_scheme,'_',' ')),'No Scheme Applied') authorization_scheme, 
                       page_requires_authentication requires_auth,
                       build_option
                from apex_application_pages
                where application_id =  :APP_ID
                    and page_function != 'Global Page'
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
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToYOfZ
        }
        performance {
            maxRowsToProcess: 1000000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: The maximum row count for this report is #MAX_ROW_COUNT# rows.  Please apply a filter to reduce the number of records in your query.
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
            savedReportMappingIdentifier: 655044932013335898
        }

        column AUTHORIZATION_SCHEME (
            type: plainText
            heading {
                heading: Role
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

        column BUILD_OPTION (
            type: plainText
            heading {
                heading: Build Option
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

        column PAGE_FUNCTION (
            type: plainText
            heading {
                heading: Function
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

        column PAGE_GROUP (
            type: plainText
            heading {
                heading: Page Group
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

        column PAGE_ID (
            type: plainText
            heading {
                heading: Page
                alignment: end
            }
            layout {
                sequence: 1
                columnAlignment: end
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
        )

        column PAGE_TITLE (
            type: plainText
            heading {
                heading: Page Name
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

        column REQUIRES_AUTH (
            type: plainText
            heading {
                heading: Requires Authentication
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

        savedReport 6550458 (
            visibility: primaryDefault
            view {
                rowsPerPage: 100
            }

            displayColumn AUTHORIZATION_SCHEME (
                sequence: 5
            )

            displayColumn PAGE_FUNCTION (
                sequence: 4
            )

            displayColumn PAGE_GROUP (
                sequence: 1
            )

            displayColumn PAGE_ID (
                sequence: 2
            )

            displayColumn PAGE_TITLE (
                sequence: 3
            )

            displayColumn REQUIRES_AUTH (
                sequence: 6
            )

            sort (
                column: PAGE_GROUP
                sort {
                    sequence: 1
                }
            )

            sort (
                column: PAGE_ID
                sort {
                    sequence: 2
                }
            )

        )

    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @application-page-security
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
                page: 35
                clearCache: [
                    35
                    RIR
                ]
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
