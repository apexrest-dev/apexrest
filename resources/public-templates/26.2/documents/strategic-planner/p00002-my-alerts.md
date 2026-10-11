# My Alerts — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00002-my-alerts.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 754a38132aff904f975c97589b2fb4c26f86b2eb346c987dce0e55224c6227d3.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 2 (
    name: My Alerts
    alias: MY-ALERTS
    title: My Alerts
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
    javaScript {
        functionAndGlobalVariableDeclaration:
            ```javascript-browser
            $(() => { 
                apex.actions.add({
                    name: 'dismissNotif',
                    action: function(event, focusElement, args) {
                        $(event.currentTarget).addClass('js-notif-to-dismiss');
                        apex.item('P2_NOTIF_TO_DISMISS').setValue(args.id);
                        return true;
                        }
                });
            });
            ```
    }
    security {
        authorizationScheme: @contribution-rights
    }
    config {
        buildOption: @subscriptions
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 30
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

    region notifications (
        name: Notifications
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                       case notification_type 
                            when 'APPROVAL' then 'fa-workflow'
                            when 'APPROVAL-CLARIFICATION' then 'fa-question-circle-o'
                            when 'MENTION' then 'fa-at'
                            when 'COMMENT' then 'fa-comment-o'
                            when 'ASSIGNMENT' then 'fa-tasks-alt'
                            when 'OWNER' then 'fa-user'
                            end icon,
                       apex_page.get_url(
                           p_application => :APP_ID,
                           p_page        => case when task_id is not null then 502
                                                 when project_id is not null then 3
                                                 when release_id is not null then 117
                                                 when initiative_id is not null then 94
                                                 end,
                           p_session     => :APP_SESSION,
                           p_clear_cache => case when task_id is not null then 502
                                                 when project_id is not null then 3
                                                 when release_id is not null then 117
                                                 when initiative_id is not null then 94
                                                 end,
                           p_items       => case when task_id is not null then 'P502_PREV_PAGE,P502_TASK_ID,P502_PROJECT_ID'
                                                 when project_id is not null then 'P3_PROJECT_ID'
                                                 when release_id is not null then 'P117_RELEASE_ID'
                                                 when initiative_id is not null then 'P94_INITIATIVE_ID'
                                                 end,
                           p_values      => case when task_id is not null then '3,'||task_id||','||project_id
                                                 when project_id is not null then to_char(project_id)
                                                 when release_id is not null then to_char(release_id)
                                                 when initiative_id is not null then to_char(initiative_id)
                                                 end ) link,
                       title,
                       created,
                       lower(created_by) created_by
                  from sp_team_member_notifications
                 where team_member_id = :APP_USER_ID
                   and dismissed_yn = 'N'
                   and instr(':'||notification_pref||':',':APP:') > 0
                ```
        }
        orderBy {
            type: staticValue
            orderByClause: created desc
        }
        layout {
            sequence: 40
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
            icon: fa-window-close-o
        }
        accessibility {
            landmarkType: region
        }
        componentAppearance {
            display: report
        }
        settings {
            overline: &CREATED. by &CREATED_BY.
            title: &TITLE.
            displayAvatar: true
        }
        plugin-avatar {
            icon: &ICON.
        }
        plugin-appearance {
            style: compact
        }
        messages {
            whenNoDataFound: No active alerts.
        }

        column CREATED (
            layout {
                sequence: 70
            }
            source {
                databaseColumn: CREATED
                dataType: date
            }
            appearance {
                formatMask: SINCE
            }
        )

        column CREATED_BY (
            layout {
                sequence: 80
            }
            source {
                databaseColumn: CREATED_BY
                dataType: varchar2
            }
        )

        column ICON (
            layout {
                sequence: 100
            }
            source {
                databaseColumn: ICON
                dataType: varchar2
            }
        )

        column ID (
            layout {
                sequence: 50
            }
            source {
                databaseColumn: ID
                dataType: number
            }
        )

        column LINK (
            layout {
                sequence: 90
            }
            source {
                databaseColumn: LINK
                dataType: varchar2
            }
        )

        column TITLE (
            layout {
                sequence: 60
            }
            source {
                databaseColumn: TITLE
                dataType: varchar2
            }
        )

        action action (
            position: titleLink
            layout {
                sequence: 20
            }
            behavior {
                type: redirectUrl
                targetUrl: &LINK.
            }
        )

        action dismiss (
            position: primaryActions
            template: button
            label: Dismiss
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: #action$dismissNotif?id=&ID.
            }
            appearance {
                displayType: icon
                icon: fa-times
                cssClasses: t-Button--noUI
            }
        )

    )

    pageItem P2_NOTIF_TO_DISMISS (
        type: hidden
        layout {
            sequence: 10
            region: @notifications
            slot: regionBody
        }
    )

    button close (
        buttonName: CLOSE
        label: Close
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

    button dismiss-all (
        buttonName: DISMISS_ALL
        label: Dismiss All
        layout {
            sequence: 10
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
            requiresConfirmation: true
        }
        confirmation {
            message: Are you sure you want to dismiss all your alerts?
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from sp_team_member_notifications
                 where team_member_id = :APP_USER_ID
                   and dismissed_yn = 'N'
                   and instr(':'||notification_pref||':',':APP:') > 0
                ```
        }
    )

    dynamicAction close (
        name: close
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @close
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction dismiss-notif (
        name: dismiss notif
        execution {
            sequence: 20
        }
        when {
            selectionType: items
            items: P2_NOTIF_TO_DISMISS
        }

        action native-execute-plsql-code (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    update sp_team_member_notifications
                       set dismissed_yn = 'Y'
                     where id = :P2_NOTIF_TO_DISMISS
                       and team_member_id =  :APP_USER_ID;
                    ```
                itemsToSubmit: P2_NOTIF_TO_DISMISS
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode: apex.items.P2_NOTIF_TO_DISMISS.setValue('',undefined,true);
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @notifications
            }
            execution {
                sequence: 30
                fireOnInit: false
            }
        )

    )

    process close (
        name: close
        type: closeDialog
        execution {
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 3817943664947885473
        }
        serverSideCondition {
            whenButtonPressed: @dismiss-all
        }
    )

    process dismiss-all (
        name: dismiss all
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                update sp_team_member_notifications
                   set dismissed_yn = 'Y'
                 where team_member_id = :APP_USER_ID
                   and dismissed_yn = 'N'
                   and instr(':'||notification_pref||':',':APP:') > 0;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Alerts dismissed.
        }
        advanced {
            executionMappingIdentifier: 3791031187249085140
        }
        serverSideCondition {
            whenButtonPressed: @dismiss-all
        }
    )

)


````
