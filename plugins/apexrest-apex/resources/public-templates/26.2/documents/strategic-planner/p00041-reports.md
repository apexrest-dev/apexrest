# Reports — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00041-reports.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 08757ddc7eaff6a45fc266d8248480ed02d599cced69da7f13f1a3093d9b76aa.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 41 (
    name: Reports
    alias: REPORTS
    title: Reports
    pageGroup: @reporting
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
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
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region reports-from-list (
        name: Reports from List
        type: list
        source {
            list: @reports
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-top-md
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            listTemplate: @/cards
            templateOptions: [
                #DEFAULT#
                u-colors
                t-Cards--displaySubtitle
                t-Cards--basic
                t-Cards--displayIcons
                t-Cards--3cols
                t-Cards--iconsRounded
                t-Cards--animColorFill
            ]
        }
    )

    button up (
        buttonName: UP
        label: Navigate Up
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
                page: 21
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    computation last-proj-jump-pg (
        itemName: LAST_PROJ_JUMP_PG
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: staticValue
            staticValue: 41
        }
    )

)


````
