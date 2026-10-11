# Industry Details — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00065-industry-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 83765899649b41ad52c68bcea3a0807391163ccc299bcbabe7c47041a8912e8b.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 65 (
    name: Industry Details
    alias: INDUSTRY-DETAILS
    title: Industry Details
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
        advanced {
            regionDisplaySelector: true
        }
    )

    region industry-details (
        name: Industry Details
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

    pageItem P65_ID (
        type: hidden
        layout {
            sequence: 1
            region: @industry-details
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

    pageItem P65_INDUSTRY_NAME (
        type: textField
        label {
            label: Name
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 40
            region: @industry-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: INDUSTRY_NAME
            used: always
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: edit
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
        label: Create Industry
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
            item: P65_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 20
            region: @buttons
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--simple
                t-Button--danger
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
            item: P65_ID
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 30
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
            databaseAction: update
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P65_ID
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
            executionMappingIdentifier: 6522289252584011377
        }
    )

    process fetch-row-from-eba-sales-industries (
        name: Fetch Row from EBA_SALES_INDUSTRIES
        type: autoRowFetch
        source {
            tableName: EBA_SALES_INDUSTRIES
            pkColumn: ID
            pkItem: P65_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        error {
            errorMessage: Unable to fetch row.
        }
        advanced {
            executionMappingIdentifier: 10251116755153617101
        }
    )

    process process-row-of-eba-sales-industries (
        name: Process Row of EBA_SALES_INDUSTRIES
        type: autoRowProcessing
        target {
            tableName: EBA_SALES_INDUSTRIES
            pkColumn: ID
            pkItem: P65_ID
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        error {
            errorMessage: Unable to process row of table EBA_SALES_INDUSTRIES.
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 10251116975019617177
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        error {
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 10251117170177617178
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
