# Email Settings — Sample Approvals

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-approvals/apexlang/sample-workflow-approvals/pages/p00011-email-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a9667884f9e3901f0acd7fb76f62ffb42b10074c69d9276717e4018cc67fdb8a.

Application dependency inventory: oracle:26.2:public-template/sample-approvals/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Email Settings
    alias: EMAIL-SETTINGS
    title: Email Settings
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
            htmlCode: <p>The Job Change task definition conditionally sends an email notification upon task completion with an Approved outcome. The email will go to the address you configure on this page as an application setting. If this setting is blank, the Job Change approval email is skipped by evaluating an application item whose value is computed from this setting.</p>
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

    region email-settings (
        name: Email Settings
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

    pageItem P11_DEMO_NOTIFICATION_EMAIL (
        type: textField
        label {
            label: Email for Demo Notification
            alignment: left
        }
        layout {
            sequence: 20
            slot: body
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        sessionState {
            storage: request
        }
    )

    button save (
        buttonName: Save
        label: Save
        layout {
            sequence: 30
            slot: body
            column: 1
            columnSpan: 1
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    validation valid-email (
        name: Valid Email
        execution {
            sequence: 10
        }
        validation {
            plsqlExpression: "regexp_like (:P11_DEMO_NOTIFICATION_EMAIL, '^[A-Za-z]+[A-Za-z0-9.]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,4}$')"
        }
        error {
            errorMessage: Please provide a valid email address.
        }
    )

    computation p11-demo-notification-email (
        itemName: P11_DEMO_NOTIFICATION_EMAIL
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: expression
            plsqlExpression: apex_app_setting.get_value('DEMO_NOTIFICATION_EMAIL');
        }
    )

    process update-app-setting (
        name: Update App Setting
        type: executeCode
        source {
            plsqlCode: apex_app_setting.set_value('DEMO_NOTIFICATION_EMAIL',:P11_DEMO_NOTIFICATION_EMAIL);
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 584383060744672813
        }
    )

)


````
