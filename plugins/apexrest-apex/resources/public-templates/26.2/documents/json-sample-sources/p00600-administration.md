# Administration — Json Sample Sources

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/pages/p00600-administration.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 659e2f6a30ac47b66758f5e5fa394f215a1eb6a6cefad8981d38f3bbf4be1dcf.

Application dependency inventory: oracle:26.2:public-template/json-sample-sources/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 600 (
    name: Administration
    alias: ADMINISTRATION
    title: Administration
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
        deepLinking: false
    }
    help {
        helpText:
            ```html
            <p>The administration page allows application owners (Administrators) to configure the application and maintain common data used across the application.
            By selecting one of the available settings, administrators can potentially change how the application is displayed and/or features available to the end users.</p>
            <p>Access to this page should be limited to Administrators only.</p>
            ```
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
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        accessibility {
            landmarkType: navigation
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
