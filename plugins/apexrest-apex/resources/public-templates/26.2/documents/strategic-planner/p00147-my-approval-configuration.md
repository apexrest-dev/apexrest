# My Approval Configuration — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00147-my-approval-configuration.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 4a9b5158c91461e188b9d753bb2809b26387f6076f9d2cb023db27a15ada7040.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 147 (
    name: My Approval Configuration
    alias: MY-APPROVAL-CONFIGURATION
    title: My Approval Configuration
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

    region configuration (
        name: Configuration
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select i.initiative ||' - '|| t.approval_type approval_type,
                       nvl((select listagg(case when c.active_yn = 'N' then '(Inactive - ' end ||
                                           case when c.alternate_team_member_id is not null and   
                                                    (c.alternate_start_date <= sysdate or c.alternate_start_date is null) and 
                                                    (c.alternate_end_date+1 > sysdate or c.alternate_end_date is null)
                                                then (select first_name||' '||last_name
                                                        from sp_team_members
                                                       where id = c.alternate_team_member_id)||
                                                       ' as alternate for '||tm.first_name||' '||tm.last_name
                                                else tm.first_name||' '||tm.last_name
                                                end ||
                                            case when c.active_yn = 'N' then ')' end,', ' on overflow truncate with count)
                                   within group (order by approval_seq)
                              from sp_initiative_approval_chain c,
                                   sp_team_members tm
                             where c.initiative_approval_id = a.id
                               and c.team_member_id = tm.id
                              group by c.initiative_approval_id),'None Yet') approvers,
                       (select id
                          from sp_initiative_approval_chain
                         where initiative_approval_id = a.id   
                           and team_member_id = :APP_USER_ID) initiative_approval_chain_id
                  from sp_initiative_approvals a,
                       sp_approval_types t,
                       sp_initiatives i
                 where a.active_yn ='Y'
                   and a.approval_type_id = t.id
                   and a.initiative_id = i.id
                   and a.id in (select initiative_approval_id
                                  from sp_initiative_approval_chain
                                 where team_member_id = :APP_USER_ID)
                order by 1
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
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }
        pagination {
            type: showAll
        }

        column APPROVAL_TYPE (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Approval Type
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
        )

        column APPROVERS (
            reportColumnQueryId: 2
            derivedColumn: N
            type: link
            heading {
                heading: Approvers
            }
            layout {
                sequence: 20
            }
            link {
                target: {
                    page: 4015
                    items: {
                        P4015_ID: #INITIATIVE_APPROVAL_CHAIN_ID##INITIATIVE_APPROVAL_ID#
                    }
                    clearCache: 4015
                }
                linkText: #APPROVERS#
            }
            sorting {
                sortable: false
            }
        )

        column INITIATIVE_APPROVAL_CHAIN_ID (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 30
            }
        )

    )

    dynamicAction when-close (
        name: when close
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @configuration
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @configuration
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
