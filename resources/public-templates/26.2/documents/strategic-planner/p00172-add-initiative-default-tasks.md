# Add Initiative - Default Tasks — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00172-add-initiative-default-tasks.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 34f2f6f84218186183d22c359af9d6c3e1ec97e65a112869edc4347819e51efb.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 172 (
    name: Add Initiative - Default Tasks
    alias: ADD-INITIATIVE-DEFAULT-TASKS
    title: Add &NOMENCLATURE_INITIATIVE. - Default Tasks
    pageGroup: @initiatives
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
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
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    region default-tasks (
        name: default tasks
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select APEX_ITEM.CHECKBOX2(p_idx => 1, p_value => t.id, p_checked_values => i.n001) checked,
                       case when t.parent_type_id is not null
                            then (select t2.task_type from sp_task_types t2
                                   where t2.id = t.parent_type_id)||': '
                            end ||
                           t.task_type task,
                       t.display_seq
                  from sp_task_types t,
                       apex_collections i
                 where t.include_yn = 'Y'
                   and t.id = i.n001
                   and i.collection_name = 'INITIATIVE_DEFAULT_TASKS'
                 union all
                select APEX_ITEM.CHECKBOX2(p_idx => 1, p_value => t.id) checked,
                       case when t.parent_type_id is not null
                            then (select t2.task_type from sp_task_types t2
                                   where t2.id = t.parent_type_id)||': '
                            end ||
                           t.task_type task,
                       t.display_seq
                  from sp_task_types t
                 where t.include_yn = 'Y'
                   and id not in (select n001
                                    from apex_collections
                                   where collection_name = 'INITIATIVE_DEFAULT_TASKS')
                 order by display_seq nulls first
                ```
        }
        layout {
            sequence: 30
            slot: wizardBody
        }
        appearance {
            template: @/wizard-container
            templateOptions: [
                #DEFAULT#
                t-Wizard--hideStepsXSmall
            ]
        }
        headerAndFooter {
            headerText: Identify the items that will be automatically created for all &NOMENCLATURE_PROJECTS. added to this &NOMENCLATURE_INITIATIVE..
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

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 50
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconRight
            ]
            icon: fa-chevron-right
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Previous
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-chevron-left
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
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

    process save-tasks (
        name: save tasks
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_collection.create_or_truncate_collection ('INITIATIVE_DEFAULT_TASKS');
                
                for i in 1..apex_application.g_f01.count loop
                    apex_collection.add_member (
                        p_collection_name => 'INITIATIVE_DEFAULT_TASKS',
                        p_n001            => apex_application.g_f01(i));
                end loop;
                ```
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 13228666177873161522
        }
    )

    branch (
        name: previous
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 171
            }
        }
        serverSideCondition {
            whenButtonPressed: @previous
        }
    )

    branch (
        name: next
        execution {
            sequence: 20
        }
        behavior {
            target: {
                page: 174
            }
        }
    )

)


````
