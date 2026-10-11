# Setup — Sample Approvals

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-approvals/apexlang/sample-workflow-approvals/pages/p00021-setup.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7f4cfa1ac68a9c166f76ba9ec11fc34a7ee78ee9470d302f4b628e83ef856ad3.

Application dependency inventory: oracle:26.2:public-template/sample-approvals/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 21 (
    name: Setup
    alias: SETUP
    title: Setup
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region setup (
        name: Setup
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

    region setup-2 (
        name: Setup
        type: list
        source {
            list: @user-interface
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
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
        }
        config {
            buildOption: @feature-theme-style-selection
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
        }
    )

)


````
