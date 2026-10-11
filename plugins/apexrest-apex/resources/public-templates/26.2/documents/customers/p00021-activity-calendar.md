# Activity Calendar — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00021-activity-calendar.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: cc1496eccd345af15c59c369fe55375302fd517e89dd65035a9d9d219a5f1162.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 21 (
    name: Activity Calendar
    alias: ACTIVITY-CALENDAR
    title: Activity Calendar
    pageGroup: @reports
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
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
                lower(USERID) ||' - '||
                trim(to_char(count(*),'999G999G999G990')) Page_Events,
                trunc(time_stamp) the_day
                from apex_activity_log l
                where flow_id = :app_id and userid is not null and userid != 'nobody'
                group by trunc(time_stamp), lower(USERID)
                ```
        }
        layout {
            sequence: 10
            slot: body
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
            maxEventsDay: 15
        }
        performance {
            lazyLoading: true
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb-2
        }
        layout {
            sequence: 20
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

)


````
