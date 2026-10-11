# Project Interactions — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00600-project-interactions.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: dcae5bd145551b69f40f43a5eaf239ad998d85c31e83bf2b0f2dd593ec3cce16.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 600 (
    name: Project Interactions
    alias: PROJECT-INTERACTIONS
    title: &NOMENCLATURE_PROJECT. Interactions
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }

    region button-bar (
        name: button_bar
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        security {
            authorizationScheme: @administration-rights
        }
    )

    region nomenclature-project-interactions (
        name: &NOMENCLATURE_PROJECT. Interactions
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select app_user, 
                       count(*) interactions, 
                       min(page_rendered) first_interaction,
                       max(page_rendered) last_interaction
                from   sp_proj_interactions_log
                where  project_id = :P600_PROJECT_ID
                group  by app_user
                order by 4 desc
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        reportLayout {
            numberOfRows: 150
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--noBorders
            ]
        }

        column APP_USER (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: User
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column FIRST_INTERACTION (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: First Interaction
            }
            layout {
                sequence: 40
            }
            appearance {
                formatMask: SINCE
            }
            sorting {
                sortable: false
            }
        )

        column INTERACTIONS (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Interactions
                alignment: end
            }
            layout {
                sequence: 20
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
        )

        column LAST_INTERACTION (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Last Interaction
            }
            layout {
                sequence: 50
            }
            appearance {
                formatMask: SINCE
            }
            sorting {
                sortable: false
            }
        )

    )

    pageItem P600_PROJECT_ID (
        type: hidden
        layout {
            sequence: 10
            region: @nomenclature-project-interactions
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    button view-details (
        buttonName: view_details
        label: Details
        layout {
            sequence: 20
            region: @button-bar
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--small
                t-Button--noUI
                t-Button--iconLeft
                t-Button--padTop
                t-Button--padBottom
            ]
            icon: fa-glasses
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 610
                items: {
                    P610_PROJECT_ID: &P600_PROJECT_ID.
                }
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
        security {
            authorizationScheme: @administration-rights
        }
    )

)


````
