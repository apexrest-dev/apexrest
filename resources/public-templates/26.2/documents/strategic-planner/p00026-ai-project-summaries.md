# AI Project Summaries — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00026-ai-project-summaries.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c398b3c925c3c35bc8fac4c4e7ce56efb69f9630a4fbe5d08cd5c6b795994aee.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 26 (
    name: AI Project Summaries
    alias: AI-PROJECT-SUMMARIES
    title: AI Summaries
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    config {
        buildOption: @ai-project-summaries-view
    }

    region ai-summaries (
        name: AI Summaries
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select sys.dbms_lob.substr(DETAILS_SENT,3000)||
                           case when length(details_sent) > 3000
                            then ' ...'
                            end details_sent,
                       case when summary_type = 'full'
                            then 'Full Summary'
                            else 'Summary Update'
                            end user_name,
                       '<b>'||decode(risk,'None','No',apex_escape.html(risk))||' risk</b><br/>'||replace(apex_escape.html_clob(summary), CHR(10), '<br/>') comment_text,
                       '<br/>'||HIGHLIGHTS attribute_1,
                       null attribute_2,
                       null attribute_3,
                       null attribute_4,
                       CREATED comment_date,
                       substr(risk,1,1) user_icon,
                       case risk when 'None'
                                 then 'u-color-29'
                                 when 'High'
                                 then 'u-color-39'
                                 when 'Medium'
                                 then 'u-color-23'
                                 else 'u-color-5' 
                                 end icon_modifier,
                       id ai_summary_id,
                       'Details' actions
                  from SP_PROJECT_AI_SUMMARIES
                 where PROJECT_ID = :P26_PROJECT_ID
                   and summary is not null  -- excludes those ending in error
                 order by created desc
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        reportLayout {
            numberOfRows: 50
        }
        componentAppearance {
            template: @/comments
            templateOptions: [
                #DEFAULT#
                t-Comments--chat
            ]
        }
        performance {
            maxRowsToProcess: 500
        }
        messages {
            whenNoDataFound: No Summaries found
        }

        column ACTIONS (
            reportColumnQueryId: 12
            derivedColumn: N
            type: link
            heading {
                heading: Actions
            }
            layout {
                sequence: 120
            }
            link {
                target: {
                    page: 84
                    items: {
                        P84_ID: #AI_SUMMARY_ID#
                    }
                }
                linkText: #ACTIONS#
                linkAttributes: title="View Details Sent"
            }
            sorting {
                sortable: false
            }
        )

        column AI_SUMMARY_ID (
            reportColumnQueryId: 11
            derivedColumn: N
            heading {
                heading: Ai Summary Id
                alignment: end
            }
            layout {
                sequence: 180
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column ATTRIBUTE_1 (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Attribute 1
            }
            layout {
                sequence: 90
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
            }
        )

        column ATTRIBUTE_2 (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Attribute 2
            }
            layout {
                sequence: 140
            }
            sorting {
                sortable: false
            }
        )

        column ATTRIBUTE_3 (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Attribute 3
            }
            layout {
                sequence: 150
            }
            sorting {
                sortable: false
            }
        )

        column ATTRIBUTE_4 (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Attribute 4
            }
            layout {
                sequence: 160
            }
            sorting {
                sortable: false
            }
        )

        column COMMENT_DATE (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Comment Date
            }
            layout {
                sequence: 100
            }
            appearance {
                formatMask: SINCE
            }
            sorting {
                sortable: false
            }
        )

        column COMMENT_TEXT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Comment Text
            }
            layout {
                sequence: 80
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
            }
        )

        column DETAILS_SENT (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 50
            }
        )

        column ICON_MODIFIER (
            reportColumnQueryId: 10
            derivedColumn: N
            heading {
                heading: Icon Modifier
            }
            layout {
                sequence: 170
            }
            sorting {
                sortable: false
            }
        )

        column USER_ICON (
            reportColumnQueryId: 9
            derivedColumn: N
            heading {
                heading: User Icon
            }
            layout {
                sequence: 130
            }
            sorting {
                sortable: false
            }
        )

        column USER_NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: User Name
            }
            layout {
                sequence: 110
            }
            sorting {
                sortable: false
            }
        )

    )

    region buttons (
        name: buttons
        type: staticContent
        layout {
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    pageItem P26_PROJECT (
        type: displayOnly
        label {
            alignment: left
        }
        layout {
            sequence: 20
            region: @ai-summaries
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P26_PROJECT_ID (
        type: hidden
        layout {
            sequence: 10
            region: @ai-summaries
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button generate-full (
        buttonName: GENERATE_FULL
        label: Generate Full Summary
        layout {
            sequence: 20
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
        security {
            authorizationScheme: @contribution-rights
        }
        config {
            buildOption: @ai-project-summaries-create
        }
    )

    button generate-update (
        buttonName: GENERATE_UPDATE
        label: Generate Update
        layout {
            sequence: 40
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from sp_project_ai_summaries
                 where project_id = :P26_PROJECT_ID
                   and summary is not null
                ```
        }
        security {
            authorizationScheme: @contribution-rights
        }
        config {
            buildOption: @ai-project-summaries-create
        }
    )

    button information (
        buttonName: Information
        label: Info
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-info-circle-o
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 78
                items: {
                    P78_TYPE: PROJECT
                }
                clearCache: 78
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    computation p26-project (
        itemName: P26_PROJECT
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select project
                  from sp_projects
                 where id = :P26_PROJECT_ID
                ```
        }
    )

    process full-summary (
        name: full summary
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                    l_error_yn  varchar2(1);
                    l_ai_id     number;
                begin
                
                sp_summary_util.generate_project_summary (
                    p_project_id   => :P26_PROJECT_ID,
                    p_summary_type => 'full',
                    p_ai_id        => l_ai_id,
                    p_error_yn     => l_error_yn );
                
                end;
                ```
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 28144103102563468673
        }
        serverSideCondition {
            whenButtonPressed: @generate-full
        }
        security {
            authorizationScheme: @contribution-rights
        }
    )

    process update (
        name: update
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                    l_error_yn  varchar2(1);
                    l_ai_id     number;
                begin
                
                sp_summary_util.generate_project_summary (
                    p_project_id   => :P26_PROJECT_ID,
                    p_summary_type => 'update',
                    p_ai_id        => l_ai_id,
                    p_error_yn     => l_error_yn );
                
                end;
                ```
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 28130226675592637034
        }
        serverSideCondition {
            whenButtonPressed: @generate-update
        }
        security {
            authorizationScheme: @contribution-rights
        }
    )

)


````
