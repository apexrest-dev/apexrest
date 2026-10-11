# Week Calendar: Conference — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00032-week-calendar-conference.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d85d0a1fcc6b91df6ea42ff6a085287ff0a9eeb14a955307f938223f5aaacb34.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 32 (
    name: Week Calendar: Conference
    alias: WEEK-CALENDAR-CONFERENCE
    title: Week Calendar: Conference
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }
    advanced {
        reloadOnSubmit: always
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>This is a standard Oracle APEX calendar region component showing a <b>weekly</b> view on events with a time component. This region component is well-suited to display conference or similar type schedules.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-bottom-md
            ]
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
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region sessions (
        name: Sessions
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                   id,
                   case when speaker is not null then 
                       title || ' (' || speaker || ')' 
                       else title
                   end as title,
                   speaker,
                   start_date,
                   end_date,
                   case
                      when status       = 'INACTIVE' then  'apex-cal-gray'
                      when session_type = 'BREAK'    then  'apex-cal-silver'
                      when session_type = 'BUSINESS' then  'apex-cal-orange'
                      when session_type = 'GENERAL'  then  'apex-cal-blue'
                      when session_type = 'TECHNICAL' then 'apex-cal-green'
                      when session_type = 'HANDS_ON' then 'apex-cal-lime'
                   end as css_class
                from eba_demo_cal_sessions
                where status='ACTIVE'
                
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
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--hiddenOverflow
            ]
        }
        advanced {
            htmlDomId: task_due_dates
        }
        settings {
            displayColumn: TITLE
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            calendarViewsAndNavigation: [
                week
                day
                list
                navigation
            ]
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
    )

    dynamicAction change-project-refresh-calendar (
        name: Change Project - Refresh Calendar
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P32_PROJECTS
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @sessions
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
