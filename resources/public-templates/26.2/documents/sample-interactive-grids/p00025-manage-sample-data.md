# Manage Sample Data — Sample Interactive Grids

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-interactive-grids/apexlang/sample-interactive-grids/pages/p00025-manage-sample-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a451a7bb80867655bfc5bcd44acf23dd0c72ceacbccafde12190378c3bcc5f59.

Application dependency inventory: oracle:26.2:public-template/sample-interactive-grids/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 25 (
    name: Manage Sample Data
    alias: MANAGE-SAMPLE-DATA
    title: Manage Sample Data
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
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
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        advanced {
            regionDisplaySelector: true
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
            parentRegion: @manage-sample-application
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

    region manage-sample-application (
        name: Manage Sample Application
        type: staticContent
        source {
            htmlCode: <p>Click the Reset Data button to reset data used in this application to its initial defaults.</p>
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
            sequence: 20
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
            action: redirectThisApp
            target: {
                page: 24
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-data (
        buttonName: RESET_DATA
        label: Reset Data
        layout {
            sequence: 10
            region: @buttons
            slot: next
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

    process reset-data (
        name: Reset Data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                  eba_demo_ig_data;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: The sample data used for this application has been reset.
        }
        advanced {
            executionMappingIdentifier: 715317535665554131
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 1
                clearCache: 1
                action: resetPagination
            }
        }
        comments {
            comments: Created 14-DEC-2011 13:59 by MIKE
        }
    )

)


````
