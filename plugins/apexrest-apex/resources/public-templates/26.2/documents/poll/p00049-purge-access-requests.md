# Purge Access Requests — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00049-purge-access-requests.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 627411e99fdb5a016eead8b59e2906636d63aabcdc1a1d97cbf6d4e0fc821603.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 49 (
    name: Purge Access Requests
    alias: PURGE-ACCESS-REQUESTS
    title: Purge Access Requests
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        chained: false
        resizable: false
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
        helpText: <p>Only Access Requests that have been approved or declined will be purged. Those with the status of 'pending' will be retained.</p>
    }

    region buttons (
        name: Buttons
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

    region purge-access-requests (
        name: Purge Access Requests
        type: staticContent
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P49_NBR_DAYS_TO_KEEP (
        type: numberField
        label {
            label: Number of Days to Keep
            alignment: left
        }
        settings {
            minValue: 30
            virtualKeyboard: text
        }
        layout {
            sequence: 10
            region: @purge-access-requests
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 5
        }
        validation {
            valueRequired: true
            maxLength: 5
        }
        default {
            type: static
            staticValue: 30
        }
        help {
            inlineHelpText: Note: 30 is the minimum number of days you can keep.
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button purge (
        buttonName: PURGE
        label: Purge Access Requests
        layout {
            sequence: 20
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--gapLeft
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction cnx (
        name: CNX
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

    process close-dialog (
        name: Close Dialog
        type: closeDialog
        settings {
            showSuccessMessages: false
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 7163942919360623345
        }
    )

    process purge (
        name: Purge
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                delete from eba_qpoll_access_requests
                 where status != 'pending'
                   and created_trunc < trunc(sysdate-:P49_NBR_DAYS_TO_KEEP);
                
                eba_qpoll_account.add_application_log (
                   p_activity => 'Purged Access Requests',
                   p_details  => 'keeping ' || :P49_NBR_DAYS_TO_KEEP || ' days');
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Purged Access Requests.
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 13902824876743447970
        }
        serverSideCondition {
            whenButtonPressed: @purge
        }
    )

)


````
