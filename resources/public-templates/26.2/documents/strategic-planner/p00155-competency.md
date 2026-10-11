# Competency — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00155-competency.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 05305a1176a02aa4feb1ffb479f04168a701470064e729895cab90f7994e0af8.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 155 (
    name: Competency
    alias: COMPETENCY
    title: Competency
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }
    dialog {
        chained: false
        resizable: false
    }
    security {
        authorizationScheme: @administration-rights
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

    region competency (
        name: Competency
        type: form
        source {
            location: localDatabase
            tableName: SP_COMPETENCIES
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

    pageItem P155_COMPETENCY (
        type: textField
        label {
            label: Competency
            alignment: right
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 20
            region: @competency
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            valueRequired: true
            maxLength: 100
        }
        source {
            formRegion: @competency
            column: COMPETENCY
            dataType: varchar2
        }
    )

    pageItem P155_DESCRIPTION (
        type: textarea
        label {
            label: Description
            alignment: right
        }
        layout {
            sequence: 30
            region: @competency
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
            formRegion: @competency
            column: DESCRIPTION
            dataType: varchar2
        }
    )

    pageItem P155_ID (
        type: hidden
        layout {
            sequence: 10
            region: @competency
            slot: regionBody
        }
        source {
            formRegion: @competency
            column: ID
            dataType: number
            primaryKey: true
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
        label: Add Competency
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
            item: P155_ID
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
            templateOptions: #DEFAULT#
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
            item: P155_ID
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
            item: P155_ID
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
        execution {
            sequence: 50
        }
        advanced {
            executionMappingIdentifier: 11035762173863417848
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-competency (
        name: Initialize form Competency
        type: formInitialization
        formRegion: @competency
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 11035761332459417847
        }
    )

    process process-form-competency (
        name: Process form Competency
        type: formAutoRowProcessing
        formRegion: @competency
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 11035761720118417848
        }
    )

)


````
