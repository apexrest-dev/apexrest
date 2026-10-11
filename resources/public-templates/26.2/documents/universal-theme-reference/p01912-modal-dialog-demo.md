# Modal Dialog Demo — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01912-modal-dialog-demo.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 727b35629078ec037f374e04bebc12295c03a02ae0da8d5820133f5e9a029420.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1912 (
    name: Modal Dialog Demo
    alias: MODAL-DIALOG-DEMO
    title: Auto Sizing Modal Dialog
    pageGroup: @components
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    security {
        authentication: public
    }

    region collapsible-region (
        name: Collapsible Region
        type: staticContent
        source {
            htmlCode:
                ```html
                <ul>
                  <li>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Veniam dolorum velit eos illum, voluptatem repellat animi dolores! Tempora fugit natus, odio vitae fuga amet commodi, architecto eaque aperiam hic! Illo!</li>
                  <li>Quidem dolorem totam consectetur, quis esse sequi non in praesentium illum fugit, provident voluptate perspiciatis voluptas a natus magnam sed accusamus omnis? Reiciendis dignissimos doloremque rem blanditiis. Reprehenderit, facere, velit!</li>
                  <li>Harum, modi eum suscipit numquam, molestiae laudantium. Ratione enim maiores placeat consequatur sed quam repellat, corporis ducimus magnam, aspernatur quas iusto reprehenderit assumenda ut architecto vel nostrum consequuntur velit sit.</li>
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
                is-collapsed
                t-Region--scrollBody
                margin-top-md
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
            htmlCode: <p>This dialog will automatically expand to fit its contents.  Try it out by by expanding the region below.</p>
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

)


````
