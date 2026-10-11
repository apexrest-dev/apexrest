# Opt Out Confirm — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00003-opt-out-confirm.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1d69d8009de051741ef5bb092d02ceabc85f7832a26cc335411cd801481495bd.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3 (
    name: Opt Out Confirm
    alias: OPT-OUT-CONFIRM
    title: Opt Out Confirm
    pageGroup: @opt-out
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            @media only screen and (max-width: 640px) {
            section.uRegion {
              width: auto !important;
            }
            }
            ```
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

    region hide-nobody (
        name: hide nobody
        type: staticContent
        source {
            htmlCode: "<style>.userBlock{display: none !important} .logoBarNav {padding-top: 8px;visibility: hidden;}</style>"
        }
        layout {
            sequence: 1
            slot: body-3
        }
        advanced {
            excludeTitleFromTranslation: true
        }
        serverSideCondition {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                if apex_authentication.is_authenticated then
                   return false;
                else
                   return true;
                end if;
                ```
        }
    )

    region opt-out-confirmed (
        name: Opt Out Confirmed
        type: staticContent
        source {
            htmlCode: <p>Your opt out preference has been received.</p>
        }
        layout {
            sequence: 10
            slot: body-3
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--warning
                t-Alert--horizontal
            ]
        }
    )

)


````
