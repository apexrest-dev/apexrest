# Reset Data — Sample Collections

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-collections/apexlang/sample-collections/pages/p00039-reset-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 36aa676fd3c06445d8532323f62bdfc60478c3ada8a6de7f22075c880d1adcab.

Application dependency inventory: oracle:26.2:public-template/sample-collections/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 39 (
    name: Reset Data
    alias: RESET-DATA
    title: Reset Data
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumbs
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

    region manage-sample-application (
        name: Manage Sample Application
        type: staticContent
        source {
            htmlCode: <span class="infoTextRegion"><p>Click the reset data button to reset the data to default values.</p></span>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @breadcrumb
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 35
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-data (
        buttonName: reset_data
        label: Reset Data
        layout {
            sequence: 20
            region: @breadcrumb
            slot: edit
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
        name: reset data
        type: executeCode
        source {
            plsqlCode: eba_demo_cs_emp_data;
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Data has been reset to default values.
        }
        advanced {
            executionMappingIdentifier: 1318681664518411746
        }
    )

    branch (
        name: go back to admin
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 35
                action: resetPagination
            }
        }
    )

)


````
