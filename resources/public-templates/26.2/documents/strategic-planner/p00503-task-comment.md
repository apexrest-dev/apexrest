# Task Comment — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00503-task-comment.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 350ef0d17d28aafed2006e9d1d6bc064316ef113b78828cf25c6c8858136aea1.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 503 (
    name: Task Comment
    alias: TASK-COMMENT
    title: Comment
    pageGroup: @releases
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
    javaScript {
        fileUrls: #APP_FILES#js/spCommentImageSupport#MIN#.js
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

    region task-comment (
        name: Task Comment
        type: form
        source {
            location: localDatabase
            tableName: SP_TASK_COMMENTS_V
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

    pageItem P503_BODY (
        type: richTextEditor
        label {
            label: Body
            alignment: left
        }
        settings {
            minHeight: 280
            allowCustomHtml: true
        }
        layout {
            sequence: 30
            region: @task-comment
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        advanced {
            initJavaScriptFunction:
                ```javascript-browser
                function(options) {
                    return spCommentImageSupport.markdown.configEditor(options, {
                        apexUpload: {
                            // Application process name that that will handle the POST request when an image is dropped into
                            // text box
                            uploadApplicationProcess: 'POST_COMMENT_IMAGE',
                            // Pass in any data that you want in the POST process 
                            // Will be passed in as a JSON object and available in apex_application.g_x01
                            data: {
                                imageRefId: apex.item('P503_NEW_IMAGE_REF_ID').getValue()
                            }
                        },
                        mentions: {
                            scope: 'TASK',
                            objectId: apex.items.P503_TASK_ID.value
                        },
                        docs: {
                            scope: 'TASK',
                            objectId: apex.items.P503_TASK_ID.value
                        }
                    });
                }
                ```
        }
        source {
            formRegion: @task-comment
            column: BODY
            dataType: clob
        }
        sessionState {
            dataType: clob
        }
    )

    pageItem P503_ID (
        type: hidden
        layout {
            sequence: 10
            region: @task-comment
            slot: regionBody
        }
        source {
            formRegion: @task-comment
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    pageItem P503_NEW_IMAGE_REF_ID (
        type: hidden
        layout {
            sequence: 50
            region: @task-comment
            slot: regionBody
        }
        default {
            type: expression
            plsqlExpression: to_number(sys_guid(), 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P503_PRIVATE_YN (
        type: switch
        label {
            label: Private
            alignment: left
        }
        layout {
            sequence: 40
            region: @task-comment
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @task-comment
            column: PRIVATE_YN
            dataType: varchar2
        }
        default {
            type: static
            staticValue: N
        }
        security {
            restrictedChars: alphanumWithSpace
        }
    )

    pageItem P503_TASK_ID (
        type: displayOnly
        label {
            label: Comment For
            alignment: left
        }
        settings {
            basedOn: lov
        }
        lov {
            type: sharedComponent
            lov: @task-names-for-display-lovs
            displayExtraValues: false
        }
        layout {
            sequence: 20
            region: @task-comment
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @task-comment
            column: TASK_ID
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
            item: P503_ID
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
            item: P503_ID
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
            sequence: 90
        }
        advanced {
            executionMappingIdentifier: 18159523686817011439
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: SAVE,DELETE
        }
    )

    process delete (
        name: delete
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_comment_util.delete_task_comment (
                    p_comment_id => :P503_ID );
                ```
        }
        execution {
            sequence: 80
        }
        successMessage {
            successMessage: Comment deleted.
        }
        error {
            errorMessage: Comment failed to be deleted.
        }
        advanced {
            executionMappingIdentifier: 22346126139358324567
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    process initialize-form (
        name: Initialize form
        type: formInitialization
        formRegion: @task-comment
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 18159520651292011436
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
                     where id = :P503_TASK_ID
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
            executionMappingIdentifier: 1436465593902910914
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P503_TASK_ID
        }
    )

    process update (
        name: update
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_comment_util.update_task_comment (
                    p_comment_id   => :P503_ID,
                    p_comment      => :P503_BODY,
                    p_private_yn   => :P503_PRIVATE_YN,
                    p_image_ref_id => :P503_NEW_IMAGE_REF_ID );
                ```
        }
        execution {
            sequence: 70
        }
        successMessage {
            successMessage: Comment saved.
        }
        error {
            errorMessage: Comment failed to be saved.
        }
        advanced {
            executionMappingIdentifier: 22345968676817565489
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
