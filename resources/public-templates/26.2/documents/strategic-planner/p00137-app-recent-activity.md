# App Recent Activity — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00137-app-recent-activity.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 713a0c8cac8b12e0837c2f97e6c6bc87027eac636505480b1dc1f20986fc54bc.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 137 (
    name: App Recent Activity
    alias: APP-RECENT-ACTIVITY
    title: App Recent Activity
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

    region app-recent-activity-24-hours (
        name: App Recent Activity (24 hours)
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 
                    USERID_LC username,
                    count(distinct l.step_id) ditinct_pages_viewed,
                    min(elap)            min_elapsed,
                    max(elap)            max_elapsed,
                    median(elap)         median_elapsed,
                    count(*)             events,
                    min(time_stamp)      first_event,
                    max(time_stamp)      most_recent_event
                from apex_activity_log l
                where flow_id = :app_id
                    and userid is not null
                    and time_stamp > sysdate - nvl(:P137_DAYS,1) and
                    userid_lc != 'nobody'
                group by USERID_LC
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        headerAndFooter {
            headerText: <p>Application activity in the last 24 hours.</p>
        }
        reportLayout {
            numberOfRows: 50
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--horizontalBorders
            ]
        }

        column DITINCT_PAGES_VIEWED (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Ditinct Pages Viewed
                alignment: end
            }
            layout {
                sequence: 30
                columnAlignment: end
            }
        )

        column EVENTS (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Events
                alignment: end
            }
            layout {
                sequence: 20
                columnAlignment: end
            }
        )

        column FIRST_EVENT (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: First Event
            }
            layout {
                sequence: 70
            }
            appearance {
                formatMask: SINCE_SHORT
            }
        )

        column MAX_ELAPSED (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Max Elapsed
                alignment: end
            }
            layout {
                sequence: 60
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G990D00
            }
        )

        column MEDIAN_ELAPSED (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Median Elapsed
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G990D00
            }
        )

        column MIN_ELAPSED (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Min Elapsed
                alignment: end
            }
            layout {
                sequence: 50
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G990D00
            }
        )

        column MOST_RECENT_EVENT (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Most Recent Event
            }
            layout {
                sequence: 80
            }
            appearance {
                formatMask: SINCE_SHORT
            }
            sorting {
                defaultSequence: 1
                direction: desc
            }
        )

        column USERNAME (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Username
            }
            layout {
                sequence: 10
            }
        )

    )

    region filter (
        name: Filter
        type: staticContent
        layout {
            sequence: 2
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P137_DAYS (
        type: selectList
        label {
            label: Days
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:1 day;1,2 days;2,3 days;3,7 days;7,2 weeks;14,4 weeks;28
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @filter
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
    )

    dynamicAction on-change (
        name: on change
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P137_DAYS
        }

        action native-execute-plsql-code (
            action: executeServerSideCode
            settings {
                plsqlCode: null;
                itemsToSubmit: P137_DAYS
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @app-recent-activity-24-hours
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

    )

    computation p137-days (
        itemName: P137_DAYS
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: staticValue
            staticValue: 1
        }
        serverSideCondition {
            type: itemIsNull
            item: P137_DAYS
        }
    )

)


````
