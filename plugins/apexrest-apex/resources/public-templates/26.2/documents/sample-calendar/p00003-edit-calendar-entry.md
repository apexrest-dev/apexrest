# Edit Calendar Entry — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00003-edit-calendar-entry.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0c2db3e7de69497e4fbbbbb0420a49370a73afd27911ec30cdc59c39ce1c6668.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3 (
    name: Edit Calendar Entry
    alias: EDIT-CALENDAR-ENTRY
    title: Edit Calendar Entry
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region edit-calendar-entry (
        name: Edit Calendar Entry
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
                t-Form--large
            ]
        }
    )

    pageItem P3_END_DATE (
        type: datePicker
        label {
            label: End Date
            alignment: left
        }
        layout {
            sequence: 70
            region: @edit-calendar-entry
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            formatMask: DD-MON-YYYY
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: END_DATE
            used: always
        }
        default {
            type: functionBody
            plsqlFunctionBody: return to_date(:"P3_END_DATE_TMP",'RRRRMMDDHH24MISS');
        }
    )

    pageItem P3_END_DATE_TMP (
        type: hidden
        layout {
            sequence: 90
            region: @edit-calendar-entry
            slot: regionBody
        }
        appearance {
            formatMask: RRRRMMDDHH24MISS
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_ID (
        type: hidden
        layout {
            sequence: 20
            region: @edit-calendar-entry
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_LASTVIEW (
        type: hidden
        layout {
            sequence: 10
            region: @edit-calendar-entry
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_PROJECT (
        type: selectList
        label {
            label: Project
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @distinct-projects
            nullDisplayValue: Select a Project
        }
        layout {
            sequence: 40
            region: @edit-calendar-entry
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            type: databaseColumn
            databaseColumn: PROJECT
            used: always
        }
        serverSideCondition {
            type: itemIsNull
            item: P3_ID
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_START_DATE (
        type: datePicker
        label {
            label: Start Date
            alignment: left
        }
        layout {
            sequence: 60
            region: @edit-calendar-entry
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            formatMask: DD-MON-YYYY
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: START_DATE
            used: always
        }
        default {
            type: functionBody
            plsqlFunctionBody: return to_date(:"P3_END_DATE_TMP",'RRRRMMDDHH24MISS');
        }
    )

    pageItem P3_STATUS (
        type: selectList
        label {
            label: Status
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @valid-status-codes
            nullDisplayValue: Select a Status
        }
        layout {
            sequence: 50
            region: @edit-calendar-entry
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            type: databaseColumn
            databaseColumn: STATUS
            used: always
        }
        serverSideCondition {
            type: itemIsNull
            item: P3_ID
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_TASK_NAME (
        type: textField
        label {
            label: Task Name
            alignment: left
        }
        layout {
            sequence: 30
            region: @edit-calendar-entry
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: TASK_NAME
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 40
            region: @buttons
            slot: belowBox
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: &P3_LASTVIEW.
                clearCache: &P3_LASTVIEW.
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button create (
        buttonName: CREATE
        label: Add Event
        layout {
            sequence: 30
            region: @buttons
            slot: belowBox
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
            item: P3_ID
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 20
            region: @buttons
            slot: belowBox
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
            item: P3_ID
        }
    )

    dynamicAction update-end-date (
        name: Update End Date
        execution {
            sequence: 10
        }
        when {
            selectionType: items
            items: P3_START_DATE
        }
        clientSideCondition {
            type: itemIsNull
            item: P3_END_DATE
        }

        action native-set-value (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: $v("P3_START_DATE")
            }
            affectedElements {
                selectionType: items
                items: P3_END_DATE
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    validation end-date-later-than-start-date (
        name: End Date later than start date
        execution {
            sequence: 10
        }
        validation {
            plsqlExpression: to_date(:P3_START_DATE,'DD-MON-YYYY') <= to_date(:P3_END_DATE, 'DD-MON-YYYY')
        }
        error {
            errorMessage: End date must be later than the start date.
            associatedItem: @P3_END_DATE
        }
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
            executionMappingIdentifier: 782289885066481744
        }
    )

    process fetch-row-from-eba-demo-cal-projects (
        name: Fetch Row from EBA_DEMO_CAL_PROJECTS
        type: autoRowFetch
        source {
            tableName: EBA_DEMO_CAL_PROJECTS
            pkColumn: ID
            pkItem: P3_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 2570383176141598384
        }
    )

    process process-row-of-eba-demo-cal-projects (
        name: Process Row of EBA_DEMO_CAL_PROJECTS
        type: autoRowProcessing
        target {
            tableName: EBA_DEMO_CAL_PROJECTS
            pkColumn: ID
            pkItem: P3_ID
            returnKeyIntoItem: P3_ID
            supportedOperations: [
                insert
                update
            ]
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 2570383366752598385
        }
    )

)


````
