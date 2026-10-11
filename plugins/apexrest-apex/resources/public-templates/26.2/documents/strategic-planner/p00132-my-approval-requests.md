# My Approval Requests — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00132-my-approval-requests.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e4aa652f5424beeca9f1d5294efcf8bc95e75e23c5a2e6bc2980e558bdc307fc.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 132 (
    name: My Approval Requests
    alias: MY-APPROVAL-REQUESTS
    title: My Approval Requests
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    config {
        buildOption: @approvals
    }

    region more-info-pending (
        name: More Info Pending
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select p.id, 
                       p.project,
                       t.approval_type,
                       m.first_name||' '||m.last_name requested_by,
                       c.comments
                  from sp_project_approval_chain c,
                       sp_project_approvals a,
                       sp_projects p,
                       sp_team_members m,
                       sp_approval_types t
                 where a.id = c.project_approval_id
                   and c.status = 'CLARIFICATION-REQUESTED'
                   and a.status = 'CLARIFICATION-REQUESTED'
                   and c.final_yn = 'Y'
                   and a.submitted_by_team_member_id = :APP_USER_ID
                   and a.project_id = p.id
                   and a.approval_type_id = t.id    
                   and c.team_member_id = m.id
                 order by c.last_status_on
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression:
                ```plsql
                sp_approvals.more_info_pending_cnt (
                    p_team_member_id => :APP_USER_ID ) > 0
                ```
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }
        pagination {
            type: showAll
        }

        column APPROVAL_TYPE (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Approval Type
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column COMMENTS (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Comments
            }
            layout {
                sequence: 50
            }
            sorting {
                sortable: false
            }
        )

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column PROJECT (
            reportColumnQueryId: 2
            derivedColumn: N
            type: link
            heading {
                heading: Project
            }
            layout {
                sequence: 20
            }
            link {
                target: {
                    page: 3
                    items: {
                        P3_PROJECT_ID: #ID#
                    }
                    clearCache: 3
                }
                linkText: #PROJECT#
            }
            sorting {
                sortable: false
            }
        )

        column REQUESTED_BY (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Requested By
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )

    )

    region pending-requests (
        name: Pending Requests
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select p.id, 
                       p.project,
                       t.approval_type,
                       m.first_name||' '||m.last_name submitted_by
                  from sp_project_approval_chain c,
                       sp_project_approvals a,
                       sp_projects p,
                       sp_team_members m,
                       sp_approval_types t
                 where a.id = c.project_approval_id
                   and c.team_member_id = :APP_USER_ID
                   and c.status = 'PENDING'
                   and c.final_yn = 'Y'
                   and a.project_id = p.id
                   and a.approval_type_id = t.id    
                   and a.submitted_by_team_member_id = m.id
                 order by c.last_status_on
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression:
                ```plsql
                sp_approvals.approval_pending_cnt (
                    p_team_member_id => :APP_USER_ID ) > 0
                ```
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }
        pagination {
            type: showAll
        }

        column APPROVAL_TYPE (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Approval Type
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column PROJECT (
            reportColumnQueryId: 2
            derivedColumn: N
            type: link
            heading {
                heading: Project
            }
            layout {
                sequence: 20
            }
            link {
                target: {
                    page: 3
                    items: {
                        P3_PROJECT_ID: #ID#
                    }
                    clearCache: 3
                }
                linkText: #PROJECT#
            }
            sorting {
                sortable: false
            }
        )

        column SUBMITTED_BY (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Submitted By
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )

    )

)


````
