# Navigation Menu - Mega Menu Preview — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01122-navigation-menu-mega-menu-preview.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 09e73ac884bb27d42a14016745ef75c51790fa6f15b1c48bbfc487dceb958c83.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1122 (
    name: Navigation Menu - Mega Menu Preview
    alias: NAVIGATION-MENU-MEGA-MENU-PREVIEW
    title: Navigation Menu - Mega Menu Preview
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigationMenu {
        overrideUserInterfaceLevel: true
        list: @ut-sample-navigation-mega-menu
        listPosition: top
        listTemplate: @/top-navigation-mega-menu
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    javaScript {
        executeWhenPageLoads: apex.theme42demo.noNavigate();
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

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
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

    region region-a (
        name: Region A
        type: staticContent
        source {
            htmlCode:
                ```html
                <span class="a-Icon icon-template-region"></span>
                <h3>Region A</h3>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h180
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-b (
        name: Region B
        type: staticContent
        source {
            htmlCode:
                ```html
                <span class="a-Icon icon-template-region"></span>
                <h3>Region B</h3>
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h180
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-b-2 (
        name: Region B
        type: staticContent
        source {
            htmlCode:
                ```html
                <span class="a-Icon icon-template-region"></span>
                <h3>Region B</h3>
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h180
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

)


````
