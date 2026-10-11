# Control Chart — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00162-control-chart.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b245b3ff39a54950f0f80879f85d4c103b3da2c4be8d749419e1a93f4e03e455.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 162 (
    name: Control Chart
    alias: CONTROL-CHART
    title: Control Chart
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
    config {
        buildOption: @kanban
    }

    region control-chart (
        name: Control Chart
        type: chart
        source {
            pageItemsToSubmit: [
                P162_PROJECT_SIZE
                P162_PRIORITY
                P162_IN_PROGRESS_FROM
                P162_IN_PROGRESS_TO
            ]
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        security {
            escapeSpecialChars: false
        }
        chart {
            type: scatter
        }
        chartLayout {
            height: 800
        }
        performance {
            lazyLoading: true
        }
        legend {
            title: Sizes
        }

        series series (
            name: Series 1
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select y.*, rownum from (
                    select
                      x.id,
                      x.project,
                      x.created,
                      x.project_size,
                      x.status_scale,
                      x.pct_complete,
                      max(decode(x.new_value,:P162_IN_PROGRESS_TO,changed_on)) - min(decode(x.new_value,:P162_IN_PROGRESS_FROM,changed_on)) days
                    from 
                    (
                      select
                        pr.id,
                        pr.project,
                        pr.status_scale,
                        pr.created,
                        pr.pct_complete,
                        decode(ph.change_type,'CREATE',10, ph.new_value) new_value,
                        ph.changed_on,
                        pr.project_size
                      from sp_projects pr
                      inner join sp_project_history ph on pr.id = ph.project_id
                                                                     and (ph.attribute_column = 'PCT_COMPLETE' or ph.change_type = 'CREATE')
                      where (pr.priority_id = :P162_priority or :P162_PRIORITY is null)
                      and pr.initiative_id = :P162_INITIATIVE_ID
                      and pr.archived_yn = 'N' 
                      and (nvl(pr.focus_area_id,0) = :P162_FOCUS_AREA or :P162_FOCUS_AREA is null)
                      and pr.duplicate_of_project_id is null
                      --and pr.status_scale = 'A'
                      and (project_size = :P162_PROJECT_SIZE or :P162_PROJECT_SIZE is null)) x
                    where x.new_value in (:P162_IN_PROGRESS_FROM,:P162_IN_PROGRESS_TO)
                    group by 
                      x.id,
                      x.project,
                      x.project_size,
                      x.status_scale,
                      x.pct_complete,
                      x.created
                    order by x.created) y
                    ```
                pageItemsToSubmit: [
                    P162_PROJECT_SIZE
                    P162_PRIORITY
                    P162_IN_PROGRESS_FROM
                    P162_IN_PROGRESS_TO
                    P162_FOCUS_AREA
                ]
            }
            columnMapping {
                seriesName: PROJECT_SIZE
                label: PROJECT
                x: ROWNUM
                y: DAYS
                customTooltip: PROJECT
                labelTooltip: PROJECT
            }
            link {
                type: redirectThisApp
                target: {
                    page: 3
                    items: {
                        P3_PROJECT_ID: &ID.
                    }
                }
            }
        )

        axis x (
            name: x
            title: Projects Over Time
            majorTicks {
                show: auto
            }
        )

        axis y (
            name: y
            title: Days In Progress
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            majorTicks {
                show: auto
            }
        )

    )

    pageItem P162_FOCUS_AREA (
        type: selectList
        label {
            label: Focus Area
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select focus_area, id
                  from sp_initiative_focus_areas
                 where initiative_id = :P161_INITIATIVE_ID
                   and active_yn = 'Y'
                union all
                select
                  'Unallocated',
                  0
                from dual 
                 order by 1
                ```
        }
        layout {
            sequence: 60
            region: @control-chart
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
    )

    pageItem P162_INITIATIVE_ID (
        type: hidden
        layout {
            sequence: 70
            region: @control-chart
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P162_IN_PROGRESS_FROM (
        type: selectList
        label {
            label: % Complete From
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:0,10,20,30,40,50,60,70,80,90,100
            displayNullValue: false
        }
        layout {
            sequence: 40
            region: @control-chart
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        default {
            type: static
            staticValue: 50
        }
    )

    pageItem P162_IN_PROGRESS_TO (
        type: selectList
        label {
            label: % Complete To
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:0,10,20,30,40,50,60,70,80,90,100
            displayNullValue: false
        }
        layout {
            sequence: 50
            region: @control-chart
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        default {
            type: static
            staticValue: 80
        }
    )

    pageItem P162_PRIORITY (
        type: selectList
        label {
            label: Priority
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select description, id
                from sp_project_priorities
                ```
        }
        layout {
            sequence: 30
            region: @control-chart
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            used: always
        }
    )

    pageItem P162_PROJECT_SIZE (
        type: selectList
        label {
            label: Size
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select project_size d, project_size r 
                from sp_project_sizes ps
                where include_yn = 'Y'
                order by EFFORT_DAYS
                ```
            nullDisplayValue: All
        }
        layout {
            sequence: 20
            region: @control-chart
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--radioButtonGroup
            ]
            height: 1
        }
        help {
            helpText: &P24_SIZE_HELP_TEXT!RAW.
        }
    )

    dynamicAction size-change (
        name: Size Change
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: [
                P162_PROJECT_SIZE
                P162_PRIORITY
                P162_IN_PROGRESS_FROM
                P162_IN_PROGRESS_TO
                P162_FOCUS_AREA
            ]
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @control-chart
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
