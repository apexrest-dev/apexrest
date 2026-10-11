# Calendar — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00308-calendar1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e68d95a4be1b57b87269ff3304f503a24ecbefacac755e9ae486972c6085acdb.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 308 (
    name: Calendar
    alias: CALENDAR1
    title: Calendar
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
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

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                    On this page we present task entries from the <strong>EBA_REST_TASKS</strong> REST Data Source in a calendar layout rather than a Classic or Interactive Report. Each record from the <code>EBA_TASKS_SS</code> table appears as a dated event, displaying its title and scheduled dates. Filtering and pagination are driven by the REST service to keep the display efficient.
                  </p>
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
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
    )

    region projects-calendar (
        name: Projects Calendar
        type: calendar
        source {
            location: restSource
            restSource: @eba_rest_tasks
        }
        localPostProcessing {
            type: sqlQuery
            sqlQuery:
                ```sql
                
                
                
                select  id,
                        project,
                        task_name,
                        status,
                        assigned_to,
                        cost,
                        start_date,
                        end_date,
                 case
                 when   status = 'Pending' then 'apex-cal-blue'
                 when   status = 'Open' then 'apex-cal-green'
                 when   status = 'Closed' then 'apex-cal-gray'
                 when   status = 'On-Hold' then 'apex-cal-orange'
                  end   as css_class,
                        'Project: ' || project || '<br>Status: ' || status AS supplemental_info
                 from   #APEX$SOURCE_DATA#
                
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        security {
            escapeSpecialChars: false
        }
        settings {
            displayColumn: TASK_NAME
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            supplementalInfo: &SUPPLEMENTAL_INFO.
            calendarViewsAndNavigation: [
                month
                week
                day
                list
                navigation
            ]
            cssClass: CSS_CLASS
        }
    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 20
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 400
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 307
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
