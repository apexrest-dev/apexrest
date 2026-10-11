# Protected Page — Sample Email Authentication

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-email-authentication/apexlang/ema/pages/p00100-protected.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ef2366ed287903f0cda90d10e7fae414cdefab21000459363d134d313ef5f3d2.

Application dependency inventory: oracle:26.2:public-template/sample-email-authentication/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 100 (
    name: Protected Page
    alias: PROTECTED
    title: Protected Page
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    help {
        helpText: All application help text can be accessed from this page. The links in the "Documentation" region give a much more in-depth explanation of the application's features and functionality.
    }
    config {
        buildOption: @feature-about-page
    }

    region protected-content (
        name: Protected Content
        type: staticContent
        source {
            htmlCode: <p>This page would contain application logic that would only be accessible to users that have authenticated.</p>
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--padded
                t-ContentBlock--h1
                t-ContentBlock--lightBG
                js-headingLevel-1
            ]
        }
    )

)


````
