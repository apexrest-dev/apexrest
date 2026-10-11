# Calendars and Javascript — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00070-calendars-and-javascript.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1dbf3064ec51b2f5b58d9b893613e2682e323a2ba97b2ed22e7d7c5018c1048e.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 70 (
    name: Calendars and Javascript
    alias: CALENDARS-AND-JAVASCRIPT
    title: Calendars and Javascript
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
    help {
        helpText: No help is available for this page.
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

    region calendars-and-javascript (
        name: Calendars and Javascript
        type: list
        source {
            list: @calendars-and-javascript
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hiddenOverflow
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: #DEFAULT#
        }
    )

)


````
