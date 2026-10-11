# Custom Vector Search — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00024-custom-vector-search.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 57fbe2203b3d50ade30eed99620eb060c0cc367ec2a79864cc72226dd5e6a7fa.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 24 (
    name: Custom Vector Search
    alias: CUSTOM-VECTOR-SEARCH
    title: Custom Vector Search
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

    region custom-vector-search-navigation (
        name: " Custom Vector Search Navigation"
        type: list
        source {
            list: @custom-vector-search
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
            landmarkLabel: Custom
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                t-MediaList--showBadges
            ]
        }
    )

)


````
