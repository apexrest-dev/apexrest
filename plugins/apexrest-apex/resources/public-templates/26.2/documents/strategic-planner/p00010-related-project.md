# Related Project — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00010-related-project.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e956fe665b17c6995353e02bf8c905ff0dc322f32b8815fabf860c2406fa4639.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 10 (
    name: Related Project
    alias: RELATED-PROJECT
    title: Related &NOMENCLATURE_PROJECT.
    pageGroup: @projects
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

    region audit-info (
        name: Audit info
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                return 'created '|| apex_util.get_since(to_date(:P10_CREATED)) ||' by '|| apex_escape.html(lower(:P10_CREATED_BY)) ||'<br/>'||
                       'last updated '|| apex_util.get_since(to_date(:P10_UPDATED)) ||' by '|| apex_escape.html(lower(:P10_UPDATED_BY));
                ```
        }
        layout {
            sequence: 20
            parentRegion: @related-project
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

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

    region related-project (
        name: Related Project
        type: form
        source {
            location: localDatabase
            tableName: SP_PROJECT_RELATED
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        headerAndFooter {
            headerText: &P10_HEADER_INFO.
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

    pageItem P10_CREATED (
        type: hidden
        layout {
            sequence: 70
            region: @related-project
            slot: regionBody
        }
        source {
            formRegion: @related-project
            column: CREATED
            dataType: date
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_CREATED_BY (
        type: hidden
        layout {
            sequence: 80
            region: @related-project
            slot: regionBody
        }
        source {
            formRegion: @related-project
            column: CREATED_BY
            dataType: varchar2
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_HEADER_INFO (
        type: hidden
        layout {
            sequence: 60
            region: @related-project
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_ID (
        type: hidden
        layout {
            sequence: 10
            region: @related-project
            slot: regionBody
        }
        source {
            formRegion: @related-project
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_PROJECT_ID (
        type: selectList
        label {
            label: &NOMENCLATURE_PROJECT.
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-projects-project
        }
        layout {
            sequence: 20
            region: @related-project
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            formRegion: @related-project
            column: PROJECT_ID
            dataType: number
        }
    )

    pageItem P10_PROJECT_RELATION (
        type: textarea
        label {
            label: Relationship Details
            alignment: left
        }
        layout {
            sequence: 40
            region: @related-project
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
            formRegion: @related-project
            column: PROJECT_RELATION
            dataType: varchar2
        }
    )

    pageItem P10_RELATED_PROJECT_ID (
        type: selectList
        label {
            label: Related &NOMENCLATURE_PROJECT.
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-projects-project
        }
        layout {
            sequence: 30
            region: @related-project
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            formRegion: @related-project
            column: RELATED_PROJECT_ID
            dataType: number
        }
    )

    pageItem P10_RELATION_TYPE (
        type: hidden
        layout {
            sequence: 50
            region: @related-project
            slot: regionBody
        }
        source {
            formRegion: @related-project
            column: RELATION_TYPE
            dataType: varchar2
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_UPDATED (
        type: hidden
        layout {
            sequence: 90
            region: @related-project
            slot: regionBody
        }
        source {
            formRegion: @related-project
            column: UPDATED
            dataType: date
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_UPDATED_BY (
        type: hidden
        layout {
            sequence: 100
            region: @related-project
            slot: regionBody
        }
        source {
            formRegion: @related-project
            column: UPDATED_BY
            dataType: varchar2
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
            item: P10_ID
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
            item: P10_ID
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
            item: P10_ID
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
            executionMappingIdentifier: 5881031868451638596
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-related-project (
        name: Initialize form Related Project
        type: formInitialization
        formRegion: @related-project
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 5881031091934638594
        }
    )

    process load-header-info (
        name: load HEADER_INFO
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                if :P10_PROJECT_ID = :P3_PROJECT_ID
                   then :P10_HEADER_INFO := 'Relationship set by '||:NOMENCLATURE_PROJECT;
                elsif :P10_RELATED_PROJECT_ID = :P3_PROJECT_ID
                   then :P10_HEADER_INFO := 'Relationship set by Related '||:NOMENCLATURE_PROJECT;
                end if;
                ```
        }
        execution {
            sequence: 30
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 12862938889599817815
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction(
                    p_project_id => :P10_PROJECT_ID);
                ```
        }
        execution {
            sequence: 20
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1205028368490313450
        }
    )

    process process-form-related-project (
        name: Process form Related Project
        type: formAutoRowProcessing
        formRegion: @related-project
        target {
            returnPksAfterInsert: false
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 5881031447630638595
        }
    )

)


````
