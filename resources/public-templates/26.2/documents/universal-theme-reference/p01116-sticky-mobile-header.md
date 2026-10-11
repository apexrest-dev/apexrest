# Sticky Mobile Header — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01116-sticky-mobile-header.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 93ce2aad4289d7452c0c3c4f91e65702ede93546ecd1f402e9ef3a5ad8d423cd.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1116 (
    name: Sticky Mobile Header
    alias: STICKY-MOBILE-HEADER
    title: Sticky Mobile Header
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
        listPosition: top
        listTemplate: @/top-navigation-tabs
        templateOptions: [
            #DEFAULT#
            t-NavTabs--inlineLabels-lg
            t-NavTabs--displayLabels-sm
        ]
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

    region header-buttons (
        name: Header Buttons
        type: staticContent
        source {
            htmlCode: Mobile Page Header
        }
        layout {
            sequence: 50
            slot: breadcrumbBar
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--slimPadding
                t-ButtonRegion--noUI
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        serverSideCondition {
            type: request=Value
            value: sample2
        }
    )

    region page-header (
        name: Page Header
        type: staticContent
        layout {
            sequence: 40
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-check-circle u-color-1
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
            sequence: 10
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
                h480
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    button actions (
        buttonName: ACTIONS
        label: Actions
        layout {
            sequence: 30
            region: @page-header
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconRight
            ]
            icon: fa-angle-down
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button back (
        buttonName: BACK
        label: Back
        layout {
            sequence: 10
            region: @header-buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
            ]
            icon: fa-chevron-circle-left
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button edit (
        buttonName: EDIT
        label: Edit
        layout {
            sequence: 20
            region: @header-buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--link
            ]
        }
        behavior {
            action: definedByDynamicAction
        }
    )

)


````
