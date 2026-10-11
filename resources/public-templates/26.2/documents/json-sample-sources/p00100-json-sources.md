# JSON Sources — Json Sample Sources

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/pages/p00100-json-sources.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6a6ec10661371f62c1ad2b7d0638528981d20ec97e002c3554ffa5d608e5a0c0.

Application dependency inventory: oracle:26.2:public-template/json-sample-sources/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 100 (
    name: JSON Sources
    alias: JSON-SOURCES
    title: JSON Sources
    pageGroup: @json-sources
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
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

    region json-sources (
        name: JSON Sources
        type: list
        source {
            list: @json-sources
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
                t-Region--scrollBody
            ]
        }
        accessibility {
            landmarkType: navigation
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: #DEFAULT#
        }
    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 20
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 101
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Previous
        layout {
            sequence: 30
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
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
