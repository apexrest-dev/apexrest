# Use Cases — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00009-use-cases.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c2be85ab75f8a90dad116dcc1fc2963a1d9bd7c813602e5ad699a665f57cb1b6.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9 (
    name: Use Cases
    alias: USE-CASES
    title: Use Cases
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
        helpText: No help is available for this page.
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 40
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

    region report-use-cases (
        name: Report Use Cases
        type: list
        source {
            list: @report-use-cases
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
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        componentAppearance {
            listTemplate: @/cards
            templateOptions: [
                #DEFAULT#
                u-colors
                t-Cards--basic
                t-Cards--displayIcons
                t-Cards--cols
                t-Cards--desc-4ln
                t-Cards--animColorFill
            ]
        }
    )

)


````
