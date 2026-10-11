# Administration — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00500-administration1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a3cbdc50bbaa5136b404f0fc9b512bc790a96f8bb98310d1fb50fbde3ace7989.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 500 (
    name: Administration
    alias: ADMINISTRATION1
    title: Administration
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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

    region administration-settings (
        name: Administration Settings
        type: list
        source {
            list: @user-interface
        }
        layout {
            sequence: 50
            parentRegion: @column
            slot: regionBody
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

    region column (
        name: Column 1
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
    )

)


````
