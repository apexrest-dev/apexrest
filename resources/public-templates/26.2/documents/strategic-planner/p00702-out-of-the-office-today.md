# Out of the Office Today — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00702-out-of-the-office-today.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 4f6de5393d5c390f268ca8cb6eff3073f632af823e56eee2d8b6014da15fb1ad.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 702 (
    name: Out of the Office Today
    alias: OUT-OF-THE-OFFICE-TODAY
    title: Out of the Office Today
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    config {
        buildOption: @team-calendar
    }

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

    region out-of-the-office-today (
        name: Out of the Office Today
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select e.id,
                       case when e.event_name is not null
                            then e.event_name
                            else case when e.for_user_id is not null
                                      then (select first_name||' '||last_name
                                              from sp_team_members
                                             where id = e.for_user_id) 
                                       end
                            end ||
                       ' - '|| t.event_type name,
                       t.calendar_event_color,
                       t.icon_class,
                       case when e.for_user_id is null then 0 else 1 end main_ob
                  from sp_events e,
                       sp_event_types t
                 where e.event_type_id = t.id
                   and cast(e.event_date as date) = :P702_DATE
                 order by main_ob, name
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        componentAppearance {
            layout: float
        }
        card {
            primaryKeyColumn1: ID
        }
        title {
            column: NAME
        }
        iconAndBadge {
            iconSource: iconClassColumn
            iconColumn: ICON_CLASS
            iconCssClasses: fa
        }
        messages {
            whenNoDataFound: No events found
        }
    )

    pageItem P702_DATE (
        type: hidden
        layout {
            sequence: 20
            region: @breadcrumb
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P702_DISPLAY_DATE (
        type: hidden
        layout {
            sequence: 10
            region: @breadcrumb
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button add-event (
        buttonName: add-event
        label: Add Event
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-plus
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 704
                items: {
                    P704_EVENT_DATE: &P702_DATE.
                }
                clearCache: 704
            }
        }
        security {
            authorizationScheme: @contribution-rights
        }
    )

    button up (
        buttonName: UP
        label: Navigate Up
        layout {
            sequence: 10
            region: @breadcrumb
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
                page: 700
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    computation p702-date (
        itemName: P702_DATE
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: expression
            plsqlExpression: to_date(:APP_SYSDATE,'DD-MON-YYYY')
        }
        serverSideCondition {
            type: request!=Value
            value: NOT_TODAY
        }
    )

    computation p702-display-date (
        itemName: P702_DISPLAY_DATE
        execution {
            sequence: 20
            point: beforeHeader
        }
        computation {
            type: expression
            plsqlExpression: ' Today, '||to_char(to_date(:APP_SYSDATE,'DD-MON-YYYY'),'FMMonth DD, YYYY')
        }
        serverSideCondition {
            type: request!=Value
            value: NOT_TODAY
        }
    )

    computation p702-display-date-2 (
        itemName: P702_DISPLAY_DATE
        execution {
            sequence: 50
            point: beforeHeader
        }
        computation {
            type: expression
            plsqlExpression: to_char(to_date(:P702_DATE,'MM/DD/YYYY'),', FMMonth DD, YYYY')
        }
        serverSideCondition {
            type: request=Value
            value: NOT_TODAY
        }
    )

)


````
