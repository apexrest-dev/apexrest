# Link — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00040-ifa-link.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2e09e30f5bb5f04924fd4c20d0aab0f43f32be055fd1b4239964fa25d32fb5ce.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 40 (
    name: Link
    alias: IFA-LINK
    title: Link
    pageGroup: @initiatives
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: @contribution-rights
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
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

    region link (
        name: Link
        type: form
        source {
            location: localDatabase
            tableName: SP_INIT_FOCUS_AREA_LINKS
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

    pageItem P40_ID (
        type: hidden
        layout {
            sequence: 10
            region: @link
            slot: regionBody
        }
        source {
            formRegion: @link
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P40_IMPORTANT_YN (
        type: switch
        label {
            label: Important
            alignment: left
        }
        layout {
            sequence: 90
            region: @link
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @link
            column: IMPORTANT_YN
            dataType: varchar2
        }
        security {
            restrictedChars: alphanumWithSpace
        }
    )

    pageItem P40_INIT_FOCUS_AREA_ID (
        type: hidden
        layout {
            sequence: 100
            region: @link
            slot: regionBody
        }
        source {
            formRegion: @link
            column: INIT_FOCUS_AREA_ID
            dataType: number
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P40_LINK_NAME (
        type: textField
        label {
            label: Link Name
            alignment: left
        }
        layout {
            sequence: 60
            region: @link
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
            formRegion: @link
            column: LINK_NAME
            dataType: varchar2
        }
        security {
            restrictedChars: webSafe
        }
    )

    pageItem P40_LINK_URL (
        type: textField
        label {
            label: URL
            alignment: left
        }
        settings {
            subtype: url
        }
        layout {
            sequence: 70
            region: @link
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
            maxLength: 4000
        }
        source {
            formRegion: @link
            column: LINK_URL
            dataType: varchar2
        }
        security {
            restrictedChars: webSafe
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
            action: definedByDynamicAction
        }
    )

    button create (
        buttonName: CREATE
        label: Add Link
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
            item: P40_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 20
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
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
            databaseAction: delete
            requiresConfirmation: true
        }
        confirmation {
            message: &APP_TEXT$DELETE_MSG!RAW.
            style: danger
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P40_ID
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
            item: P40_ID
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
            executionMappingIdentifier: 17034686758209515154
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-link (
        name: Initialize form Link
        type: formInitialization
        formRegion: @link
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 17034683421145515151
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction(
                    p_project_id => :P40_PROJECT_ID);
                ```
        }
        execution {
            sequence: 20
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 17034686376854515154
        }
    )

    process process-form-link (
        name: Process form Link
        type: formAutoRowProcessing
        formRegion: @link
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 17034683879238515151
        }
    )

)


````
