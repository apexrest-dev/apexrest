# Delete Test Data — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00082-delete-test-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0dab56f191c20656d5b7986015d3ffccb52bbbb1174d30a58bca995bf8c0ab83.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 82 (
    name: Delete Test Data
    alias: DELETE-TEST-DATA
    title: Delete Test Data
    pageGroup: @polls
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @can-delete-test-data
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region buttons (
        name: Buttons
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

    region delete-test-data (
        name: Delete Test Data
        type: staticContent
        source {
            htmlCode: <p>Please confirm you want to delete all data submitted to this poll during the <strong>Testing</strong> phase.</p>
        }
        layout {
            sequence: 10
            slot: wizardBody
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--customIcons
                t-Alert--info
                t-Alert--removeHeading js-removeLandmark
            ]
            icon: fa-trash-o
        }
        comments {
            comments:
                ```
                
                <p>Please confirm you want to delete the test data from this poll.  Test data is all data submitted while the poll was in the <strong>Testing</strong> phase.</p>
                ```
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
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

    button delete (
        buttonName: DELETE
        label: Delete Test Data
        layout {
            sequence: 20
            region: @buttons
            slot: next
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

    process delete-test-data (
        name: delete test data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                eba_qpoll.remove_preactive_results (
                    p_poll_id => :POLL_ID);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Test data deleted.
        }
        advanced {
            executionMappingIdentifier: 13953079366205672034
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    branch (
        name: to refresh entire poll page
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: &LAST_VIEW.
                action: resetPagination
            }
        }
    )

)


````
