# Preferences — Sample Master Detail

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-master-detail/apexlang/sample-master-detail/pages/p00025-preferences.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 105e738003bce3490d07a715c7f056441ba471f46b502a7f6b36654bd5bedeeb.

Application dependency inventory: oracle:26.2:public-template/sample-master-detail/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 25 (
    name: Preferences
    alias: PREFERENCES
    title: Preferences
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
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

    region preferences (
        name: Preferences
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
    )

    pageItem P25_ENABLE_FEEDBACK (
        type: radioGroup
        label {
            label: Enable Feedback
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Yes;YES,No;NO
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @preferences
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        validation {
            valueRequired: true
        }
        source {
            type: staticValue
            staticValue: &ENABLE_FEEDBACK.
            used: always
        }
        default {
            type: static
            staticValue: NO
        }
    )

    button apply-changes (
        buttonName: APPLY_CHANGES
        label: Set Preferences
        layout {
            sequence: 20
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

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
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
                page: 24
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process set-feedback (
        name: Set Feedback
        type: executeCode
        source {
            plsqlCode: :ENABLE_FEEDBACK := :P25_ENABLE_FEEDBACK;
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Feedback Preference Set.
        }
        advanced {
            executionMappingIdentifier: 4549859055315154341
        }
        serverSideCondition {
            whenButtonPressed: @apply-changes
        }
    )

    branch (
        name: Go To Page 24
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 24
            }
        }
        comments {
            comments: Created 12-APR-2012 16:01 by MIKE
        }
    )

)


````
