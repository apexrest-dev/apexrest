# Pending Actions — Sample Approvals

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-approvals/apexlang/sample-workflow-approvals/pages/p00025-pending-actions.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0133f3b2294889867f9c1c7ec4562099e0d5bbf7a60efbd8cccb5b70b6fe00f2.

Application dependency inventory: oracle:26.2:public-template/sample-approvals/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 25 (
    name: Pending Actions
    alias: PENDING-ACTIONS
    title: Pending Appraisals
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                    This page is handy for demo purposes since it shows the relevant assignees and administrators
                    determined at task creation time for each pending action task. Use this information
                    to know which sample user to log in as to complete or administer a given action task. The
                    three action tasks below each dynamically computes its assignee at runtime by calling a
                    PL/SQL function that uses the primary key of the EBA_DEMO_APPR_APPRAISALS table, passed in
                    using the bind variable <code>:APEX$TASK_PK</code>, to return the following usernames related
                    to the employee to whom the appraisal pertains:
                </p>
                <ul>
                    <li>
                        the employee themselves, for the <em>Appraisal - Employee Input</em> action task,
                    </li>
                    <li>
                        the manager of the employee, for the <em>Appraisal - Manager Input</em> action task, and
                    </li>
                    <li>
                        the second-level manager of the employee (or null if none exists), for the  <em>Appraisal - VP Review</em> action task.
                    </li>         
                </ul>
                <p>
                    This page's classic report region queries data from <strong>APEX_TASKS</strong>, 
                    <strong>APEX_TASK_PARTICIPANTS</strong>, and 
                    <strong>APEX_APPL_TASKDEFS</strong> views. It filters the list to only include action
                    tasks using the WHERE clause <code>TASK_TYPE_CODE = 'ACTION'</code>. Most applications 
                    using approvals would typically only need one or more of the unified task list pages to allow
                    end users to work with tasks. This sample includes <strong>My Tasks</strong>, 
                    <strong>My Requests</strong>, and <strong>Task Administration</strong>
                    unified task list pages for that purpose.
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                js-useLocalStorage
                is-collapsed
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 40
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region pending-actions (
        name: Pending Actions
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select t.task_id, 
                       t.subject,
                       t.priority,
                       case 
                            when t.state_code = 'ASSIGNED' then 
                                t.state||' to '||t.actual_owner
                            when t.state_code = 'UNASSIGNED' then 
                                t.state||' ('||eba_demo_appr.approvers_for_task(t.task_id)||')'
                        end status,
                        eba_demo_appr.admins_for_task(t.task_id) as admins,
                        t.due_on due_by
                from apex_tasks t
                left join apex_appl_taskdefs d on d.task_def_id = t.task_def_id
                where t.state_code in ('UNASSIGNED','ASSIGNED')
                and t.task_type_code = 'ACTION'
                and t.application_id = :APP_ID
                order by due_by
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--scrollBody
            ]
        }
        reportLayout {
            numberOfRows: 50
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--inline
                t-Report--hideNoPagination
            ]
        }
        performance {
            maxRowsToProcess: 500
        }
        messages {
            whenNoDataFound: No pending actions
        }

        column ADMINS (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Admins
            }
            layout {
                sequence: 41
            }
            sorting {
                sortable: false
            }
        )

        column DUE_BY (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Due By
            }
            layout {
                sequence: 51
            }
            appearance {
                formatMask: DD-MON-YYYY HH24:MI
            }
            sorting {
                sortable: false
            }
        )

        column PRIORITY (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Priority
            }
            layout {
                sequence: 21
            }
            sorting {
                sortable: false
            }
        )

        column STATUS (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Status
            }
            layout {
                sequence: 31
            }
            sorting {
                sortable: false
            }
        )

        column SUBJECT (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Subject
            }
            layout {
                sequence: 11
            }
            sorting {
                sortable: false
            }
        )

        column TASK_ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 1
            }
        )

    )

)


````
