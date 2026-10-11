# Activity Calendar — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00042-activity-calendar.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c6562226c8e12a60cc5a8519ef25403e542a36288779d10028fb0344d143f780.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 42 (
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
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: This is a monthly calendar of application activity, reporting distinct users and their total page views by day. Click the <strong><</strong> button to go to the previous month and the <strong>></strong> button to go forward a month. Switch between the calendar view to the list view by clicking the <strong>list</strong> button.
    }

    region page-view-calendar (
        name: Page View Calendar
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                lower(USERID) ||' - '||
                trim(to_char(count(*),'999G999G999G990'))   Page_Events,
                trunc(time_stamp) the_day
                from apex_activity_log l
                where flow_id = :app_id and userid is not null and userid != 'nobody'
                group by trunc(time_stamp), lower(USERID)
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        security {
            escapeSpecialChars: false
        }
        settings {
            displayColumn: PAGE_EVENTS
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
