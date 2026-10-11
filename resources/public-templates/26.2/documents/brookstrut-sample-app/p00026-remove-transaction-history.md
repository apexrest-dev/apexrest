# Remove Transaction History — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00026-remove-transaction-history.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6588d3f0ddb49794f48d043bde3c87b59e0c9840fb76b08ae859e8a17b064735.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 26 (
    name: Remove Transaction History
    alias: REMOVE-TRANSACTION-HISTORY
    title: Remove Transaction History
    pageGroup: @data-generation
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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

    region tranaction-count (
        name: Tranaction Count
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                declare
                    r clob;
                    c int;
                begin
                    for c1 in (select count(*) c from oow_demo_sales_history) loop
                        c := c1.c;
                    end loop;
                    return '<font size="+10">Transaction Count: '||to_char(nvl(c,0),'FM999G999G999G999G990')||' </font>';
                end;
                
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--defaultIcons
                t-Alert--warning
                t-Alert--accessibleHeading
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    button cancel (
        buttonName: Cancel
        label: Cancel
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 28
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button remove-transactions (
        buttonName: Remove_transactions
        label: Remove History
        layout {
            sequence: 10
            region: @tranaction-count
            slot: close
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
                t-Button--iconLeft
            ]
            icon: fa-trash
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            requiresConfirmation: true
        }
        confirmation {
            message: Please confirm you wish to remove all existing transaction history
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
                page: 28
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process remove-transactions (
        name: remove_transactions
        type: executeCode
        source {
            plsqlCode: execute immediate 'truncate table oow_demo_sales_history';
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 14804248753553624702
        }
        serverSideCondition {
            whenButtonPressed: @remove-transactions
        }
    )

)


````
