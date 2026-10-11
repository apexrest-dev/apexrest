# 100 Transactions Generated — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00031-transactions-generated.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d48ada2d4ca69b0422275f998314e8c2767d8f155eae2a2978bfec03475afd53.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 31 (
    name: 100 Transactions Generated
    alias: TRANSACTIONS-GENERATED
    title: 100 Transactions Generated
    pageGroup: @data-generation
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

    region generate-100-transactions-on-page-load (
        name: Generate 100 Transactions on Page Load
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region show-last-generation (
        name: show last generation
        type: plSqlDynamicContent
        source {
            plsqlCode: oow_demo_gen_data_pkg.exec_100_transactions;
        }
        layout {
            sequence: 20
            parentRegion: @generate-100-transactions-on-page-load
            slot: subRegions
        }
    )

    region timing (
        name: Timing
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                declare
                   x clob;
                begin
                    x := to_char(oow_demo_timing.get_elap,'99G9990D000')||' seconds';
                    return x;
                end;
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
    )

    pageItem P31_TRANSACTION_ID (
        type: hidden
        layout {
            sequence: 10
            region: @generate-100-transactions-on-page-load
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button refresh-page (
        buttonName: refresh_page
        label: Generate 100 Transactions
        layout {
            sequence: 30
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
                t-Button--iconLeft
            ]
            icon: fa-gear
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 31
            }
            warnOnUnsavedChanges: doNotCheck
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

    process start-timer (
        name: start timer
        type: executeCode
        source {
            plsqlCode: oow_demo_timing.start_timer;
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 12014853657244092289
        }
    )

    branch (
        name: Go to Calling Page
        execution {
            sequence: 20
        }
        behavior {
            target: {
                page: &LAST_VIEW.
                action: resetPagination
            }
        }
    )

)


````
