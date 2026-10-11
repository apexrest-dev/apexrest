# Breadcrumb — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p03810-breadcrumb.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 459dfbb6d00bf7b1e73035c3848bb0c3bf69f7a6335ee8fc52d15afbe6c5584c.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3810 (
    name: Breadcrumb
    alias: BREADCRUMB
    title: Breadcrumb - &APP_TITLE.
    pageGroup: @components
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

    region blank-region (
        name: Blank Region
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
        }
        layout {
            sequence: 10
            parentRegion: @within-the-blank-with-attributes-template
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: BreadcrumbDemo
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

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

    region demo (
        name: Demo
        type: staticContent
        layout {
            sequence: 50
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
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

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 40
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
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
            staticId: BreadcrumbDemo
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>A <strong>Breadcrumb</strong> is a hierarchical list of links that indicates where the user is within the application from a hierarchical perspective.  It is useful for providing navigational context to end users, and an easy way to navigate back to the home.  Within Universal Theme, the application breadcrumb has a special location for placement and should be used with the <a href="f?p=&APP_ID.:1207:&APP_SESSION.">Title Bar</a> region template in most cases.</p>
        }
        layout {
            sequence: 30
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
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
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    region title-bar (
        name: Title Bar
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
        }
        layout {
            sequence: 20
            parentRegion: @within-the-title-bar-template
            slot: subRegions
            startNewRow: false
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

    region within-the-blank-with-attributes-template (
        name: Within the Blank with Attributes Template
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @demo
            slot: subRegions
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--padded
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                js-headingLevel-3
            ]
        }
    )

    region within-the-title-bar-template (
        name: Within the Title Bar Template
        type: staticContent
        layout {
            sequence: 20
            parentRegion: @demo
            slot: subRegions
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                js-headingLevel-3
            ]
        }
    )

)


````
