# AI Summary Information — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00078-ai-summary-information.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d0bc9a7d6451336285541b564925226363ee5414956d1160895e2e337fb2a332.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 78 (
    name: AI Summary Information
    alias: AI-SUMMARY-INFORMATION
    title: AI Summary Information
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        chained: false
    }

    region information (
        name: Information
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                return apex_markdown.to_html (
                    p_markdown => sp_summary_util.ai_summary_info(p_type => :P78_TYPE) );
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

    pageItem P78_TYPE (
        type: hidden
        layout {
            sequence: 10
            region: @information
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
