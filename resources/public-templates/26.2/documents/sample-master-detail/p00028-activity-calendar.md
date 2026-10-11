# Activity Calendar — Sample Master Detail

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-master-detail/apexlang/sample-master-detail/pages/p00028-activity-calendar.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 190f5e7713105363ebfeeedc9c68d8bd5b348a10590410aab1fe823d940098bd.

Application dependency inventory: oracle:26.2:public-template/sample-master-detail/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 28 (
    name: Activity Calendar
    alias: ACTIVITY-CALENDAR
    title: Activity Calendar
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region activity-calendar (
        name: Activity Calendar
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select lower(USERID)||' - '
                    ||trim(to_char(count(*),'999G999G999G990')) page_events,
                    trunc(time_stamp) the_day
                from apex_activity_log l
                where flow_id = :APP_ID
                    and userid is not null
                    and userid != 'nobody'
                group by trunc(time_stamp), lower(userid)
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            displayColumn: PAGE_EVENTS
            startDateColumn: THE_DAY
            showTooltip: false
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
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 10
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
