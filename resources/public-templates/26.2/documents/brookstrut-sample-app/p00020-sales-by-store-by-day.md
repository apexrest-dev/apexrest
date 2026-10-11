# Sales by Store by Day — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00020-sales-by-store-by-day.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fc8779543da9c16d57013f76c5e5b6cade73d191eb82068a97b7d86453ede6d7.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 20 (
    name: Sales by Store by Day
    alias: SALES-BY-STORE-BY-DAY
    title: Sales by Store by Day
    pageGroup: @reporting
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    advanced {
        reloadOnSubmit: always
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 20
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

    region sales-by-store-by-day (
        name: Sales by Store by Day
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select (select store_name from oow_demo_stores s where s.id = sh.store_id)||' - '||
                        to_char(sum(sh.item_price * sh.QUANTITY),'$999G999G999G999G990')||
                       '('||count(*)||')' sales,
                       sh.store_id,
                       trunc(sh.date_of_sale) sale_date,
                       sum(sh.quantity) units_sold
                from OOW_DEMO_SALES_HISTORY sh
                group by sh.store_id, trunc(sh.date_of_sale)
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        settings {
            displayColumn: SALES
            startDateColumn: SALE_DATE
            additionalCalendarViews: [
                list
                navigation
            ]
            export: csv
        }
        performance {
            lazyLoading: true
        }
    )

    button up (
        buttonName: up
        label: Up
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
                page: 19
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
