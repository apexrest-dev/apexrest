# Project Contributor — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00009-project-contributor.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2184fcdbbb60d57988e7faf903943cc4f46bd109b1aa0c9ed5a80897a616c795.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9 (
    name: Project Contributor
    alias: PROJECT-CONTRIBUTOR
    title: Project Contributor
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
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

    region project-contributor (
        name: Project Contributor
        type: form
        source {
            location: localDatabase
            tableName: SP_PROJECT_CONTRIBUTORS
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

    pageItem P9_ID (
        type: hidden
        layout {
            sequence: 10
            region: @project-contributor
            slot: regionBody
        }
        source {
            formRegion: @project-contributor
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P9_PROJECT_ID (
        type: selectList
        label {
            label: Project
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-projects-project
        }
        layout {
            sequence: 20
            region: @project-contributor
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            formRegion: @project-contributor
            column: PROJECT_ID
            dataType: number
        }
    )

    pageItem P9_RESPONSIBILITY (
        type: textarea
        label {
            label: Comments
            alignment: left
        }
        layout {
            sequence: 50
            region: @project-contributor
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
            formRegion: @project-contributor
            column: RESPONSIBILITY
            dataType: varchar2
        }
    )

    pageItem P9_RESPONSIBILITY_ID (
        type: selectList
        label {
            label: Responsibility
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-resource-types-resource-type
        }
        layout {
            sequence: 40
            region: @project-contributor
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            formRegion: @project-contributor
            column: RESPONSIBILITY_ID
            dataType: number
        }
    )

    pageItem P9_TAGS (
        type: combobox
        label {
            label: Tags
            alignment: left
        }
        settings {
            multiSelection: true
            infiniteScroll: false
        }
        lov {
            type: sqlQuery
            sqlQuery: select 1 from dual where 1=2
        }
        multipleValues {
            type: delimitedList
            separator: ,
        }
        layout {
            sequence: 100
            region: @project-contributor
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            maxLength: 4000
        }
        source {
            formRegion: @project-contributor
            column: TAGS
            dataType: varchar2
        }
    )

    pageItem P9_TEAM_MEMBER_ID (
        type: popupLov
        label {
            label: &NOMENCLATURE_USER.
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select last_name||', '||first_name||' ('||lower(email)||')' d, id r
                  from SP_TEAM_MEMBERS
                 where is_current_yn = 'Y'
                    or id = :P9_TEAM_MEMBER_ID
                 order by 1
                ```
        }
        layout {
            sequence: 30
            region: @project-contributor
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        source {
            formRegion: @project-contributor
            column: TEAM_MEMBER_ID
            dataType: number
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
            item: P9_ID
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
            item: P9_ID
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
            item: P9_ID
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
            executionMappingIdentifier: 1205446112218638112
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-project-contributor (
        name: Initialize form Project Contributor
        type: formInitialization
        formRegion: @project-contributor
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1205445305664638111
        }
    )

    process log-interaction (
        name: log interaction
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction (
                    p_project_id => :P9_PROJECT_ID);
                ```
        }
        execution {
            sequence: 20
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1205028047429313447
        }
    )

    process process-form-project-contributor (
        name: Process form Project Contributor
        type: formAutoRowProcessing
        formRegion: @project-contributor
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 1205445713112638112
        }
    )

)


````
