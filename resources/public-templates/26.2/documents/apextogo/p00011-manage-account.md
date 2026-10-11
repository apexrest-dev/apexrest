# Manage Account — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00011-manage-account.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: dadd35eb2599d8b9b34a940547d71598846145cb9118cbb34af6a7bccbf54ab6.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Manage Account
    alias: MANAGE-ACCOUNT
    title: Manage Account
    pageGroup: @user-settings
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }

    region actions (
        name: Actions
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--stacked
                t-Region--scrollBody
            ]
        }
    )

    pageItem P11_EMAIL (
        type: textField
        label {
            label: Email
            alignment: left
        }
        settings {
            subtype: email
        }
        layout {
            sequence: 100
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        default {
            type: static
            staticValue: &APP_USER.@domain.com
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P11_LASTNAME (
        type: textField
        label {
            label: Last Name
            alignment: left
        }
        layout {
            sequence: 80
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        default {
            type: static
            staticValue: &APP_USER.
        }
    )

    pageItem P11_NAME (
        type: textField
        label {
            label: First Name
            alignment: left
        }
        layout {
            sequence: 70
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        default {
            type: static
            staticValue: &APP_USER.
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P11_PHONE_NUMBER (
        type: textField
        label {
            label: Phone Number
            alignment: left
        }
        settings {
            subtype: phone
        }
        layout {
            sequence: 90
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        default {
            type: static
            staticValue: (123) 456-7890
        }
    )

    pageItem P11_PROFILE_PIC (
        type: imageUpload
        label {
            label: Image upload
            alignment: left
        }
        display {
            displayAs: blockDropzone
        }
        storage {
            type: appTempFiles
        }
        layout {
            sequence: 60
            slot: contentBody
            alignment: left
            labelColumnSpan: 0
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--stretchInputs
            ]
            width: 30
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button back (
        buttonName: BACK
        label: Account
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--simple
                t-Button--iconLeft
                t-Button--gapBottom
            ]
            icon: fa-chevron-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 20000
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 10
            region: @actions
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
                t-Button--stretch
                t-Button--padTop
            ]
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
    )

    branch (
        name: Go To Page 20000
        execution {
            sequence: 10
            point: afterSubmit
        }
        behavior {
            target: {
                page: 20000
            }
        }
    )

)


````
