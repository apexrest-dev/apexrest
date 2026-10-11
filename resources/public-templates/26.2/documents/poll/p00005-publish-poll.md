# Publish Poll — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00005-publish-poll.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0966fbf58ea76604285981747b3f44d22994c83a7d1b9a27a7ea98543cdb3731.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 5 (
    name: Publish Poll
    alias: PUBLISH-POLL
    title: Publish Poll
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

    region invite-only (
        name: invite only
        type: staticContent
        source {
            htmlCode:
                ```html
                <p/>
                <p>Once published, you would then send invitations to those whom you want to participate.</p>
                ```
        }
        layout {
            sequence: 20
            parentRegion: @publish-poll
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from EBA_QPOLL_POLLS
                 where id = :POLL_ID
                   and invite_only_yn = 'Y'
                ```
        }
    )

    region not-invite-only (
        name: not invite only
        type: staticContent
        source {
            htmlCode: <p>Once published, you can then use the Poll URL, under Additional Details, to request users to participate.</p>
        }
        layout {
            sequence: 30
            parentRegion: @publish-poll
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from EBA_QPOLL_POLLS
                 where id = :POLL_ID
                   and invite_only_yn = 'N'
                ```
        }
    )

    region publish-poll (
        name: Publish Poll
        type: staticContent
        source {
            htmlCode: <p>Please confirm you want to Publish this poll.</p>
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

    region test-data (
        name: test data
        type: staticContent
        source {
            htmlCode: <p>Before you Publish, you may want to remove your responses collected during this Testing period.</p>
        }
        layout {
            sequence: 10
            parentRegion: @publish-poll
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from EBA_QPOLL_RESULTS
                 where poll_id = :POLL_ID
                   and nvl(is_valid_yn,'Y') = 'Y'
                   and preactive_yn = 'Y'
                ```
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 30
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

    button delete-test-data (
        buttonName: DELETE_TEST_DATA
        label: Delete Test Data
        layout {
            sequence: 40
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 82
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
        advanced {
            customAttributes: style="text-align: center;"
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from EBA_QPOLL_RESULTS
                 where poll_id = :POLL_ID
                   and nvl(is_valid_yn,'Y') = 'Y'
                   and preactive_yn = 'Y'
                ```
        }
    )

    button publish (
        buttonName: PUBLISH
        label: Publish Poll
        layout {
            sequence: 50
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

    process publish-poll (
        name: publish poll
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                update eba_qpoll_polls
                   set status_id = 3
                 where id = :POLL_ID;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Poll is Published.  You can now send Invitations, if appropriate.
        }
        advanced {
            executionMappingIdentifier: 252350172672812211
        }
        serverSideCondition {
            whenButtonPressed: @publish
        }
    )

    branch (
        name: Branch to Polls Page
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
