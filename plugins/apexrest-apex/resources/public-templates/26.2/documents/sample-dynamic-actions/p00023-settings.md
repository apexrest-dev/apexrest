# Administration — Sample Dynamic Actions

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-dynamic-actions/apexlang/sample-dynamic-actions/pages/p00023-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 302698f9c840af87bd5579be07a44e48e47f660c06abdac5879950093b65758a.

Application dependency inventory: oracle:26.2:public-template/sample-dynamic-actions/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 23 (
    name: Administration
    alias: SETTINGS
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
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }

    region administration (
        name: Administration
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
            parentRegion: @reset-application-data
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

    region reset-application-data (
        name: Reset Application Data
        type: staticContent
        source {
            htmlCode: <p>This application uses sample tables called EBA_DEMO_DA_EMP and EBA_DEMO_DA_DEPT.</p>
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
            sequence: 10
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
                page: 26
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-data (
        buttonName: RESET_DATA
        label: Reset Data
        layout {
            sequence: 20
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
                  eba_demo_da_data;
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
            executionMappingIdentifier: 2672380859760358416
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
    )

    branch (
        name: Go To Page 26
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 26
                action: resetPagination
            }
        }
        comments {
            comments: Created 14-DEC-2011 13:59 by MIKE
        }
    )

)


````
