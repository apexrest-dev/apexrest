# Cumulative Flow — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00161-cumulative-flow.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: be1cca815b7a022247163c4d39e1781507c016d2734774f5d385dc504c00ab64.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 161 (
    name: Cumulative Flow
    alias: CUMULATIVE-FLOW
    title: Cumulative Flow
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
        ]
    }
    dialog {
        width: 800
        height: 600
        resizable: false
    }
    config {
        buildOption: @kanban
    }

    region cumulative-flow (
        name: Cumulative Flow
        type: chart
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
            type: area
        }
        chartAppearance {
            stack: true
        }
        chartLayout {
            height: 800
        }
        performance {
            lazyLoading: true
        }
        multiSeriesChartData {
            sortOrder: valueAsc
        }
        settings {
            timeAxisType: enabled
            zoomAndScroll: liveScrollOnly
        }
        legend {
            title: % Complete
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
                    select  
                           x.d,
                           nvl(y.pct_complete,0) pct_complete,
                           count(y.id) Qty
                      from
                           (select sysdate - ((level - 1) * to_number(:P161_RESOLUTION)) d
                              from   dual
                           connect by level <= (sysdate - add_months(sysdate, 0 - to_number(:P161_SCOPE))) / to_number(:P161_RESOLUTION)) x
                      left outer join
                           (select
                                   id,
                                   case lead(first_value) over (partition by id order by changed_date)
                                     -- if next first value is first in history then use the old value
                                     when 1 then lead(old_value) over (partition by id order by changed_date)
                                     else new_value
                                   end pct_complete,
                                   changed_date from_date,
                                   nvl(lead(changed_date) over (partition by id order by changed_date),sysdate) to_date
                              from (
                                     select
                                            pr.id,
                                            0            first_value,
                                            null         old_value,
                                            to_char(pr.pct_complete) new_value,
                                            pr.created    changed_date,
                                            pr.initiative_id,
                                            pr.status_scale,
                                            pr.duplicate_of_project_id,
                                            pr.archived_yn,
                                            pr.focus_area_id
                                       from sp_projects pr
                                      union all
                                     select
                                            pr.id,
                                            rank() over (partition by ph.project_id order by ph.changed_on) as first_value,
                                            ph.old_value,
                                            ph.new_value,
                                            ph.changed_on,
                                            pr.initiative_id,
                                            pr.status_scale,
                                            pr.duplicate_of_project_id,
                                            pr.archived_yn,
                                            pr.focus_area_id
                                       from sp_projects pr
                                      inner join sp_project_history ph on pr.id = ph.project_id
                                                                     and ph.attribute_column = 'PCT_COMPLETE'
                                                                     and ph.new_value is not null
                                   )
                                where initiative_id = :P161_INITIATIVE_ID
                                --and status_scale = 'A'
                                and archived_yn = 'N' 
                                and duplicate_of_project_id is null
                                and (nvl(focus_area_id,'0') = :P161_FOCUS_AREA or :P161_FOCUS_AREA is null)
                            ) y 
                        on x.d between y.from_date and y.to_date
                     group by x.d, y.pct_complete  
                    order by to_number(pct_complete) desc
                    ```
                pageItemsToSubmit: [
                    P161_RESOLUTION
                    P161_SCOPE
                    P161_FOCUS_AREA
                ]
            }
            columnMapping {
                seriesName: PCT_COMPLETE
                label: D
                value: QTY
            }
        )

        axis x (
            name: x
            title: Time
            value {
                format: dateShort
                pattern: MMM yyyy
                baselineScaling: min
            }
            majorTicks {
                show: auto
            }
            minorTicks {
                show: true
            }
        )

        axis y (
            name: y
            title: Count
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            majorTicks {
                show: auto
            }
            minorTicks {
                show: false
            }
        )

    )

    pageItem P161_FOCUS_AREA (
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
            sequence: 30
            region: @cumulative-flow
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

    pageItem P161_INITIATIVE_ID (
        type: hidden
        layout {
            sequence: 50
            region: @cumulative-flow
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P161_RESOLUTION (
        type: selectList
        label {
            label: Resolution
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:Daily;1,Weekly;7,2 Weeks;14,4 Weeks;28
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @cumulative-flow
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        default {
            type: static
            staticValue: 1
        }
    )

    pageItem P161_SCOPE (
        type: selectList
        label {
            label: Timescale
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:3 Months;3,6 Months;6,1 Year;12,2 Years;24,3 Years;36,5 Years;60
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 20
            region: @cumulative-flow
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
            staticValue: 24
        }
    )

    dynamicAction change-resolution (
        name: Change Resolution
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: [
                P161_RESOLUTION
                P161_SCOPE
                P161_FOCUS_AREA
            ]
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @cumulative-flow
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
