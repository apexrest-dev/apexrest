# Raise Salary — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00403-raise-employee-salary.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 80cca2801e5a17fa4b5fd9884ff99784dae4d3f2ea9c429927b79fe447212d16.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 403 (
    name: Raise Salary
    alias: RAISE-EMPLOYEE-SALARY
    title: Raise Salary
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region button (
        name: Button
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    pageItem P403_MESSAGE (
        type: hidden
        layout {
            sequence: 60
            slot: contentBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P403_RESPONSE (
        type: hidden
        settings {
            valueProtected: false
        }
        layout {
            sequence: 40
            slot: contentBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P403_STATUS (
        type: hidden
        layout {
            sequence: 50
            slot: contentBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P_DIALOG_EMP_NO (
        type: popupLov
        label {
            label: Employee
            alignment: left
        }
        settings {
            additionalOutputs: OLD_SALARY:P_DIALOG_NEW_SALARY
        }
        lov {
            type: sharedComponent
            lov: @employee-popup-lov
            nullDisplayValue: - Select -
        }
        layout {
            sequence: 10
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            valueRequired: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P_DIALOG_NEW_SALARY (
        type: numberField
        label {
            label: New Salary
            alignment: left
        }
        layout {
            sequence: 20
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            valueRequired: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button apply-changes (
        buttonName: Apply_Changes
        label: Apply Changes
        layout {
            sequence: 20
            region: @button
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            databaseAction: insert
        }
        advanced {
            htmlDomId: send_raise
        }
    )

    button cancel (
        buttonName: Cancel
        label: Cancel
        layout {
            sequence: 10
            region: @button
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
    )

    dynamicAction cancel-dialog (
        name: Cancel Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    process raise-salary (
        name: raise salary
        type: invokeApi
        invoke {
            type: restSource
            restSource: @eba_rest_employee_invokeapi
            operation: @put
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 7355974236548513
        }
        serverSideCondition {
            whenButtonPressed: @apply-changes
        }

        parameter (
            name: @id
            value {
                type: item
                item: P_DIALOG_EMP_NO
            }
        )

        parameter (
            name: @message
            parameter {
                ignoreOutput: false
            }
            value {
                type: item
                item: P403_MESSAGE
            }
        )

        parameter (
            name: @sal
            value {
                type: item
                item: P_DIALOG_NEW_SALARY
            }
        )

        parameter (
            name: @status
            parameter {
                ignoreOutput: false
            }
            value {
                type: item
                item: P403_STATUS
            }
        )

        parameter (
            name: @content-type
            value {
                type: restSourceDefault
            }
        )

    )

    process return-back (
        name: return back
        type: closeDialog
        settings {
            itemsToReturn: [
                P403_STATUS
                P403_MESSAGE
            ]
            showSuccessMessages: false
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 7358843278548515
        }
    )

)


````
