# Reference — Sample Charts

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-charts/apexlang/sample-charts/pages/p00028-reference.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 4bd01d5da182ba29ad7ee4e285aaeae1d0b3d834522f255208b163ec1135ccf2.

Application dependency inventory: oracle:26.2:public-template/sample-charts/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 28 (
    name: Reference
    alias: REFERENCE
    title: Reference
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region reference (
        name: Reference
        type: list
        source {
            list: @reference-js
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
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
                margin-top-none
                margin-bottom-none
                margin-left-none
                margin-right-none
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
                t-MediaList--cols t-MediaList--2cols
            ]
        }
    )

    region reference-2 (
        name: Reference
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

)


````
