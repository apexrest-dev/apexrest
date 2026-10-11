# Issue Status — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00133-issue-status.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b24cc266924d98ee3d72e3e012fd1aeb030151e5a8274e421ea94fb39c4ffc29.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 133 (
    name: Issue Status
    alias: ISSUE-STATUS
    title: Issue Status
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
    }
    javaScript {
        functionAndGlobalVariableDeclaration: var htmldb_delete_message='"DELETE_CONFIRM_MSG"';
    }
    security {
        authorizationScheme: @administration-rights
    }
    config {
        buildOption: @issues
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
        settings {
            outputAs: text
        }
    )

    region form-on-eba-cust-issue-statuses (
        name: Form on EBA_CUST_ISSUE_STATUSES
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    pageItem P133_DETAILS (
        type: textarea
        label {
            label: Details
            alignment: left
        }
        layout {
            sequence: 40
            region: @form-on-eba-cust-issue-statuses
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 60
            height: 4
        }
        validation {
            maxLength: 4000
        }
        source {
            type: databaseColumn
            databaseColumn: DETAILS
            used: always
        }
    )

    pageItem P133_ID (
        type: hidden
        layout {
            sequence: 10
            region: @form-on-eba-cust-issue-statuses
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

    pageItem P133_NAME (
        type: textField
        label {
            label: Name
            alignment: left
        }
        layout {
            sequence: 20
            region: @form-on-eba-cust-issue-statuses
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 60
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: NAME
            used: always
        }
    )

    pageItem P133_OPEN_YN (
        type: switch
        label {
            label: Is Open?
            alignment: left
        }
        layout {
            sequence: 30
            region: @form-on-eba-cust-issue-statuses
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
        }
        source {
            type: databaseColumn
            databaseColumn: OPEN_YN
            used: always
        }
        default {
            type: static
            staticValue: Y
        }
        help {
            helpText: Select whether the issue status is considered to be an "Open" status (or not).
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button create (
        buttonName: CREATE
        label: Add Issue Status
        layout {
            sequence: 40
            region: @buttons
            slot: next
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
            item: P133_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 20
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
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
            item: P133_ID
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 30
            region: @buttons
            slot: next
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
            databaseAction: update
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P133_ID
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
            executionMappingIdentifier: 2564927515030628677
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process fetch-row-from-eba-cust-issue-statuses (
        name: Fetch Row from EBA_CUST_ISSUE_STATUSES
        type: autoRowFetch
        source {
            tableName: EBA_CUST_ISSUE_STATUSES
            pkColumn: ID
            pkItem: P133_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 2564926459645628675
        }
    )

    process process-row-of-eba-cust-issue-statuses (
        name: Process Row of EBA_CUST_ISSUE_STATUSES
        type: autoRowProcessing
        target {
            tableName: EBA_CUST_ISSUE_STATUSES
            pkColumn: ID
            pkItem: P133_ID
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 2564926858764628676
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 2564927102444628676
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
