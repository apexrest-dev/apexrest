# Reset Data — Sample Data Loading

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-data-loading/apexlang/sample-data-loading/pages/p00008-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d6ff46dfb27979375f8df9bd0d1193dcf3da6d4882aa504f71f47141121b9d35.

Application dependency inventory: oracle:26.2:public-template/sample-data-loading/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 8 (
    name: Reset Data
    alias: SETTINGS
    title: Reset Data
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
            parentRegion: @reset-data
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

    region reset-data (
        name: Reset Data
        type: staticContent
        source {
            htmlCode: <p>Click the reset data button to reset the data to default values.</p>
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
                t-Alert--warning
            ]
            cssClasses: t-Alert--accessibleHeading
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
                page: 9
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-data (
        buttonName: reset_data
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
        name: reset_data
        type: executeCode
        source {
            plsqlCode: eba_demo_data_load.reset_sample;
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Data reset.
        }
        advanced {
            executionMappingIdentifier: 4900751352333077838
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
    )

    branch (
        name: Go To Page 1
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 9
                action: resetPagination
            }
        }
        comments {
            comments: Created 01-MAY-2012 12:07 by MIKE
        }
    )

)


````
