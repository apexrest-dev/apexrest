# Use Cases — Sample Application Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-application-search/apexlang/sample-application-search/pages/p00200-use-cases.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7d851102cf7f48696d8577e119ba88435faf193a79f1950cc4f0c425fbd892bc.

Application dependency inventory: oracle:26.2:public-template/sample-application-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 200 (
    name: Use Cases
    alias: USE-CASES
    title: Use Cases
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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

    region use-cases-navigation (
        name: Use cases Navigation
        type: list
        source {
            list: @use-cases
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
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                t-MediaList--showBadges
            ]
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
                page: 201
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button prev (
        buttonName: PREV
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 103
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
