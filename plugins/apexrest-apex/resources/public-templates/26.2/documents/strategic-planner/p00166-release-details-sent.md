# Release Details Sent — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00166-release-details-sent.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e5621cdaaaf088da521da89a745383b95a87174c8ea667996b438caa3eb35d76.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 166 (
    name: Release Details Sent
    alias: RELEASE-DETAILS-SENT
    title: Release Details Sent
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        chained: false
    }
    config {
        buildOption: @ai-release-summaries-view
    }

    region details-sent (
        name: Details Sent
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                for c1 in (
                    select prompt_sent, details_sent
                      from sp_release_ai_summaries
                     where id = :P166_ID
                ) loop
                
                    return apex_markdown.to_html ( p_markdown => c1.details_sent );
                
                end loop;
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
    )

    pageItem P166_ID (
        type: hidden
        layout {
            sequence: 10
            region: @details-sent
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
