# Close Poll — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00011-close-poll.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 9a226baf3bfa7b4399130c7ca112821764acdbf08e4e56a318a308b7f3775919.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Close Poll
    alias: CLOSE-POLL
    title: Close Poll
    pageGroup: @polls
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        width: 480
        height: 240
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region buttons (
        name: buttons
        type: staticContent
        layout {
            sequence: 10
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region close-poll (
        name: Close Poll
        type: staticContent
        source {
            htmlCode: <p>Please confirm you want to mark this poll as Closed.  Once Closed, no new responses will be allowed.</p>
        }
        layout {
            sequence: 10
            slot: wizardBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button close (
        buttonName: CLOSE
        label: Close Poll
        layout {
            sequence: 10
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--danger
                t-Button--gapLeft
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
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

    process close-poll (
        name: close poll
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                update eba_qpoll_polls
                   set status_id = 4
                 where id = :POLL_ID
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Poll has been marked as Closed.
        }
        advanced {
            executionMappingIdentifier: 252353780077817346
        }
        serverSideCondition {
            whenButtonPressed: @close
        }
    )

    branch (
        name: close
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 100
                action: resetPagination
            }
        }
    )

)


````
