# Redirect — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p00100-redirect.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6dfd8ef3ed6d3ecfe9d3862a49fa667e46462b53b4ec28cd4b51c7d1cc0c1698.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 100 (
    name: Redirect
    alias: REDIRECT
    title: Redirect
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
    }

    branch (
        name: Go To Page 500
        execution {
            sequence: 10
            point: beforeHeader
        }
        behavior {
            target: {
                page: 500
                successMessage: false
            }
        }
        comments {
            comments: This is an legacy page that was referenced in the docs. We keep it so that older doc versions can still work.
        }
    )

)


````
