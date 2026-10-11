# Wizard Dialog Page — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01112-wizard-dialog-page.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 20524078517b125ad39b643129f21d0a3773e32fe6ffd14d65a982469ef7ebbd.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1112 (
    name: Wizard Dialog Page
    alias: WIZARD-DIALOG-PAGE
    title: Wizard Dialog Page - &APP_TITLE.
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
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
            slot: wizardBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: dm-Placeholder
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
            slot: wizardBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            cssClasses: dm-Placeholder
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-footer (
        name: Region Footer
        type: staticContent
        layout {
            sequence: 10
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region wizard-progress (
        name: Wizard Progress
        type: list
        source {
            list: @ut-wizard-progress
        }
        layout {
            sequence: 10
            slot: wizardProgressBar
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            listTemplate: @/wizard-progress
            templateOptions: [
                #DEFAULT#
                t-WizardSteps--displayLabels
            ]
        }
    )

    button next-step (
        buttonName: NEXT_STEP
        label: Next
        layout {
            sequence: 30
            region: @region-footer
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
                t-Button--iconRight
            ]
            icon: fa-chevron-right
        }
        behavior {
            action: definedByDynamicAction
        }
        advanced {
            htmlDomId: next_button
        }
    )

    button prev-step (
        buttonName: PREV_STEP
        label: Previous
        layout {
            sequence: 10
            region: @region-footer
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
            icon: fa-chevron-left
        }
        behavior {
            action: definedByDynamicAction
        }
        advanced {
            htmlDomId: prev_button
        }
    )

    dynamicAction close-dialog (
        name: Close Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: jQuerySelector
            jquerySelector: #prev_button, #next_button
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
