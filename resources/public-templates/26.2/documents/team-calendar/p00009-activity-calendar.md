# Activity Calendar — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00009-activity-calendar.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0594e98f255652ede8174b44fc71d2adad92f838b972c8c28490ec03017b540d.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9 (
    name: Activity Calendar
    alias: ACTIVITY-CALENDAR
    title: Activity Calendar
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
        ]
    }
    dialog {
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: This is a monthly calendar of application activity, reporting distinct users and their total page views by day. Click the <strong><</strong> button to go to the previous month and the <strong>></strong> button to go forward a month. Switch between the calendar view to the list view by clicking the <strong>list</strong> button.
    }

    region activity-calendar (
        name: Activity Calendar
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                lower(USERID)||' - '||trim(to_char(count(*),'999G999G999G990'))   "Page Events",
                trunc(time_stamp) the_day
                from apex_activity_log l
                where flow_id = :app_id 
                and userid is not null 
                and userid != 'nobody'
                group by trunc(time_stamp), lower(USERID)
                ```
        }
        layout {
            sequence: 21
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            displayColumn: "Page Events"
            startDateColumn: THE_DAY
            additionalCalendarViews: [
                list
                navigation
            ]
        }
        performance {
            lazyLoading: true
        }
    )

)


````
