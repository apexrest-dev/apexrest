# Standard Dialog Page — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01111-standard-dialog-page.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 72d04cc8055759bb27861592cd0eefc53ce6e76c59b70a45893e329583dfabce.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1111 (
    name: Standard Dialog Page
    alias: STANDARD-DIALOG-PAGE
    title: Standard Dialog Page - &APP_TITLE.
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
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
            slot: contentBody
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
            slot: contentBody
            startNewRow: false
            newColumn: false
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
            slot: contentBody
            startNewRow: false
            newColumn: false
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

)


````
