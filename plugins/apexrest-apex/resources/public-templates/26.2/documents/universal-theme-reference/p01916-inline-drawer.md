# Inline Drawer — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01916-inline-drawer.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2e93e70aae34abac4448e036e8126fbc5dbd4d25e530168a91668f9ea252a0c4.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1916 (
    name: Inline Drawer
    alias: INLINE-DRAWER
    title: Inline Drawer
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

    region auto-width (
        name: Auto Width
        type: staticContent
        source {
            htmlCode: Set the Template Option Size to "None".
        }
        layout {
            sequence: 60
            slot: dialogsDrawersAndPopups
        }
        appearance {
            template: @/inline-drawer
            templateOptions: [
                #DEFAULT#
                js-dialog-nosize
                js-dialog-class-t-Drawer--pullOutStart
            ]
        }
        advanced {
            htmlDomId: drawer_auto
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

    region fixed-width (
        name: Fixed Width
        type: staticContent
        source {
            htmlCode: This is a drawer that is using the Extra Large size.
        }
        layout {
            sequence: 70
            slot: dialogsDrawersAndPopups
        }
        appearance {
            template: @/inline-drawer
            templateOptions: [
                #DEFAULT#
                js-dialog-class-t-Drawer--md
                js-dialog-class-t-Drawer--pullOutEnd
            ]
        }
        advanced {
            htmlDomId: drawer_fixed
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>An <strong>inline drawer</strong> displays a region on the current page within a modal dialog that pulls out from the sides of the screen. </p>
                <p class="dm-Hero-steps">Create a region, set its "Position" attribute to Inline Dialogs, and use <strong>Inline Drawer</strong> as its Region template.</p>
                ```
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

    button cancel (
        buttonName: CANCEL_1
        label: Cancel
        layout {
            sequence: 10
            region: @auto-width
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

    button cancel-2 (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 30
            region: @fixed-width
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

    button ok (
        buttonName: OK
        label: OK
        layout {
            sequence: 10
            region: @fixed-width
            slot: create
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

    button ok-2 (
        buttonName: OK_1
        label: OK
        layout {
            sequence: 20
            region: @auto-width
            slot: create
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

    button open-auto-size (
        buttonName: OPEN_AUTO_SIZE
        label: Inline Drawer with Auto Size
        layout {
            sequence: 10
            region: @demo
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:openModal('drawer_auto')
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button open-fixed (
        buttonName: OPEN_FIXED
        label: Inline Drawer with Fixed Size
        layout {
            sequence: 20
            region: @demo
            slot: regionBody
            startNewRow: false
            newColumn: false
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--gapLeft
            ]
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:openModal('drawer_fixed')
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction close-auto-width-drawer (
        name: Close Auto Width Drawer
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-close-region (
            action: closeRegion
            affectedElements {
                selectionType: region
                region: @auto-width
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction close-auto-width-drawer-2 (
        name: Close Auto Width Drawer_1
        execution {
            sequence: 30
        }
        when {
            event: click
            selectionType: button
            button: @ok-2
        }

        action native-close-region (
            action: closeRegion
            affectedElements {
                selectionType: region
                region: @auto-width
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction close-fixed-width-drawer (
        name: Close Fixed Width Drawer
        execution {
            sequence: 20
        }
        when {
            event: click
            selectionType: button
            button: @cancel-2
        }

        action native-close-region (
            action: closeRegion
            affectedElements {
                selectionType: region
                region: @fixed-width
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction close-fixed-width-drawer-2 (
        name: Close Fixed Width Drawer_1
        execution {
            sequence: 40
        }
        when {
            event: click
            selectionType: button
            button: @ok
        }

        action native-close-region (
            action: closeRegion
            affectedElements {
                selectionType: region
                region: @fixed-width
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
