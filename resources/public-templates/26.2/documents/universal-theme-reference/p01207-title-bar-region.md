# Region - Title Bar — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01207-title-bar-region.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 61a3800ac128a6321b95b0e2c1f1f68e125fde7c2ddf72bdf61bdc8552bd5f20.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1207 (
    name: Region - Title Bar
    alias: TITLE-BAR-REGION
    title: Title Bar Region - &APP_TITLE.
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
            sequence: 40
            slot: body
            columnSpan: 12
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

    region demo (
        name: Demo
        type: staticContent
        layout {
            sequence: 20
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
            sequence: 20
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
            staticId: Demo1
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>Group breadcrumbs, page title, and primary page actions at the top of the page.</p>
        }
        layout {
            sequence: 10
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

    region title-bar-title (
        name: Title Bar Title
        type: staticContent
        source {
            htmlCode: Components
        }
        layout {
            sequence: 10
            parentRegion: @demo
            slot: subRegions
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useRegionTitle
            ]
        }
        advanced {
            htmlDomId: Demo1
        }
    )

    region title-bar-with-buttons (
        name: Title Bar With Buttons
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
        }
        layout {
            sequence: 10
            parentRegion: @button-positions
            slot: subRegions
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useRegionTitle
            ]
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    button change (
        buttonName: CHANGE
        label: Change
        layout {
            sequence: 40
            region: @title-bar-with-buttons
            slot: change
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button close (
        buttonName: CLOSE
        label: Close
        layout {
            sequence: 70
            region: @title-bar-with-buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button copy (
        buttonName: COPY
        label: Copy
        layout {
            sequence: 20
            region: @title-bar-with-buttons
            slot: copy
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button create (
        buttonName: CREATE
        label: Create
        layout {
            sequence: 10
            region: @title-bar-with-buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 60
            region: @title-bar-with-buttons
            slot: delete
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--simple
            ]
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button edit (
        buttonName: EDIT
        label: Edit
        layout {
            sequence: 30
            region: @title-bar-with-buttons
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button help (
        buttonName: HELP
        label: Help
        layout {
            sequence: 50
            region: @title-bar-with-buttons
            slot: help
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 90
            region: @title-bar-with-buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Previous
        layout {
            sequence: 80
            region: @title-bar-with-buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

)


````
