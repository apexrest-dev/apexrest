# Administration — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00006-administration.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 5f13f9018c61890be760ce6891b28dbf7d42d667e8fccf47a8a2fba58965d966.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 6 (
    name: Administration
    alias: ADMINISTRATION
    title: Administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }
    advanced {
        reloadOnSubmit: always
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 20
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

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @manage-sample-data
            slot: subRegions
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noPadding
                t-ButtonRegion--noUI
            ]
        }
    )

    region manage-sample-data (
        name: Manage Sample Data
        type: staticContent
        source {
            htmlCode: <p>Click the Reset Data button to reset data used by the department and employee tables to their initial defaults. Click the View Report button to see the data used for this application in a report.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--defaultIcons
                t-Alert--info
            ]
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 30
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-data (
        buttonName: RESET_DATA
        label: Reset Data
        layout {
            sequence: 20
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button view-report (
        buttonName: VIEW_REPORT
        label: View Report
        layout {
            sequence: 10
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 7
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process reset-data (
        name: reset data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                  EBA_DEMO_CAL_DATA;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Data Reset
        }
        advanced {
            executionMappingIdentifier: 2583604056494525943
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
    )

    branch (
        name: Go Back To Admin
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 15
            }
        }
        comments {
            comments: Created 01-DEC-2011 11:26 by MIKE
        }
    )

)


````
