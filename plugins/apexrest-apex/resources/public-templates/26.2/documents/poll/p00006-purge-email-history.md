# Purge Email History — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00006-purge-email-history.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f78ee9f1facee69ff7f6dcb4a7b18efa35a279771c788347d1c92722836fa710.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 6 (
    name: Purge Email History
    alias: PURGE-EMAIL-HISTORY
    title: Purge Email History
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

    region purge-email-history (
        name: Purge Email History
        type: staticContent
        source {
            htmlCode: All other logs are kept for 21 days.  Email History is manually maintained.  You can enter 0 to remove all history.
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P6_NBR_DAYS_TO_KEEP (
        type: numberField
        label {
            label: Number of Days to Keep
            alignment: left
        }
        settings {
            minValue: 0
            virtualKeyboard: text
        }
        layout {
            sequence: 10
            region: @purge-email-history
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
        label: Purge Email History
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
            executionMappingIdentifier: 567790265714869940
        }
    )

    process purge (
        name: Purge
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                delete from eba_qpoll_emails
                 where sent_time < localtimestamp-:P6_NBR_DAYS_TO_KEEP;
                
                eba_qpoll_account.add_application_log (
                   p_activity => 'Purged Email History',
                   p_details  => 'keeping ' || :P6_NBR_DAYS_TO_KEEP || ' days');
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
            executionMappingIdentifier: 567790671175869941
        }
        serverSideCondition {
            whenButtonPressed: @purge
        }
    )

)


````
