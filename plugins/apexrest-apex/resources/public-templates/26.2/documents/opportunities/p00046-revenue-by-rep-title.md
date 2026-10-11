# Revenue by &REP_TITLE. — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00046-revenue-by-rep-title.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 3ee2c1f4dfc40fb2700a9a9916a649f2eb50c4e6c91407c7c29143d0531202c9.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 46 (
    name: Revenue by &REP_TITLE.
    alias: REVENUE-BY-REP-TITLE
    title: Revenue by &REP_TITLE_RAW.
    pageGroup: @reports
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText:
            ```html
            This page shows a donut pie chart depicting revenue by &REP_TITLE.. Change the "Quarter" and/or "Territory" filter values to vary the pie chart's results.
            
            ```
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
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

    region button-bar (
        name: Button Bar
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noPadding
                t-ButtonRegion--noUI
            ]
        }
    )

    region revenue-by-rep-title (
        name: Revenue by &REP_TITLE.
        type: chart
        source {
            pageItemsToSubmit: [
                P46_QUARTER
                P46_TERRITORY
            ]
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
        }
        chart {
            type: donut
        }
        chartLayout {
            height: 300
        }
        performance {
            lazyLoading: true
        }
        dataCursor {
            dimOnHover: false
        }
        animation {
            onDataChange: none
        }
        legend {
            hideAndShowBehavior: none
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
                    select sr.REP_LAST_NAME||', '|| sr.REP_FIRST_NAME||' - '||(select territory_name from eba_sales_territories t where t.id = c.customer_territory_id) label,
                           case when apex_util.get_build_option_status(
                                         p_application_id    => :APP_ID,
                                         p_build_option_name => 'Opportunity Amount Set at Product Level'
                                     ) = 'EXCLUDE' then
                               sum(d.deal_amount)
                           else
                               sum(nvl((select sum(nvl(dp.quote_price, 0.00)) from EBA_SALES_DEAL_PRODUCTS dp where dp.deal_id = d.id), 0))
                           end as value,
                           sr.id sales_rep_id
                      from EBA_SALES_SALESREPS sr,
                           EBA_SALES_DEALS d,
                           EBA_SALES_CUSTOMERS c
                     where d.SALESREP_ID_01 = sr.ID (+)
                       and d.customer_id = c.id 
                       and (nvl(:P46_QUARTER,'0') = '0' or d.qtr = :P46_QUARTER)
                       and (nvl(:P46_TERRITORY,'0') = '0' or c.customer_territory_id = :P46_TERRITORY)
                       and DEAL_PROBABILITY = 100
                    group by sr.REP_LAST_NAME||', '|| sr.REP_FIRST_NAME, sr.id, c.customer_territory_id
                    order by 3 desc
                    ```
            }
            columnMapping {
                label: LABEL
                value: VALUE
            }
            label {
                show: true
                displayAs: percentage
            }
        )

    )

    pageItem P46_QUARTER (
        type: selectList
        label {
            label: Quarter
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @quarter-past-and-current
            displayExtraValues: false
            nullDisplayValue: - All -
            nullReturnValue: 0
        }
        layout {
            sequence: 10
            region: @button-bar
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select PERIOD_NAME from eba_sales_sales_periods
                 where sysdate between first_day and last_day
                ```
        }
    )

    pageItem P46_TERRITORY (
        type: selectList
        label {
            label: Territory
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @territory
            nullDisplayValue: - All -
            nullReturnValue: 0
        }
        layout {
            sequence: 20
            region: @button-bar
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            type: staticValue
            staticValue: 0
        }
        default {
            type: static
            staticValue: 0
        }
        config {
            buildOption: @territories
        }
    )

    button reset-chart (
        buttonName: RESET_CHART
        label: Reset
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 46
                clearCache: 46
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction p46-quarter-or-p46-territory-changed (
        name: P46_QUARTER or P46_TERRITORY changed
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: [
                P46_QUARTER
                P46_TERRITORY
            ]
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @revenue-by-rep-title
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    computation last-page (
        itemName: LAST_PAGE
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: staticValue
            staticValue: 46
        }
    )

)


````
