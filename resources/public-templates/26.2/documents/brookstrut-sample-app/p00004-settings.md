# Administration — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00004-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c9b4fa937a880a5d1b97841a63c4fe3c90bf11649951a8a4711bce5675458425.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 4 (
    name: Administration
    alias: SETTINGS
    title: Administration
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: rw-pillar--sienna
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    advanced {
        reloadOnSubmit: always
    }

    region administration-and-settings (
        name: Administration and Settings
        type: list
        source {
            list: @settings
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: #DEFAULT#
        }
    )

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

    button up (
        buttonName: up
        label: Up
        layout {
            sequence: 10
            region: @breadcrumb
            slot: up
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-arrow-up
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
