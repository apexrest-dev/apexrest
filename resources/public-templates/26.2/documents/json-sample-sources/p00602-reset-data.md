# Reset Data — Json Sample Sources

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/pages/p00602-reset-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a50ed765f010b24343eeccf4989a312f7facd1b9de84abd28749ddea3eeea5f1.

Application dependency inventory: oracle:26.2:public-template/json-sample-sources/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 602 (
    name: Reset Data
    alias: RESET-DATA
    title: Reset Data
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: @administration-rights
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

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @reset-data
            slot: subRegions
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

    region reset-data (
        name: Reset Data
        type: staticContent
        source {
            htmlCode: <p>Click the <strong>Reset Data</strong> button to reset data used in this application to its initial defaults.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--defaultIcons
                t-Alert--info
            ]
        }
    )

    button cancel (
        buttonName: Cancel
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 600
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-data (
        buttonName: Reset_Data
        label: Reset Data
        layout {
            sequence: 10
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process load-product-images (
        name: Load product images
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin 
                    eba_demo_json_data_pkg.load_product_images(:APP_ID,'product_images.zip');
                end;    
                ```
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 11886800705269337
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
            type: noRowsReturned
            sqlQuery: select * from eba_demo_json_products where product_image is not null
        }
    )

    process reset-data (
        name: Reset Data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    eba_demo_json_data_pkg.reset_data;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: The sample data used in this application has been reset successfully.
        }
        error {
            errorMessage: Error while resetting the data. Please try again.
        }
        advanced {
            executionMappingIdentifier: 4455571935920187
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
    )

    branch (
        name: go back to home
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 1
            }
        }
    )

)


````
