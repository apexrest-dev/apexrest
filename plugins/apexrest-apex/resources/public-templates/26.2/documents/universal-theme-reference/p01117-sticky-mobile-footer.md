# Sticky Mobile Footer — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01117-sticky-mobile-footer.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 61184b7184581588e549b5218421969597e380840715590f3711b2da0e681110.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1117 (
    name: Sticky Mobile Footer
    alias: STICKY-MOBILE-FOOTER
    title: Sticky Mobile Footer
    appearance {
        pageTemplate: @/standard
        templateOptions: [
            #DEFAULT#
            js-pageStickyMobileHeader
        ]
    }
    navigationMenu {
        overrideUserInterfaceLevel: true
        list: @ut-sample-navigation-menu
        listPosition: side
        listTemplate: @/side-navigation-menu
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
        pageAccessProtection: unrestricted
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

    region page-footer (
        name: Page Footer 2
        type: staticContent
        source {
            htmlCode: Page Footer
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--stickToBottom
                t-ButtonRegion--slimPadding
            ]
            cssClasses: u-tC
        }
        advanced {
            regionDisplaySelector: true
        }
        serverSideCondition {
            type: request=Value
            value: sample2
        }
    )

    region page-footer-2 (
        name: Page Footer 1
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--stickToBottom
                t-ButtonRegion--slimPadding
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        serverSideCondition {
            type: request=Value
            value: sample1
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
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h480
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
            sequence: 30
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h480
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
            sequence: 40
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: [
                dm-Placeholder
                h480
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    button button-a (
        buttonName: BUTTON_A
        label: Button A
        layout {
            sequence: 10
            region: @page-footer
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
            ]
            icon: fa-list-ul
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button button-b (
        buttonName: BUTTON_B
        label: Button B
        layout {
            sequence: 20
            region: @page-footer
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            hot: true
            templateOptions: #DEFAULT#
            icon: fa-pencil-square-o
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button menu (
        buttonName: MENU
        label: Menu
        layout {
            sequence: 10
            region: @page-footer-2
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconRight
            ]
            icon: fa-bars
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Back
        layout {
            sequence: 20
            region: @page-footer-2
            slot: previous
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconLeft
            ]
            icon: fa-chevron-circle-left
        }
        behavior {
            action: definedByDynamicAction
        }
    )

)


````
