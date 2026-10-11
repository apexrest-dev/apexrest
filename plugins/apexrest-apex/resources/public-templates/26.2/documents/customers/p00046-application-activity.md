# Application Activity — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00046-application-activity.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c5d3cb396380e6c8fd6fd95befc25569d4b7bda0c9b3852f74683046ae5125a1.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 46 (
    name: Application Activity
    alias: APPLICATION-ACTIVITY
    title: Application Activity
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
        helpText: This is a monthly calendar of application activity, reporting distinct number of users and number of page views by day. Click the <strong><</strong> button to go to the previous month and the <strong>></strong> button to go forward a month. Switch between the calendar view to the list view by clicking the <strong>list</strong> button.
    }

    region application-activity (
        name: Application Activity
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select to_char(distinct_users) ||' Users / '||
                       trim(to_char(page_events,'999G999G999G990')) ||' Views'  Page_Events,
                       log_day the_day
                  from apex_workspace_log_archive
                 where application_id = :app_id
                 union all
                select to_char(count( distinct USERID) ) ||' Users / '||
                       trim(to_char(count(*),'999G999G999G990')) ||' Views'  Page_Events,
                       trunc(time_stamp) the_day
                  from apex_activity_log l
                 where flow_id = :app_id 
                   and userid is not null 
                   and time_stamp > trunc(sysdate)
                 group by trunc(time_stamp)
                
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
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

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb-2
        }
        layout {
            sequence: 30
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
