# Username Format — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00043-username-format.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 982fc52670d5166abef017537f0dc03bb92c4c032a3a1885fc88254eb12af1c2.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 43 (
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
        helpText: No help is available for this page.
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
        source {
            htmlCode: <p>Define whether new users of this application will have an email address username format (e.g. xyz@xyz.com) or a non-email address format (e.g. JOHNDOE)</p>
        }
        layout {
            sequence: 20
            slot: body-3
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--warning
                t-Alert--horizontal
            ]
            cssClasses: infoTextRegion
            renderComponents: belowContent
        }
        headerAndFooter {
            footerText: For this application, it is recommended to use the email address username format because the application can be used to email invitations to users.
        }
    )

    pageItem P43_USERNAME_FORMAT (
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
            plsqlExpression: eba_qpoll_fw.get_preference_value ('USERNAME_FORMAT')
            used: always
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
                page: &LAST_VIEW.
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
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

    process set-username-format-preference (
        name: Set Username Format Preference
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                eba_qpoll_fw.set_preference_value (
                    p_preference_name  => 'USERNAME_FORMAT',
                    p_preference_value => :P43_USERNAME_FORMAT);
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
            executionMappingIdentifier: 14622363101876198712
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
                page: &LAST_VIEW.
            }
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
