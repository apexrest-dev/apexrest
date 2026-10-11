# Initiative Default Tasks — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00095-initiative-default-tasks.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 47569e5885d0e79e2a41a2e5beebf787fb8e1852dec05430097407e58862eb12.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 95 (
    name: Initiative Default Tasks
    alias: INITIATIVE-DEFAULT-TASKS
    title: Initiative Default Tasks
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: @contribution-rights
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    region initiative-tasks (
        name: Initiative Tasks
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region report (
        name: report
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select APEX_ITEM.CHECKBOX2(p_idx => 1, p_value => t.id,p_checked_values => i.type_id) checked,
                       case when t.parent_type_id is not null
                            then (select t2.task_type from sp_task_types t2
                                   where t2.id = t.parent_type_id)||': '
                            end ||
                           t.task_type task,
                       t.display_seq
                  from sp_task_types t,
                       sp_initiative_default_tasks i
                 where t.include_yn = 'Y'
                   and t.id = i.type_id
                   and i.initiative_id = :P95_INITIATIVE_ID
                union all
                select case when t.parent_type_id is not null
                            then APEX_ITEM.CHECKBOX2(p_idx => 1, p_value => t.id) 
                            else null  -- you cannot default in parent task types
                            end checked,
                       case when t.parent_type_id is not null
                            then (select t2.task_type from sp_task_types t2
                                   where t2.id = t.parent_type_id)||': '
                            end ||
                           t.task_type task,
                       t.display_seq
                  from sp_task_types t
                 where t.include_yn = 'Y'
                   and t.id not in (select type_id
                                      from sp_initiative_default_tasks
                                     where initiative_id = :P95_INITIATIVE_ID)
                   and ( t.parent_type_id is not null or
                         exists (select 1
                                   from sp_task_types
                                  where parent_type_id = t.id) )
                 order by display_seq nulls first
                ```
            pageItemsToSubmit: P95_INITIATIVE_ID
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        reportLayout {
            numberOfRows: 1000
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--noBorders
            ]
        }
        pagination {
            type: showAll
        }
        heading {
            type: none
        }

        column CHECKED (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Checked
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
            }
        )

        column DISPLAY_SEQ (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 30
            }
        )

        column TASK (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Task
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

    )

    pageItem P95_INITIATIVE_ID (
        type: displayOnly
        label {
            label: &NOMENCLATURE_INITIATIVE.
            alignment: left
        }
        settings {
            basedOn: lov
        }
        lov {
            type: sharedComponent
            lov: @area-initiative
        }
        layout {
            sequence: 20
            region: @initiative-tasks
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 30
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
    )

    dynamicAction cancel-dialog (
        name: Cancel Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    process close-dialog (
        name: Close Dialog
        type: closeDialog
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 18277850998256990316
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process save-changes (
        name: save changes
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    wwv_flow_collection.CREATE_OR_TRUNCATE_COLLECTION ('INITIATIVE_TASKS');
                
                    for i in 1..apex_application.g_f01.count loop
                        wwv_flow_collection.add_member (
                            p_collection_name => 'INITIATIVE_TASKS',
                            p_n001            => apex_application.g_f01(i));
                    end loop;
                
                    delete from sp_initiative_default_tasks
                     where initiative_id = :P95_INITIATIVE_ID
                       and type_id not in (select n001
                                             from wwv_flow_collections
                                            where collection_name = 'INITIATIVE_TASKS');
                
                    insert into sp_initiative_default_tasks (initiative_id, type_id)
                    select :P95_INITIATIVE_ID, n001
                      from wwv_flow_collections
                     where collection_name = 'INITIATIVE_TASKS'
                       and n001 not in (select type_id
                                          from sp_initiative_default_tasks
                                         where initiative_id = :P95_INITIATIVE_ID);
                
                    commit;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Default tasks updated.
        }
        advanced {
            executionMappingIdentifier: 18278018779445280015
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
