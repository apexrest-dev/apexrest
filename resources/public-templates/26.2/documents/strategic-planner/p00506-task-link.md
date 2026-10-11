# Task Link — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00506-task-link.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a8d59c46442c608313ce33f9f4b6e3ddad9c03f69b8e70bcec0ba8a2b9a2ee58.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 506 (
    name: Task Link
    alias: TASK-LINK
    title: Link
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

    region task-link (
        name: Task Link
        type: form
        source {
            location: localDatabase
            tableName: SP_TASK_LINKS
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

    pageItem P506_CREATED (
        type: hidden
        layout {
            sequence: 80
            region: @task-link
            slot: regionBody
        }
        source {
            formRegion: @task-link
            column: CREATED
            dataType: date
            queryOnly: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P506_CREATED_BY (
        type: hidden
        layout {
            sequence: 90
            region: @task-link
            slot: regionBody
        }
        source {
            formRegion: @task-link
            column: CREATED_BY
            dataType: varchar2
            queryOnly: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P506_ID (
        type: hidden
        layout {
            sequence: 10
            region: @task-link
            slot: regionBody
        }
        source {
            formRegion: @task-link
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P506_IMPORTANT_YN (
        type: switch
        label {
            label: Important
            alignment: left
        }
        layout {
            sequence: 50
            region: @task-link
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @task-link
            column: IMPORTANT_YN
            dataType: varchar2
        }
    )

    pageItem P506_LINK_NAME (
        type: textField
        label {
            label: Link Name
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 30
            region: @task-link
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
            formRegion: @task-link
            column: LINK_NAME
            dataType: varchar2
        }
    )

    pageItem P506_LINK_URL (
        type: textField
        label {
            label: URL
            alignment: left
        }
        settings {
            subtype: url
        }
        layout {
            sequence: 40
            region: @task-link
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
            formRegion: @task-link
            column: LINK_URL
            dataType: varchar2
        }
    )

    pageItem P506_TASK_ID (
        type: displayOnly
        label {
            label: Link For
            alignment: left
        }
        settings {
            basedOn: lov
        }
        lov {
            type: sharedComponent
            lov: @task-names-for-display-lovs
        }
        layout {
            sequence: 20
            region: @task-link
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @task-link
            column: TASK_ID
            dataType: number
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P506_UPDATED (
        type: hidden
        layout {
            sequence: 100
            region: @task-link
            slot: regionBody
        }
        source {
            formRegion: @task-link
            column: UPDATED
            dataType: date
            queryOnly: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P506_UPDATED_BY (
        type: hidden
        layout {
            sequence: 110
            region: @task-link
            slot: regionBody
        }
        source {
            formRegion: @task-link
            column: UPDATED_BY
            dataType: varchar2
            queryOnly: true
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
            item: P506_ID
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
            item: P506_ID
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
            item: P506_ID
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
            executionMappingIdentifier: 18163968432720319429
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form (
        name: Initialize form
        type: formInitialization
        formRegion: @task-link
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 18163965505365319426
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                for c1 in (
                    select project_id
                      from sp_tasks
                     where id = :P506_TASK_ID
                ) loop
                    sp_log.log_interaction(
                        p_project_id => c1.project_id);
                end loop;
                ```
        }
        execution {
            sequence: 60
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1436800779090928701
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P506_TASK_ID
        }
    )

    process process-form (
        name: Process form
        type: formAutoRowProcessing
        formRegion: @task-link
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 18163965939487319426
        }
    )

)


````
