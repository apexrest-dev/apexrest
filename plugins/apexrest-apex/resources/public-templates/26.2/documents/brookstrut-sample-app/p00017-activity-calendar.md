# Activity Calendar — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00017-activity-calendar.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 65b7e565c5e6427f52eae48dd91a13f813125149f44f7f995b8472ca5fca50d8.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 17 (
    name: Activity Calendar
    alias: ACTIVITY-CALENDAR
    title: Activity Calendar
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: rw-pillar--sienna
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    advanced {
        reloadOnSubmit: always
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
                lower(USERID)||'-'||trim(to_char(count(*),'999G999G999G990')) "Page Events",
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
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        security {
            escapeSpecialChars: false
        }
        settings {
            displayColumn: "Page Events"
            startDateColumn: THE_DAY
            additionalCalendarViews: [
                list
                navigation
            ]
            maxEventsDay: 50
        }
        performance {
            lazyLoading: true
        }
    )

    region activity-calendar-2 (
        name: Activity Calendar
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 1
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

    button refresh (
        buttonName: refresh
        label: Refresh
        layout {
            sequence: 10
            region: @activity-calendar-2
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
                t-Button--iconLeft
            ]
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 17
                clearCache: 17
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button up (
        buttonName: up
        label: Up
        layout {
            sequence: 10
            region: @activity-calendar-2
            slot: up
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-arrow-up
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 4
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
