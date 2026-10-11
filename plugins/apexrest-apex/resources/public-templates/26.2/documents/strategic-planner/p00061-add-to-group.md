# Add to Group — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00061-add-to-group.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1e69aeb32b440f7aca7877a1031ac626c99674b1a0cf52e2fb45ccd1590818ab.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 61 (
    name: Add to Group
    alias: ADD-TO-GROUP
    title: Add to Group
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

    pageItem P61_ASSIGNMENT (
        type: textField
        label {
            label: Assignment
            alignment: left
        }
        settings {
            trimSpaces: none
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

    pageItem P61_FULL_TIME_YN (
        type: switch
        label {
            label: Full Time
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
            column: FULL_TIME_YN
            dataType: varchar2
        }
        default {
            type: static
            staticValue: N
        }
    )

    pageItem P61_GROUP_ID (
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
            sequence: 30
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

    pageItem P61_GROUP_LEADER_YN (
        type: switch
        label {
            label: Group Leader
            alignment: left
        }
        layout {
            sequence: 70
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

    pageItem P61_ID (
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

    pageItem P61_TEAM_MEMBER_ID (
        type: displayOnly
        label {
            label: &NOMENCLATURE_USER.
            alignment: left
        }
        settings {
            basedOn: lov
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select last_name||', '||first_name||' ('||lower(email)||')' d, id r
                  from SP_TEAM_MEMBERS
                 where is_current_yn = 'Y'
                    or id = :P61_TEAM_MEMBER_ID
                 order by 1
                ```
        }
        layout {
            sequence: 20
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
            column: TEAM_MEMBER_ID
            dataType: number
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
            item: P61_ID
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
            item: P61_ID
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
            item: P61_ID
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
            executionMappingIdentifier: 18182727398434304909
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
            executionMappingIdentifier: 18182724467915304906
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
            executionMappingIdentifier: 18182724851902304906
        }
    )

)


````
