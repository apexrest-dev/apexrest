# Drawer Demo - Fixed Size — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01919-drawer-demo-fixed-size.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ea163d52f66f20204ca44dc04bda1ea1a59d69fa1a7a92982392b4e61b3c65d3.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1919 (
    name: Drawer Demo - Fixed Size
    alias: DRAWER-DEMO-FIXED-SIZE
    title: Drawer Demo - Fixed Size
    pageGroup: @components
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    dialog {
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
                <p>This drawer has a fixed width of 400px and will not automatically resize to fit its contents.  This type of drawer is useful for wizards where the navigation buttons should remain in a constant position.</p>
                <p>To set a width for a drawer page, simply set the "Width" property for the page in the Property Editor.</p>
                ```
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
