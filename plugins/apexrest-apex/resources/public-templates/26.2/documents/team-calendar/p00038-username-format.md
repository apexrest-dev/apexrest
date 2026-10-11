# Username Format — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00038-username-format.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d5c7d656d95f421f3bb0dd388ce641cde4f7e8764891aa77cbf5daa020936998.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 38 (
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
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: <p>Choose a username format and click the <strong>Apply Changes</strong> button to activate the change. Click the <strong>Cancel</strong> button to leave this page.</p>
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
    )

    pageItem P38_USERNAME_FORMAT (
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
            plsqlExpression: eba_ca_fw.get_preference_value ('USERNAME_FORMAT')
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
                eba_ca_fw.set_preference_value (
                    p_preference_name  => 'USERNAME_FORMAT',
                    p_preference_value => :P38_USERNAME_FORMAT);
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
            executionMappingIdentifier: 1417765611690754757
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
