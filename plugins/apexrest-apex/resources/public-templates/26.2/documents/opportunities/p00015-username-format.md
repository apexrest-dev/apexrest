# Username Format — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00015-username-format.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 3192703e77ef22c50373befefb290621dd9cedd1a72c7d8080638594747b47ed.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 15 (
    name: Username Format
    alias: USERNAME-FORMAT
    title: Username Format
    pageGroup: @acl
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: Choose a username format and click the <strong>Apply Changes</strong> button to activate the change.
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

    region username-format-preference (
        name: Username Format Preference
        type: staticContent
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
            renderComponents: belowContent
        }
    )

    pageItem P15_USERNAME_FORMAT (
        type: radioGroup
        label {
            label: Username Format
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @username-format
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @username-format-preference
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
        }
        validation {
            valueRequired: true
        }
        source {
            type: expression
            plsqlExpression: eba_sales_acl_api.get_preference_value ('USERNAME_FORMAT')
            used: always
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
                page: 33
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
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

    process set-username-format-preference (
        name: Set Username Format Preference
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                eba_sales_acl_api.set_preference_value (
                    p_preference_name  => 'USERNAME_FORMAT',
                    p_preference_value => :P15_USERNAME_FORMAT);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Username format updated.
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 7321116840074180875
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: &LAST_PAGE.
            }
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
