# Poll - redirects to p50 for authenticated polls — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00500-poll-redirects-to-p50-for-authenticated-polls.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 26c069f0a56f2a1f0b0cee855401b0f1fbaf83ff533169fa0a0837e691289b33.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 500 (
    name: Poll - redirects to p50 for authenticated polls
    alias: POLL-REDIRECTS-TO-P50-FOR-AUTHENTICATED-POLLS
    title: Poll
    pageGroup: @polls
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    branch (
        name: branch to page 50
        execution {
            sequence: 10
            point: beforeHeader
        }
        behavior {
            target: {
                page: 50
                clearCache: 50
                successMessage: false
            }
        }
    )

)


````
