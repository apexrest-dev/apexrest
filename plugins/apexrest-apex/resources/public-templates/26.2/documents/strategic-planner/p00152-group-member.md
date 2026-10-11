# Group Member — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00152-group-member.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 381f2a330465f5f9b5b5c22ed13c880381a4704b337554cafc1fc8c0949ca756.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 152 (
    name: Group Member
    alias: GROUP-MEMBER
    title: Group Member
    pageGroup: @groups
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
        authorizationScheme: @contribution-rights
    }
    config {
        buildOption: @groups
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

    region group-member (
        name: Group Member
        type: form
        source {
            location: localDatabase
            tableName: SP_GROUP_MEMBERS
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

    pageItem P152_ASSIGNMENT (
        type: textField
        label {
            label: Assignment
            alignment: right
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 40
            region: @group-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 255
        }
        source {
            formRegion: @group-member
            column: ASSIGNMENT
            dataType: varchar2
        }
    )

    pageItem P152_FULL_TIME_YN (
        type: switch
        label {
            label: Full Time
            alignment: left
        }
        layout {
            sequence: 50
            region: @group-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @group-member
            column: FULL_TIME_YN
            dataType: varchar2
        }
        default {
            type: static
            staticValue: N
        }
    )

    pageItem P152_GROUP_ID (
        type: selectList
        label {
            label: Group
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-groups-group-name
        }
        layout {
            sequence: 20
            region: @group-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            formRegion: @group-member
            column: GROUP_ID
            dataType: number
        }
    )

    pageItem P152_GROUP_LEADER_YN (
        type: switch
        label {
            label: Group Leader
            alignment: left
        }
        layout {
            sequence: 60
            region: @group-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @group-member
            column: GROUP_LEADER_YN
            dataType: varchar2
        }
        default {
            type: static
            staticValue: N
        }
    )

    pageItem P152_ID (
        type: hidden
        layout {
            sequence: 10
            region: @group-member
            slot: regionBody
        }
        source {
            formRegion: @group-member
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P152_TEAM_MEMBER_ID (
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
                    or id = :P152_TEAM_MEMBER_ID
                 order by 1
                ```
        }
        layout {
            sequence: 30
            region: @group-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            valueRequired: true
        }
        source {
            formRegion: @group-member
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
        label: Add Group Member
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
            item: P152_ID
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
            item: P152_ID
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
            item: P152_ID
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
            executionMappingIdentifier: 8989135084284874148
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-group-member (
        name: Initialize form Group Member
        type: formInitialization
        formRegion: @group-member
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 8989134210188874147
        }
    )

    process process-form-group-member (
        name: Process form Group Member
        type: formAutoRowProcessing
        formRegion: @group-member
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 8989134668534874148
        }
    )

)


````
