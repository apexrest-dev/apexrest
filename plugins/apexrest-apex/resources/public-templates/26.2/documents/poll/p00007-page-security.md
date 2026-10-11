# Page Security — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00007-page-security.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 41591097ed964dbc33ae36a4176fc84f97acacb65ac0c389d632a843ccbe0b96.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 7 (
    name: Page Security
    alias: PAGE-SECURITY
    title: Page Security
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
        helpText: No help is available for this page.
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
                       nvl(initcap(replace(authorization_scheme,'_',' ')),'No Role Required') authorization_scheme, 
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
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 1000000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: The maximum row count for this report is #MAX_ROW_COUNT# rows.  Please apply a filter to reduce the number of records in your query.
        }
        actionsMenu {
            pivot: false
            subscription: false
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
            savedReportMappingIdentifier: 651425323366710148
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
            enableUsersTo {
                pivot: false
            }
        )

        column BUILD_OPTION (
            type: hidden
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
            security {
                escapeSpecialChars: false
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
            enableUsersTo {
                pivot: false
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
            enableUsersTo {
                pivot: false
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
            enableUsersTo {
                pivot: false
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
            enableUsersTo {
                pivot: false
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
            enableUsersTo {
                pivot: false
            }
        )

        savedReport 6514262 (
            visibility: primaryDefault
            view {
                rowsPerPage: 100
            }

            displayColumn AUTHORIZATION_SCHEME (
                sequence: 5
            )

            displayColumn BUILD_OPTION (
                sequence: 7
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

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @application-page-security
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconLeft
            ]
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

)


````
