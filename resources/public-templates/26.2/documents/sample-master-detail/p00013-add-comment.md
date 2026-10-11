# Add Comment — Sample Master Detail

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-master-detail/apexlang/sample-master-detail/pages/p00013-add-comment.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 8c40b6a0669f2d58fda4227ceec8a80c12ba79278d06e6d7dbae6ade2f2a23e3.

Application dependency inventory: oracle:26.2:public-template/sample-master-detail/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 13 (
    name: Add Comment
    alias: ADD-COMMENT
    title: Add Comment
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        height: 300
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region add-comment (
        name: Add Comment
        type: form
        source {
            location: localDatabase
            tableName: EBA_DEMO_MD_COMMENTS
            includeRowidColumn: true
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        edit {
            enabled: true
            allowedOperations: [
                add
                update
                delete
            ]
        }
    )

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

    pageItem P13_COMMENT_TEXT (
        type: textarea
        label {
            label: Comment Text
            alignment: left
        }
        layout {
            sequence: 30
            region: @add-comment
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            width: 70
            height: 7
            valuePlaceholder: Enter comment here ...
        }
        validation {
            valueRequired: true
            maxLength: 4000
        }
        source {
            formRegion: @add-comment
            column: COMMENT_TEXT
            dataType: varchar2
        }
        security {
            encryptSessionState: false
        }
    )

    pageItem P13_ID (
        type: hidden
        layout {
            sequence: 10
            region: @add-comment
            slot: regionBody
        }
        source {
            formRegion: @add-comment
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            encryptSessionState: false
        }
    )

    pageItem P13_PROJECT_ID (
        type: selectList
        label {
            label: Project
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @projects
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 20
            region: @add-comment
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
            formRegion: @add-comment
            column: PROJECT_ID
            dataType: number
        }
        security {
            encryptSessionState: false
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

    button create (
        buttonName: CREATE
        label: Add Comment
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
            databaseAction: insert
        }
        serverSideCondition {
            type: itemIsNull
            item: P13_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 10
            region: @buttons
            slot: delete
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
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P13_ID
        }
    )

    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 40
            region: @buttons
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P13_ID
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
        successMessage {
            successMessage: Action processed.
        }
        advanced {
            executionMappingIdentifier: 1858849968563597568
        }
    )

    process fetch-row-from-eba-demo-md-comments (
        name: Fetch Row from EBA_DEMO_MD_COMMENTS
        type: formInitialization
        formRegion: @add-comment
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 32134380459351739798
        }
    )

    process process-row-of-eba-demo-md-comments (
        name: Process Row of EBA_DEMO_MD_COMMENTS
        type: formAutoRowProcessing
        formRegion: @add-comment
        target {
            returnPksAfterInsert: false
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 32134380860580739798
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 32134381201328739798
        }
    )

)


````
