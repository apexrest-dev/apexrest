# Administration — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00036-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 4370c1f676255ac0298996263dff9bc1f781ef3f99ab376e9d77cc1fe7731298.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 36 (
    name: Administration
    alias: SETTINGS
    title: Administration
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

    region administration (
        name: Administration
        type: list
        source {
            list: @administration
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

)


````
