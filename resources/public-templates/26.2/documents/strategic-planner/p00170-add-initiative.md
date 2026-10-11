# Add Initiative — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00170-add-initiative.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 300608af52195e409be9377746661ff629cc2f6f739ca7f189b6e03cf44bb7cb.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 170 (
    name: Add Initiative
    alias: ADD-INITIATIVE
    title: Add &NOMENCLATURE_INITIATIVE.
    pageGroup: @initiatives
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
        ]
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: @contribution-rights
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    region nomenclature-initiative (
        name: &NOMENCLATURE_INITIATIVE.
        type: staticContent
        layout {
            sequence: 10
            slot: wizardBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P170_FOCUS_AREA_ID (
        type: selectList
        label {
            label: &NOMENCLATURE_AREA.
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-areas-area
            nullDisplayValue: - Choose &NOMENCLATURE_AREA. -
            nullReturnValue: 0
        }
        layout {
            sequence: 20
            region: @nomenclature-initiative
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
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P170_IMAGE (
        type: imageUpload
        label {
            label: Drag and Drop Icon Image here
            alignment: left
        }
        storage {
            type: appTempFiles
        }
        resizeTo {
            maxWidth: 256
            maxHeight: 256
        }
        layout {
            sequence: 60
            region: @nomenclature-initiative
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
            width: 60
        }
    )

    pageItem P170_IMAGE_SELECTED (
        type: hidden
        layout {
            sequence: 70
            region: @nomenclature-initiative
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P170_IMAGE_SELECTED_DISPLAY (
        type: displayImage
        label {
            label: Icon Selected
            alignment: left
        }
        settings {
            basedOn: blobColSql
            sqlQuery:
                ```sql
                select blob_content from apex_application_temp_files
                 where application_id = :APP_ID
                   and name = :P170_IMAGE_SELECTED
                ```
        }
        layout {
            sequence: 80
            region: @nomenclature-initiative
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
        }
        advanced {
            customAttributes: "style=\"width:70px\"  "
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P170_IMAGE_SELECTED
        }
    )

    pageItem P170_INITIATIVE (
        type: textField
        label {
            label: &NOMENCLATURE_INITIATIVE.
            alignment: left
        }
        layout {
            sequence: 30
            region: @nomenclature-initiative
            slot: regionBody
            alignment: left
            startNewRow: false
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
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P170_OBJECTIVE (
        type: richTextEditor
        label {
            label: Objective
            alignment: left
        }
        settings {
            minHeight: 90
            allowCustomHtml: true
        }
        layout {
            sequence: 40
            region: @nomenclature-initiative
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P170_SPONSOR_ID (
        type: selectOne
        label {
            label: Owner
            alignment: left
        }
        settings {
            infiniteScroll: false
        }
        lov {
            type: sharedComponent
            lov: @sp-team-members-current-only
        }
        layout {
            sequence: 50
            region: @nomenclature-initiative
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P170_TAGS (
        type: combobox
        label {
            label: Tags
            alignment: left
        }
        settings {
            multiSelection: true
            infiniteScroll: false
            maxValuesInList: 7
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'research' tag from dual union all
                select 'devops' tag from dual union all
                select 'review' tag from dual
                order by 1
                ```
        }
        multipleValues {
            type: delimitedList
            separator: ,
        }
        layout {
            sequence: 90
            region: @nomenclature-initiative
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

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 40
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconRight
            ]
            icon: fa-chevron-right
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
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

    validation unique (
        name: unique
        execution {
            sequence: 10
        }
        validation {
            type: noRowsReturned
            sqlQuery:
                ```sql
                select 1
                  from sp_initiatives
                 where lower(initiative) = lower(:P170_INITIATIVE)
                   and area_id = :P170_FOCUS_AREA_ID
                ```
        }
        error {
            errorMessage: &NOMENCLATURE_INITIATIVE. already exists with same name.
            associatedItem: @P170_INITIATIVE
        }
        serverSideCondition {
            whenButtonPressed: @next
        }
    )

    computation p170-image-selected (
        itemName: P170_IMAGE_SELECTED
        execution {
            sequence: 10
            point: afterSubmit
        }
        computation {
            type: item
            itemName: P170_IMAGE
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P170_IMAGE
        }
    )

    process clear-collections-and-temp-file (
        name: clear collections and temp file
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_collection.create_or_truncate_collection ('INITIATIVE_DEFAULT_TASKS');
                
                apex_collection.create_or_truncate_collection ('INITIATIVE_FOCUS_AREAS');
                
                delete from apex_application_temp_files
                 where application_id = :APP_ID;
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 13234561973859689301
        }
        serverSideCondition {
            type: itemIsNull
            item: P170_INITIATIVE
        }
    )

    branch (
        name: next
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 171
            }
        }
        serverSideCondition {
            whenButtonPressed: @next
        }
    )

)


````
