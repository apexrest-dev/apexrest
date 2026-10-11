# Support — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00014-support.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 29753f76da7eb236bb499783720cafd1af304903dcd912afc03b3bd31781e903.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 14 (
    name: Support
    alias: SUPPORT
    title: Support
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

    pageItem P14_FEEDBACK (
        type: textarea
        label {
            label: Feedback
            alignment: left
        }
        layout {
            sequence: 40
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
            height: 16
            valuePlaceholder: We are here to help you with any questions or issues you may have.
        }
        source {
            used: always
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

    button send (
        buttonName: SEND
        label: Send
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
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process push-queue (
        name: Push Queue
        type: invokeApi
        invoke {
            package: APEX_PWA
            procedureOrFunction: PUSH_QUEUE
        }
        execution {
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 46688410916296627
        }
        serverSideCondition {
            whenButtonPressed: @send
            type: expression
            plsqlExpression: apex_pwa.has_push_subscription
        }
    )

    process send-notification (
        name: Send Notification
        type: invokeApi
        invoke {
            package: APEX_PWA
            procedureOrFunction: SEND_PUSH_NOTIFICATION
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 46687040067296613
        }
        serverSideCondition {
            whenButtonPressed: @send
            type: expression
            plsqlExpression: apex_pwa.has_push_subscription
        }

        parameter p_application_id (
            parameter {
                dataType: number
                hasDefault: true
            }
            value {
                type: apiDefault
            }
            advanced {
                displaySequence: 10
            }
        )

        parameter p_body (
            parameter {
                hasDefault: true
            }
            value {
                type: staticValue
                staticValue: We will get back to you soon
            }
            advanced {
                displaySequence: 40
            }
        )

        parameter p_icon_url (
            parameter {
                hasDefault: true
            }
            value {
                type: apiDefault
            }
            advanced {
                displaySequence: 50
            }
        )

        parameter p_target_url (
            parameter {
                hasDefault: true
            }
            value {
                type: apiDefault
            }
            advanced {
                displaySequence: 60
            }
        )

        parameter p_title (
            value {
                type: staticValue
                staticValue: Thank you for reaching out to us
            }
            advanced {
                displaySequence: 30
            }
        )

        parameter p_user_name (
            value {
                type: item
                item: APP_USER
            }
            advanced {
                displaySequence: 20
            }
        )

    )

    branch (
        name: Go To Page 20000
        execution {
            sequence: 20
        }
        behavior {
            target: {
                page: 20000
            }
        }
        serverSideCondition {
            whenButtonPressed: @send
        }
    )

)


````
