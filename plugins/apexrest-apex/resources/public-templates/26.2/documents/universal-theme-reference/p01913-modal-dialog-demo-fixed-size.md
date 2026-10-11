# Modal Dialog Demo - Fixed Size — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01913-modal-dialog-demo-fixed-size.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 36af9776a2fbcb8f72f11b60102731b9c2de77fe6c7981a1c0cd506f125110e8.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1913 (
    name: Modal Dialog Demo - Fixed Size
    alias: MODAL-DIALOG-DEMO-FIXED-SIZE
    title: Fixed Height Modal Dialog
    pageGroup: @components
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        height: 400
        resizable: false
    }
    security {
        authentication: public
    }

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This modal dialog has a fixed height of 400px and will not automatically resize to fit its contents.  This type of dialog is useful for wizards where the navigation buttons should remain in a constant position.</p>
                <p>To set a height for a modal dialog page, simply set the "Height" property for the page in the Property Editor.</p>
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                js-useLocalStorage
                is-expanded
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

)


````
