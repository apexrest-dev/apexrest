# Advanced — Apex Pwa Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apex-pwa-reference/apexlang/apex-pwa-reference/pages/p00020-advanced.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 180c8cfa36d9e27afb89ad3622fe7fea5c2d17678e57690e574aa1cbd5472930.

Application dependency inventory: oracle:26.2:public-template/apex-pwa-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 20 (
    name: Advanced
    alias: ADVANCED
    title: Advanced
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
        formAutoComplete: true
    }

    region advanced (
        name: Advanced
        type: list
        source {
            list: @advanced
        }
        layout {
            sequence: 40
            slot: body
            columnCssClasses: [
                col-lg-10
                col-xl-8
                col-xxl-8
            ]
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h1
                t-ContentBlock--lightBG
                t-ContentBlock--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: t-MediaList--showIcons
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 60
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

)


````
