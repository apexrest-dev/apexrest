# Manage Example Data — Sample File Upload Download

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-file-upload-download/apexlang/sample-file-upload-download/pages/p00010-manage-example-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e2fcdd0352f6e791862466e2797746be65256de25998eb56d8fb075927175ed7.

Application dependency inventory: oracle:26.2:public-template/sample-file-upload-download/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 10 (
    name: Manage Example Data
    alias: MANAGE-EXAMPLE-DATA
    title: Manage Example Data
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

    region manage-sample-data (
        name: Manage Sample Data
        type: staticContent
        source {
            htmlCode: <span class="infoTextRegion"><p>Manage the sample data that ships with this application for demonstration purposes.</p></span>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @breadcrumb
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 7
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button recreate (
        buttonName: recreate
        label: Recreate
        layout {
            sequence: 10
            region: @breadcrumb
            slot: create
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

    process recreate-data (
        name: recreate data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                EBA_DEMO_FILE_DATA.remove_data;
                EBA_DEMO_FILE_DATA.load_data;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Sample data re-created.
        }
        advanced {
            executionMappingIdentifier: 3241222206390073954
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 7
            }
        }
        comments {
            comments: Created 27-APR-2012 07:42 by MIKE
        }
    )

)


````
