# Region - Hero — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01203-hero-region.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 941b53463c4090268763502a0987719c4651891f19a4a1e0ca28deac3816316a.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1203 (
    name: Region - Hero
    alias: HERO-REGION
    title: Hero Region - &APP_TITLE.
    pageGroup: @components
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: [
            dm-Page
            dm-Page--center
        ]
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

    region button-positions (
        name: Button Positions
        type: staticContent
        layout {
            sequence: 50
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region demo (
        name: Demo
        type: staticContent
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region hero (
        name: Hero
        type: staticContent
        source {
            htmlCode: <p>This is a Hero region</p>
        }
        layout {
            sequence: 30
            parentRegion: @demo
            slot: subRegions
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-map-pin-heart
        }
        advanced {
            htmlDomId: Demo1
        }
    )

    region hero-region-with-buttons (
        name: Hero Region With Buttons
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @button-positions
            slot: subRegions
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-pie-chart
        }
    )

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            staticId: Demo1
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>Capture your users' attention on homepage, dashboard, and other introductory-style pages. This region template displays an icon, heading and sub headings, and buttons.</p>
        }
        layout {
            sequence: 10
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
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
            slot: breadcrumbBar
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

    region template-options (
        name: Template Options
        type: plugin/previewTemplateOptions
        layout {
            sequence: 30
            slot: body
            startNewRow: false
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        settings {
            staticId: Demo1
        }
    )

    button button (
        buttonName: Button
        label: Button
        layout {
            sequence: 10
            region: @hero-region-with-buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

)


````
