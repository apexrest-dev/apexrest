# Region - Alert — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01202-alert-region.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 9318c569ea67506705425b092de4f346e741df41c396e2cc387e067e5db199f1.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1202 (
    name: Region - Alert
    alias: ALERT-REGION
    title: Alert - &APP_TITLE.
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

    region access-denied (
        name: Access Denied
        type: staticContent
        source {
            htmlCode: <p>You have insufficient privilege. Please contact your Administrator for more information.</p>
        }
        layout {
            sequence: 190
            parentRegion: @use-cases
            slot: subRegions
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--colorBG
                t-Alert--wizard
                t-Alert--customIcons
                t-Alert--danger
            ]
            icon: fa-warning
        }
    )

    region alert-region (
        name: Alert Region
        type: staticContent
        source {
            htmlCode: Region Body
        }
        layout {
            sequence: 140
            parentRegion: @default
            slot: subRegions
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--defaultIcons
                t-Alert--warning
                t-Alert--horizontal
            ]
        }
        accessibility {
            landmarkLabel: Default Example
        }
        advanced {
            htmlDomId: AlertDemo1
        }
    )

    region alert-region-2 (
        name: Alert Region
        type: staticContent
        source {
            htmlCode: Region Body
        }
        layout {
            sequence: 200
            parentRegion: @custom-icon
            slot: subRegions
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--customIcons
                t-Alert--info
                t-Alert--wizard
            ]
            icon: fa-cog
        }
        accessibility {
            landmarkLabel: Custom Icon Example
        }
        advanced {
            htmlDomId: AlertDemo2
        }
    )

    region alert-region-with-buttons (
        name: Alert Region with Buttons
        type: staticContent
        source {
            htmlCode: <p>Your request has been submitted successfully. Please check again later in 30 minutes.</p>
        }
        layout {
            sequence: 20
            parentRegion: @button-positions
            slot: subRegions
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--customIcons
                t-Alert--success
            ]
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

    region button-positions (
        name: Button Positions
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

    region custom-icon (
        name: Custom Icon
        type: staticContent
        layout {
            sequence: 50
            parentRegion: @demo
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                js-headingLevel-3
            ]
        }
    )

    region default (
        name: Default
        type: staticContent
        layout {
            sequence: 20
            parentRegion: @demo
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                js-headingLevel-3
            ]
        }
    )

    region demo (
        name: Demo
        type: staticContent
        layout {
            sequence: 40
            slot: body
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
                t-ContentBlock--shadowBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            staticId: AlertDemo1
        }
    )

    region order-created-successfully (
        name: Order Created Successfully
        type: staticContent
        source {
            htmlCode: <p>A confirmation email has been sent to you. This order will be delivered in one week.</p>
        }
        layout {
            sequence: 180
            parentRegion: @use-cases
            slot: subRegions
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--colorBG
                t-Alert--wizard
                t-Alert--customIcons
                t-Alert--success
            ]
            icon: fa-check-circle
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>Use the Alert region template to display alerts, confirmations, and other action-oriented messages within the context of a page.</p>
        }
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
            parentRegion: @demo
            slot: subRegions
            startNewRow: false
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: Default Template Options
        }
        settings {
            staticId: AlertDemo1
        }
    )

    region template-options-2 (
        name: Template Options
        type: plugin/previewTemplateOptions
        layout {
            sequence: 60
            parentRegion: @demo
            slot: subRegions
            startNewRow: false
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: Custom Icon Template Options
        }
        settings {
            staticId: AlertDemo2
        }
    )

    region use-cases (
        name: Use Cases
        type: staticContent
        layout {
            sequence: 60
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

    button close (
        buttonName: Close
        label: Close
        layout {
            sequence: 60
            region: @alert-region-with-buttons
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

    button contact (
        buttonName: Contact
        label: Contact Administrator
        layout {
            sequence: 10
            region: @access-denied
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button continue (
        buttonName: Continue
        label: Continue Shopping
        layout {
            sequence: 10
            region: @order-created-successfully
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

    button create (
        buttonName: Create
        label: Create
        layout {
            sequence: 10
            region: @alert-region-with-buttons
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

    button next (
        buttonName: Next
        label: Next
        layout {
            sequence: 90
            region: @alert-region-with-buttons
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

    button previous (
        buttonName: Previous
        label: Previous
        layout {
            sequence: 70
            region: @alert-region-with-buttons
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

    button view (
        buttonName: View
        label: View Order
        layout {
            sequence: 20
            region: @order-created-successfully
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconRight
            ]
            icon: fa-chevron-right
        }
        behavior {
            action: definedByDynamicAction
        }
    )

)


````
