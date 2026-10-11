# Faceted Search: Projects — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00036-faceted-search-projects.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 67adfc9aaea19c106f091de3fdcf00c91a1669e67bb708146ae55446af549f95.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 36 (
    name: Faceted Search: Projects
    alias: FACETED-SEARCH-PROJECTS
    title: Faceted Search: Projects
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
            htmlCode: <p>This is a standard Oracle APEX Calendar region component built using the create calendar region wizard. Additionally a Faceted Search region was added to enable rich search capabilities of the calendar region. Click on a calendar event to open a dialog where you can edit the event's details.</p>
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

    region search (
        name: Search
        type: facetedSearch
        source {
            filteredRegion: @tasks
        }
        layout {
            sequence: 30
            slot: body
            columnSpan: 3
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            compactNosThreshold: 10000
            displayChartForTopNValues: 10
        }

        facet P36_PROJECT (
            type: checkboxGroup
            label {
                label: Project
                showLabelForCurrentFacet: false
            }
            lov {
                type: sharedComponent
                lov: @distinct-projects
            }
            layout {
                sequence: 20
            }
            listEntries {
                maxDisplayedEntries: 5
                allowToExclude: false
            }
            actionsMenu {
                filter: false
            }
            advanced {
                collapsible: true
            }
            source {
                databaseColumn: PROJECT
            }
        )

        facet P36_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
        )

    )

    region tasks (
        name: Tasks
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                   id,
                   project,
                   task_name,
                   status,
                   assigned_to,
                   cost,
                   start_date,
                   end_date,
                   case
                      when status = 'Pending' then 'apex-cal-blue'
                      when status = 'Open' then 'apex-cal-green'
                      when status = 'Closed' then 'apex-cal-gray'
                      when status = 'On-Hold' then 'apex-cal-orange'
                   end as css_class
                from eba_demo_cal_projects
                order by end_date
                ```
        }
        layout {
            sequence: 40
            slot: body
            startNewRow: false
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
            displayColumn: TASK_NAME
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            multipleLineEvents: false
            calendarViewsAndNavigation: [
                month
                week
                day
                list
                navigation
            ]
            viewEditLink: {
                page: 3
                items: {
                    P3_ID: &ID.
                    P3_LASTVIEW: &APP_PAGE_ID.
                }
                action: resetPagination
            }
            maxEventsDay: 3
            cssClass: CSS_CLASS
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function (p) {
                 p.endDateExclusive = false;
                }
                ```
        }
    )

    dynamicAction change-project-refresh-calendar (
        name: Change Project - Refresh Calendar
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P36_PROJECTS
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @tasks
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction dialog-closed (
        name: Dialog closed
        execution {
            sequence: 20
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @tasks
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @tasks
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
