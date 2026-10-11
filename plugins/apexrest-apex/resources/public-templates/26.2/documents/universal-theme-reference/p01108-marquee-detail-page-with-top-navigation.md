# Marquee Detail Page with Top Navigation — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01108-marquee-detail-page-with-top-navigation.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 12ed414e30c886e2b8e6d75bbd54231de1306bec81e069d378422d4f555c058d.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1108 (
    name: Marquee Detail Page with Top Navigation
    alias: MARQUEE-DETAIL-PAGE-WITH-TOP-NAVIGATION
    title: Marquee Detail Page with Top Navigation - &APP_TITLE.
    appearance {
        pageTemplate: @/marquee
        templateOptions: #DEFAULT#
    }
    navigationMenu {
        overrideUserInterfaceLevel: true
        list: @ut-sample-navigation-menu
        listPosition: top
        listTemplate: @/top-navigation-menu
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

    region main-content (
        name: Main Content
        type: staticContent
        source {
            htmlCode:
                ```html
                <span class="a-Icon icon-template-report"></span>
                <h3>Main Content Report</h3>
                ```
        }
        layout {
            sequence: 10
            slot: masterDetail
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h240
            ]
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
                h320
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
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h320
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-c (
        name: Region C
        type: staticContent
        source {
            htmlCode:
                ```html
                <span class="a-Icon icon-template-region"></span>
                <h3>Region C</h3>
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
                h320
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-display-selector (
        name: Region Display Selector
        type: regionDisplaySelector
        layout {
            sequence: 20
            slot: masterDetail
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    region side-content (
        name: Side Content
        type: staticContent
        source {
            htmlCode:
                ```html
                <span class="a-Icon icon-template-region"></span>
                <h3>Side Region</h3>
                ```
        }
        layout {
            sequence: 10
            slot: rightSideColumn
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: dm-Placeholder
        }
    )

)


````
