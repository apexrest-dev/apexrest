# Manage Sample Data — Sample Trees

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-trees/apexlang/sample-trees/pages/p00002-manage-sample-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 925728c3fe571c0cbb035770cd4770852a2c362976bc7da20051e9db88d90117.

Application dependency inventory: oracle:26.2:public-template/sample-trees/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 2 (
    name: Manage Sample Data
    alias: MANAGE-SAMPLE-DATA
    title: Manage Sample Data
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

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
                t-Alert--info
            ]
        }
    )

    region manage-sample-data (
        name: Manage Sample Data
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 1
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
                page: settings
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
        name: reset data
        type: executeCode
        source {
            plsqlCode: EBA_DEMO_TREE_DATA;
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Data has been reset to default values.
        }
        advanced {
            executionMappingIdentifier: 3273068706287063804
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: SETTINGS
            }
        }
        comments {
            comments: Created 12-DEC-2011 06:30 by MIKE
        }
    )

)


````
