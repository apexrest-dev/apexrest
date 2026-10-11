# Manage My Subscriptions — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00149-manage-my-subscriptions.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 14dbf80efe16a750f8a725e317a5f962411c4691f0241fe88884e7ad33d8c3bc.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 149 (
    name: Manage My Subscriptions
    alias: MANAGE-MY-SUBSCRIPTIONS
    title: Manage My Subscriptions
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

    region info (
        name: Info
        type: staticContent
        source {
            htmlCode: Add new Release Exceptions by viewing the Exceptions subtab for a selected Release.
        }
        layout {
            sequence: 30
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region notification-subscriptions (
        name: Notification Subscriptions
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ns.ID,
                       apex_escape.html(n.name) || apex_item.hidden(1,n.id)||apex_item.hidden(3,null) notification,
                       ns.NOTIFICATION_ID,
                       apex_item.select_list(4,initcap(frequency),'Weekly,Weekdays') frequency,
                       apex_item.switch(p_idx        => 2, 
                                        p_value      => nvl(ns.opted_in_yn,'N'), 
                                        p_on_value   => 'Y', p_off_value => 'N',
                                        p_item_id    => 'SUB_' || rownum,
                                        p_item_label => 'Opted In') opted_in,
                       ns.CREATED,
                       ns.CREATED_BY,
                       ns.UPDATED,
                       ns.UPDATED_BY
                  from SP_NOTIFICATION_SUBSCRIPTIONS ns,
                       SP_NOTIFICATIONS n
                where n.id = ns.NOTIFICATION_ID
                  and ns.team_member_id = :APP_USER_ID
                  and n.static_id != 'RELEASE_EXCEPTIONS'
                union all
                select null ID,
                       apex_escape.html(n.name) || apex_item.hidden(1,n.id)||apex_item.hidden(3,null) notification,
                       n.id NOTIFICATION_ID,
                       apex_item.select_list(4,'Weekly','Weekly,Weekdays') frequency,
                       apex_item.switch(p_idx        => 2, 
                                        p_value      => 'N', 
                                        p_on_value   => 'Y', p_off_value => 'N',
                                        p_item_id    => 'SUB3_' || rownum,
                                        p_item_label => 'Opted In') opted_in,
                       null CREATED,
                       null CREATED_BY,
                       null UPDATED,
                       null UPDATED_BY
                  from SP_NOTIFICATIONS n
                 where n.id not in (select NOTIFICATION_ID from SP_NOTIFICATION_SUBSCRIPTIONS
                                     where team_member_id = :APP_USER_ID)
                  and n.static_id != 'RELEASE_EXCEPTIONS'
                union all
                select ns.ID,
                       apex_escape.html(n.name || ' for '|| r.release_train ||' '|| r.release) ||
                           apex_item.hidden(1,n.id)||apex_item.hidden(3,ns.release_id) notification,
                       ns.NOTIFICATION_ID,
                       apex_item.select_list(4,initcap(frequency),'Weekly,Weekdays') frequency,
                       apex_item.switch(p_idx        => 2, 
                                        p_value      => nvl(ns.opted_in_yn,'N'), 
                                        p_on_value   => 'Y', p_off_value => 'N',
                                        p_item_id    => 'SUB2_' || rownum,
                                        p_item_label => 'Opted In') opted_in,
                       ns.CREATED,
                       ns.CREATED_BY,
                       ns.UPDATED,
                       ns.UPDATED_BY
                  from SP_NOTIFICATION_SUBSCRIPTIONS ns,
                       SP_NOTIFICATIONS n,
                       sp_release_trains r
                where n.id = ns.NOTIFICATION_ID
                  and ns.team_member_id = :APP_USER_ID
                  and n.static_id = 'RELEASE_EXCEPTIONS'
                  and ns.release_id = r.id
                order by 2
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--altRowsDefault
                t-Report--rowHighlightOff
                t-Report--noBorders
            ]
        }
        pagination {
            type: showAll
        }

        column CREATED (
            reportColumnQueryId: 6
            derivedColumn: N
            type: hidden
            layout {
                sequence: 60
            }
        )

        column CREATED_BY (
            reportColumnQueryId: 7
            derivedColumn: N
            type: hidden
            layout {
                sequence: 70
            }
        )

        column FREQUENCY (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Frequency
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
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

        column NOTIFICATION (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Notification
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
            }
        )

        column NOTIFICATION_ID (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 50
            }
        )

        column OPTED_IN (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Opted In
            }
            layout {
                sequence: 40
                columnAlignment: center
            }
            appearance {
                formatMask: SINCE
            }
            sorting {
                sortable: false
            }
            security {
                escapeSpecialChars: false
            }
        )

        column UPDATED (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Last Updated
            }
            layout {
                sequence: 80
            }
            appearance {
                formatMask: Since
            }
            sorting {
                sortable: false
            }
        )

        column UPDATED_BY (
            reportColumnQueryId: 9
            derivedColumn: N
            type: hidden
            layout {
                sequence: 90
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
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: itemIsNotNull
            item: APP_USER_ID
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

    process close (
        name: close
        type: closeDialog
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 11501713564665050932
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    process update-subscriptions (
        name: Update Subscriptions
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                for i in 1..apex_application.g_f01.count loop
                
                    if apex_application.g_f02(i) = 'Y' then
                        sp_util.notification_opt_in (
                            p_team_member_id  => :APP_USER_ID,
                            p_notification_id => apex_application.g_f01(i),
                            p_frequency       => case when apex_application.g_f04(i) = 'Weekly' then 'WEEKLY' else 'WEEKDAYS' end,
                            p_release_id      => apex_application.g_f03(i));
                    else
                        sp_util.notification_opt_out (
                            p_team_member_id  => :APP_USER_ID,
                            p_notification_id => apex_application.g_f01(i),
                            p_release_id      => apex_application.g_f03(i));
                    end if;
                
                end loop;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Subscriptions updated.
        }
        advanced {
            executionMappingIdentifier: 11121213933219701722
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
