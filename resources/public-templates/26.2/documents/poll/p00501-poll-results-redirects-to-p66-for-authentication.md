# Poll Results - redirects to p66 for authentication — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00501-poll-results-redirects-to-p66-for-authentication.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 410dfa1ad0b550e20811dc027bf7f828cc5750e9f2bf3f9fb5f283df8398a052.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 501 (
    name: Poll Results - redirects to p66 for authentication
    alias: POLL-RESULTS-REDIRECTS-TO-P66-FOR-AUTHENTICATION
    title: Poll Results
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
        name: branch to page 66
        execution {
            sequence: 10
            point: beforeHeader
        }
        behavior {
            target: {
                page: 66
                clearCache: 66
                successMessage: false
            }
        }
    )

)


````
