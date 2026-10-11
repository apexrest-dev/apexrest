# Territory ACL — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00109-territory-acl.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 57e4a999c3e6a3315c6fdb1090eb082db34781d245eacf30c60ce7ede32a5284.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 109 (
    name: Territory ACL
    alias: TERRITORY-ACL
    title: Territory ACL
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
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

    region territory-acl (
        name: Territory ACL
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

    pageItem P109_ACL_COMMENTS (
        type: textarea
        label {
            label: ACL Comments
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 40
            region: @territory-acl
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 64
            height: 4
        }
        validation {
            maxLength: 4000
        }
        source {
            type: databaseColumn
            databaseColumn: ACL_COMMENTS
            used: always
        }
    )

    pageItem P109_ID (
        type: hidden
        layout {
            sequence: 20
            region: @territory-acl
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

    pageItem P109_TERRITORY_ID (
        type: selectList
        label {
            label: Territory
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @territory
            nullDisplayValue: - Select Territory -
        }
        layout {
            sequence: 30
            region: @territory-acl
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
            databaseColumn: TERRITORY_ID
            used: always
        }
    )

    pageItem P109_USERID (
        type: textField
        label {
            label: Username
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 10
            region: @territory-acl
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
            databaseColumn: USERID
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
        label: Add Territory Assignment
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
            item: P109_ID
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
            item: P109_ID
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
            item: P109_ID
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
            executionMappingIdentifier: 6542455555328038153
        }
    )

    process fetch-row-from-eba-sales-territory-acl (
        name: Fetch Row from EBA_SALES_TERRITORY_ACL
        type: autoRowFetch
        source {
            tableName: EBA_SALES_TERRITORY_ACL
            pkColumn: ID
            pkItem: P109_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 7219532544365380036
        }
    )

    process process-row-of-eba-sales-territory-acl (
        name: Process Row of EBA_SALES_TERRITORY_ACL
        type: autoRowProcessing
        target {
            tableName: EBA_SALES_TERRITORY_ACL
            pkColumn: ID
            pkItem: P109_ID
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 7219532767270380039
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 7219532946683380039
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
