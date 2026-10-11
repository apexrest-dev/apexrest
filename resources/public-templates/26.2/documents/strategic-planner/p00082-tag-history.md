# Tag History — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00082-tag-history.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 9fda80bfea08756e83662c5bd7f31d29730a8e4c30bc186ab7bf3a13e846cecb.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 82 (
    name: Tag History
    alias: TAG-HISTORY
    title: Tag History
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }

    region tag-changes (
        name: Tag Changes
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select sp_tag_diff(apex_escape.html(old_value),apex_escape.html(new_value)) tag_changes,
                       apex_util.get_since(CHANGED_ON) || ' - '|| CHANGED_BY  changed
                  from SP_PROJECT_HISTORY
                 where project_id = :P82_ID and 
                       attribute_column = 'TAGS' and 
                       (
                           upper(replace(old_value,' ',null)) != upper(replace(new_value,' ',null)) or
                           old_value is null
                       )
                order by CHANGED_ON desc
                ```
            pageItemsToSubmit: P82_ID
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        reportLayout {
            numberOfRows: 150
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--noBorders
            ]
        }
        pagination {
            type: showAll
        }
        messages {
            whenNoDataFound: None Found
        }
        heading {
            type: none
        }

        column CHANGED (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Changed
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column TAG_CHANGES (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Tag Changes
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
            }
        )

    )

    pageItem P82_ID (
        type: hidden
        layout {
            sequence: 10
            region: @tag-changes
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction(
                    p_project_id => :P82_ID);
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1436909259686951738
        }
    )

)


````
