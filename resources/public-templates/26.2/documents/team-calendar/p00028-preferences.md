# Preferences — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00028-preferences.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 91b845ba0323180d7bf684eb496c5fe4086f9d64408336b9d5a6200b79871736.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 28 (
    name: Preferences
    alias: PREFERENCES
    title: Preferences
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: Customize your application preferences from the list of preferences provided below.
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

    region preferences (
        name: Preferences
        type: list
        source {
            list: @preferences
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: #DEFAULT#
        }
    )

    computation last-view (
        itemName: LAST_VIEW
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: staticValue
            staticValue: &APP_PAGE_ID.
        }
    )

)


````
