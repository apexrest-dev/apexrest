# Description — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00032-description.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 06ecf4f3485cf223e20361a6f120907fd981b474883830956d23362261fdffc5.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 32 (
    name: Description
    alias: DESCRIPTION
    title: Description
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
    navigation {
        cursorFocus: firstItemOnPage
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

    region project (
        name: Project
        type: form
        source {
            location: localDatabase
            tableName: SP_PROJECTS
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

    pageItem P32_DESCRIPTION (
        type: richTextEditor
        label {
            label: Description
            alignment: left
        }
        settings {
            minHeight: 800
        }
        layout {
            sequence: 140
            region: @project
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @project
            column: DESCRIPTION
            dataType: clob
        }
    )

    pageItem P32_ID (
        type: hidden
        layout {
            sequence: 10
            region: @project
            slot: regionBody
        }
        source {
            formRegion: @project
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    pageItem P32_PROJECT (
        type: displayOnly
        label {
            label: &NOMENCLATURE_PROJECT.
            alignment: left
        }
        layout {
            sequence: 30
            region: @project
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @project
            column: PROJECT
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
            item: P32_ID
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
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 12007398261404596057
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process initialize-form-project (
        name: Initialize form Project
        type: formInitialization
        formRegion: @project
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 12007394711025596052
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction(
                    p_project_id => :P32_ID);
                ```
        }
        execution {
            sequence: 20
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 11977826817965668617
        }
    )

    process process-form-project (
        name: Process form Project
        type: formAutoRowProcessing
        formRegion: @project
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 12007395155998596053
        }
    )

)


````
