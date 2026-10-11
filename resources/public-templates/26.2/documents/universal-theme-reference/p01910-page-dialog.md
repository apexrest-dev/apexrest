# Page Dialog — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01910-page-dialog.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f12712568257ff22b5b15e4a51a55f5d4ae807803fc4a90bcd4a32694e8ec1bb.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1910 (
    name: Page Dialog
    alias: PAGE-DIALOG
    title: Page Dialog - &APP_TITLE.
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

    region demo (
        name: Demo
        type: staticContent
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
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>A <strong>modal dialog</strong> is an overlay window positioned within the same browser window. A modal dialog remains active and focused until the user has finished with it and closes it. While a modal dialog is active, the user is unable to interact with the rest of the page until the dialog is closed.</p>
                <p class="dm-Hero-steps">Set <strong>Modal Dialog</strong> as the Page Mode under Page Definition.</p>
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

    region region-positions (
        name: Region Positions
        type: staticContent
        source {
            htmlCode:
                ```html
                <p><strong>Dialog Header</strong><br/>
                This region position is anchored to the top and is useful for components such as a wizard progress bar.</p>
                <p><strong>Content Body</strong><br/>
                Place all of your content regions in this position.</p>
                <p><strong>Dialog Footer</strong><br/>
                This region position is anchored to the bottom of the dialog and is useful for placing buttons using the Buttons Container region template.</p>
                ```
        }
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
                t-ContentBlock--padded
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    button open-auto-size (
        buttonName: OPEN_AUTO_SIZE
        label: Dialog with Auto Size
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
            action: redirectThisApp
            target: {
                page: 1912
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button open-fit-dialog (
        buttonName: OPEN_FIT_DIALOG
        label: Fit to Screen Dialog
        layout {
            sequence: 30
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
            action: redirectThisApp
            target: {
                page: 1914
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button open-fixed (
        buttonName: OPEN_FIXED
        label: Dialog with Fixed Size
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
            action: redirectThisApp
            target: {
                page: 1913
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
