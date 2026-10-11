# Project Detail — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00010-project-detail.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fe1ad6c64f42c00731e622752265913d2631abfb8eb7d0fc79bcb174a9bfb458.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 10 (
    name: Project Detail
    alias: PROJECT-DETAIL
    title: Project Detail
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
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
        authorizationScheme: mustNotBePublicUser
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
            sequence: 20
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region project-detail (
        name: Project Detail
        type: staticContent
        layout {
            sequence: 10
            slot: wizardBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P10_ASSIGNED_TO (
        type: textField
        label {
            label: Assigned To
            alignment: left
        }
        layout {
            sequence: 70
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 30
        }
        source {
            type: databaseColumn
            databaseColumn: ASSIGNED_TO
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_BUDGET (
        type: numberField
        label {
            label: Budget
            alignment: left
        }
        settings {
            numberAlignment: end
            virtualKeyboard: text
        }
        layout {
            sequence: 90
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: BUDGET
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_COST (
        type: numberField
        label {
            label: Cost
            alignment: left
        }
        settings {
            numberAlignment: end
            virtualKeyboard: text
        }
        layout {
            sequence: 80
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: COST
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_END_DATE (
        type: datePicker
        label {
            label: End Date
            alignment: left
        }
        layout {
            sequence: 50
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: END_DATE
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_ID (
        type: hidden
        layout {
            sequence: 10
            region: @project-detail
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

    pageItem P10_PROJECT (
        type: textField
        label {
            label: Project
            alignment: left
        }
        layout {
            sequence: 20
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            width: 60
        }
        validation {
            valueRequired: true
            maxLength: 30
        }
        source {
            type: databaseColumn
            databaseColumn: PROJECT
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_START_DATE (
        type: datePicker
        label {
            label: Start Date
            alignment: left
        }
        layout {
            sequence: 40
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: START_DATE
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_STATUS (
        type: selectList
        label {
            label: Status
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @valid-status-codes
            nullDisplayValue: - Select Status -
        }
        layout {
            sequence: 60
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            type: databaseColumn
            databaseColumn: STATUS
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_TASK_NAME (
        type: textField
        label {
            label: Task Name
            alignment: left
        }
        layout {
            sequence: 30
            region: @project-detail
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: TASK_NAME
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
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
            executeValidations: false
        }
    )

    button create (
        buttonName: CREATE
        label: Create
        layout {
            sequence: 40
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
            databaseAction: insert
        }
        serverSideCondition {
            type: itemIsNull
            item: P10_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 20
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
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
            item: P10_ID
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
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            databaseAction: update
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P10_ID
        }
    )

    dynamicAction cancel-modal (
        name: Cancel Modal
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

    process fetch-row-from-eba-demo-cal-projects (
        name: Fetch Row from EBA_DEMO_CAL_PROJECTS
        type: autoRowFetch
        source {
            tableName: EBA_DEMO_CAL_PROJECTS
            pkColumn: ID
            pkItem: P10_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 2650851359047157657
        }
    )

    process process-row-of-eba-demo-cal-projects (
        name: Process Row of EBA_DEMO_CAL_PROJECTS
        type: autoRowProcessing
        target {
            tableName: EBA_DEMO_CAL_PROJECTS
            pkColumn: ID
            pkItem: P10_ID
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 2650851556241157659
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 2650851779065157660
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 9
            }
        }
    )

)


````
