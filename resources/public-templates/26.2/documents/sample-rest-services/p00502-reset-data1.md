# Reset Data — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00502-reset-data1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b18c22f5a1dce7603a7a96410203830738ca775fe1155a9bca3dd32881609873.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 502 (
    name: Reset Data
    alias: RESET-DATA1
    title: Reset Data
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

    region reset-data (
        name: Reset Data
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Click the <strong>Reset Data</strong> button to reset data used in this application to its initial defaults.</p>
                <p>This action is irreversible, so please proceed with caution.</p>
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
                t-Alert--noIcon
                t-Alert--warning
                t-Alert--accessibleHeading
            ]
        }
    )

    button reset-data (
        buttonName: Reset_Data
        label: Reset Data
        layout {
            sequence: 10
            region: @breadcrumb
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

    process reset-data (
        name: Reset Data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                       eba_demo_rest_data_pkg.reset_data;
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
            executionMappingIdentifier: 7460082006787277
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
    )

    branch (
        name: go back to administration
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 500
            }
        }
    )

)


````
