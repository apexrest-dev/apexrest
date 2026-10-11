# Edit Initiative Focus Area Comment — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00035-ifa-comment.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: abca4315b5a4262f50610db7131f4212fec823ba3cedc806c8b6459f0e4afb48.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 35 (
    name: Edit Initiative Focus Area Comment
    alias: IFA-COMMENT
    title: Edit Comment
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
    navigation {
        cursorFocus: firstItemOnPage
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

    region edit-comment (
        name: Edit Comment
        type: form
        source {
            location: localDatabase
            tableName: SP_INIT_FOCUS_AREA_COMMENTS_V
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

    pageItem P35_BODY (
        type: richTextEditor
        label {
            label: Comment
            alignment: left
        }
        settings {
            minHeight: 180
            allowCustomHtml: true
        }
        layout {
            sequence: 30
            region: @edit-comment
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
                                imageRefId: apex.item('P35_NEW_IMAGE_REF_ID').getValue()
                            }
                        },
                        mentions: {
                            scope: 'FOCUS_AREA',
                            objectId: apex.items.P35_INIT_FOCUS_AREA_ID.value
                        },
                        docs: {
                            scope: 'FOCUS_AREA',
                            objectId: apex.items.P35_INIT_FOCUS_AREA_ID.value
                        }
                    });
                }
                ```
        }
        source {
            formRegion: @edit-comment
            column: BODY
            dataType: clob
        }
        sessionState {
            dataType: clob
        }
    )

    pageItem P35_ID (
        type: hidden
        layout {
            sequence: 10
            region: @edit-comment
            slot: regionBody
        }
        source {
            formRegion: @edit-comment
            column: ID
            dataType: number
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P35_INIT_FOCUS_AREA_ID (
        type: hidden
        layout {
            sequence: 20
            region: @edit-comment
            slot: regionBody
        }
        source {
            formRegion: @edit-comment
            column: INIT_FOCUS_AREA_ID
            dataType: number
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P35_NEW_IMAGE_REF_ID (
        type: hidden
        layout {
            sequence: 50
            region: @edit-comment
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

    pageItem P35_PRIVATE_YN (
        type: switch
        label {
            label: Private
            alignment: left
        }
        layout {
            sequence: 40
            region: @edit-comment
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @edit-comment
            column: PRIVATE_YN
            dataType: varchar2
        }
        default {
            type: static
            staticValue: N
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
            item: P35_ID
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
            item: P35_ID
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
            executionMappingIdentifier: 17033682245289415089
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
                sp_comment_util.delete_init_focus_area_comment (
                    p_comment_id   => :P35_ID );
                ```
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Comment deleted.
        }
        advanced {
            executionMappingIdentifier: 21721327884516565444
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    process initialize-form-edit-comment (
        name: Initialize form Edit Comment
        type: formInitialization
        formRegion: @edit-comment
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 17033679683847415086
        }
    )

    process update (
        name: Update
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_comment_util.update_init_focus_area_comment (
                    p_comment_id   => :P35_ID,
                    p_comment      => :P35_BODY,
                    p_private_yn   => :P35_PRIVATE_YN,
                    p_image_ref_id => :P35_NEW_IMAGE_REF_ID );
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Comment saved.
        }
        advanced {
            executionMappingIdentifier: 21721327710553565443
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
