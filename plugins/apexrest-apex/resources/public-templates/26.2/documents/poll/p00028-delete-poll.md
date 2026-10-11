# Delete Poll — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00028-delete-poll.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 76102b07a025d3a741bf92050e9ab0c842d448565ea55c545e31f33a2b179e40.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 28 (
    name: Delete Poll
    alias: DELETE-POLL
    title: Delete Poll
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

    region delete-poll (
        name: Delete Poll
        type: staticContent
        source {
            htmlCode: <p>Please confirm you want to delete this poll and all information about it.  It will not delete the question set used, but will delete all responses and poll data.</p>
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

    region new (
        name: New
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

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @new
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

    button delete (
        buttonName: DELETE
        label: Delete Poll
        layout {
            sequence: 10
            region: @new
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

    process delete-poll (
        name: delete poll
        type: executeCode
        source {
            plsqlCode: delete from eba_qpoll_polls where id = :POLL_ID;
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Poll Deleted.
        }
        advanced {
            executionMappingIdentifier: 13932210190164355586
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    branch (
        name: Branch to Polls Page
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 1
                action: resetPagination
            }
        }
    )

)


````
