# Project Group — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00090-project-group.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7c1aa8e86d536ccf73b8b688d56a41841c8ea74e53b77a794961ef98ccc453da.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 90 (
    name: Project Group
    alias: PROJECT-GROUP
    title: &NOMENCLATURE_PROJECT. Group
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
    }
    security {
        authorizationScheme: @contribution-rights
    }
    config {
        buildOption: @project-groups
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

    region nomenclature-project (
        name: &NOMENCLATURE_PROJECT.
        type: form
        source {
            location: localDatabase
            tableName: SP_PROJECT_GROUPS
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

    pageItem P90_GROUP_DESCRIPTION (
        type: textarea
        label {
            label: Description
            alignment: left
        }
        layout {
            sequence: 30
            region: @nomenclature-project
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
            formRegion: @nomenclature-project
            column: GROUP_DESCRIPTION
            dataType: varchar2
        }
    )

    pageItem P90_GROUP_NAME (
        type: textField
        label {
            label: Name
            alignment: left
        }
        layout {
            sequence: 20
            region: @nomenclature-project
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
            maxLength: 255
        }
        source {
            formRegion: @nomenclature-project
            column: GROUP_NAME
            dataType: varchar2
        }
    )

    pageItem P90_ID (
        type: hidden
        layout {
            sequence: 10
            region: @nomenclature-project
            slot: regionBody
        }
        source {
            formRegion: @nomenclature-project
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P90_IS_ACTIVE_YN (
        type: switch
        label {
            label: Active
            alignment: left
        }
        layout {
            sequence: 40
            region: @nomenclature-project
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        default {
            type: static
            staticValue: Y
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
        label: Add Group
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
            item: P90_ID
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
            item: P90_ID
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
            item: P90_ID
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
            executionMappingIdentifier: 1228115297584770724
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-project-group (
        name: Initialize form Project Group
        type: formInitialization
        formRegion: @nomenclature-project
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1228114473209770723
        }
    )

    process process-form-project-group (
        name: Process form Project Group
        type: formAutoRowProcessing
        formRegion: @nomenclature-project
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 1228114852953770724
        }
    )

)


````
