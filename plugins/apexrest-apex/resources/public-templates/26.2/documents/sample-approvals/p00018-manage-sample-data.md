# Manage Sample Data — Sample Approvals

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-approvals/apexlang/sample-workflow-approvals/pages/p00018-manage-sample-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e6863e8b87689c90b8965e39a63918d823a3cbd7344ce4863c21a012a4c1d37b.

Application dependency inventory: oracle:26.2:public-template/sample-approvals/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 18 (
    name: Manage Sample Data
    alias: MANAGE-SAMPLE-DATA
    title: Manage Sample Data
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                    This page allows you to reset the sample employee, approver, salary history, 
                    laptop request, and appraisal data. It also deletes the workflows created in
                    development mode and any tasks created by those workflows. However, it does
                    not affect the <em>Job Change</em> and <em>Salary Change</em> approval task
                    instances created. The latter two kinds were created as standalone tasks
                    and <em>will</em> be deleted when the sample application is deleted.
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region manage-sample-data (
        name: Manage Sample Data
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

    button reset-sample-data (
        buttonName: Reset_Sample_Data
        label: Reset Sample Data
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process reset-sample-data (
        name: Reset_Sample_Data
        type: executeCode
        source {
            plsqlCode: eba_demo_appr_data.install_sample_data;
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Sample Data Reset.
        }
        advanced {
            executionMappingIdentifier: 268648326815404250
        }
        serverSideCondition {
            whenButtonPressed: @reset-sample-data
        }
    )

)


````
