# Opt Out User Details — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00046-opt-out-user-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 8080730ec93a8483611ed7a91fd81fdee45fe26be57c8bf02c9829103db83c18.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 46 (
    name: Opt Out User Details
    alias: OPT-OUT-USER-DETAILS
    title: Opt Out User Details
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
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    javaScript {
        functionAndGlobalVariableDeclaration: var htmldb_delete_message='"DELETE_CONFIRM_MSG"';
    }
    security {
        authorizationScheme: @administration-rights
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
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    region opt-out-user-details (
        name: Opt Out User Details
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P46_CREATED (
        type: displayOnly
        label {
            label: Added
            alignment: left
        }
        settings {
            sendOnPageSubmit: false
        }
        layout {
            sequence: 30
            region: @opt-out-user-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            formatMask: DD-MON-YYYY HH:MIPM
        }
        source {
            type: databaseColumn
            databaseColumn: CREATED
            used: always
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P46_ID
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P46_CREATED_BY (
        type: displayOnly
        label {
            label: Added By
            alignment: left
        }
        settings {
            sendOnPageSubmit: false
        }
        layout {
            sequence: 40
            region: @opt-out-user-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            type: databaseColumn
            databaseColumn: CREATED_BY
            used: always
            postCalculationComputation: lower(:P46_CREATED_BY)
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P46_ID
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P46_ID (
        type: hidden
        layout {
            sequence: 10
            region: @opt-out-user-details
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P46_RESPONDENT_ID (
        type: popupLov
        label {
            label: Respondent
            alignment: left
        }
        settings {
            displayAs: modalDialog
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select email d, id r
                  from eba_qpoll_respondents
                 where email != 'nobody'
                  and ((:P46_ID is null and 
                         id not in (select respondent_id from eba_qpoll_email_opt_out))
                       or
                        :P46_ID is not null)
                order by 1
                ```
            nullDisplayValue: - Select -
        }
        layout {
            sequence: 20
            region: @opt-out-user-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: RESPONDENT_ID
            used: always
        }
        readOnly {
            type: itemIsNotNull
            item: P46_ID
        }
        help {
            inlineHelpText: Only users who have responded to a poll or belong to a community can be opted out.
        }
    )

    button add (
        buttonName: ADD
        label: Add User
        layout {
            sequence: 40
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
            databaseAction: insert
        }
        serverSideCondition {
            type: itemIsNull
            item: P46_ID
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

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 30
            region: @buttons
            slot: delete
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--danger
                t-Button--simple
            ]
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.confirm(htmldb_delete_message,'DELETE');
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
            databaseAction: delete
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P46_ID
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
            sequence: 50
        }
        advanced {
            executionMappingIdentifier: 7162020431983814548
        }
    )

    process fetch-row-from-eba-qpoll-email-opt-out (
        name: Fetch Row from EBA_QPOLL_EMAIL_OPT_OUT
        type: autoRowFetch
        source {
            tableName: EBA_QPOLL_EMAIL_OPT_OUT
            pkColumn: ID
            pkItem: P46_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 14003997088494315017
        }
    )

    process process-row-of-eba-qpoll-email-opt-out (
        name: Process Row of EBA_QPOLL_EMAIL_OPT_OUT
        type: autoRowProcessing
        target {
            tableName: EBA_QPOLL_EMAIL_OPT_OUT
            pkColumn: ID
            pkItem: P46_ID
            supportedOperations: [
                insert
                delete
            ]
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 14003997286605315019
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 14003997467049315019
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
