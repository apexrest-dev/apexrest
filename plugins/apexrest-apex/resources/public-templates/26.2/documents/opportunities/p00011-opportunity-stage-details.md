# Opportunity Stage Details — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00011-opportunity-stage-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: cac57bb2eace8f4e79202de12749fd79c1050ad09e5618bc8db1664caf5cee93.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Opportunity Stage Details
    alias: OPPORTUNITY-STAGE-DETAILS
    title: Opportunity Stage Details
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        chained: false
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    htmlHeader {
        htmlHeader:
            ```html
            <script language="JavaScript" type="text/javascript">
            <!--
            
             htmldb_delete_message='"DELETE_CONFIRM_MSG"';
            
            //-->
            </script>
            ```
    }
    security {
        authorizationScheme: @administration-rights
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

    region opportunity-stage-details (
        name: Opportunity Stage Details
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P11_CODE_DESCRIPTION (
        type: textarea
        label {
            label: Description
            alignment: left
        }
        settings {
            resizable: false
            trimSpaces: none
        }
        layout {
            sequence: 40
            region: @opportunity-stage-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 64
            height: 4
        }
        validation {
            maxLength: 4000
        }
        source {
            type: databaseColumn
            databaseColumn: CODE_DESCRIPTION
            used: always
        }
    )

    pageItem P11_CORRESPONDING_PROB_PCT (
        type: numberField
        label {
            label: Corresponding Probability
            alignment: left
        }
        settings {
            minValue: 0
            maxValue: 100
            virtualKeyboard: text
        }
        layout {
            sequence: 30
            region: @opportunity-stage-details
            slot: regionBody
            alignment: left
            startNewRow: false
            columnSpan: 4
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 20
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        advanced {
            postText: &nbsp;%
        }
        source {
            type: databaseColumn
            databaseColumn: CORRESPONDING_PROB_PCT
            used: always
        }
    )

    pageItem P11_ID (
        type: hidden
        layout {
            sequence: 1
            region: @opportunity-stage-details
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

    pageItem P11_STATUS_CODE (
        type: textField
        label {
            label: Name
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 20
            region: @opportunity-stage-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            valueRequired: true
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: STATUS_CODE
            used: always
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @buttons
            slot: edit
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
        label: Create Step to Close
        layout {
            sequence: 40
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--gapLeft
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            databaseAction: insert
        }
        serverSideCondition {
            type: itemIsNull
            item: P11_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 30
            region: @buttons
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--simple
                t-Button--danger
            ]
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.confirm(htmldb_delete_message,'DELETE');
            warnOnUnsavedChanges: doNotCheck
            databaseAction: delete
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P11_ID
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 50
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--gapLeft
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            databaseAction: update
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P11_ID
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
            executionMappingIdentifier: 6527632822604112058
        }
    )

    process fetch-row-from-eba-sales-deal-status-codes (
        name: Fetch Row from EBA_SALES_DEAL_STATUS_CODES
        type: autoRowFetch
        source {
            tableName: EBA_SALES_DEAL_STATUS_CODES
            pkColumn: ID
            pkItem: P11_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        error {
            errorMessage: Unable to fetch row.
        }
        advanced {
            executionMappingIdentifier: 10495525901247785646
        }
    )

    process process-row-of-eba-sales-deal-status-codes (
        name: Process Row of EBA_SALES_DEAL_STATUS_CODES
        type: autoRowProcessing
        target {
            tableName: EBA_SALES_DEAL_STATUS_CODES
            pkColumn: ID
            pkItem: P11_ID
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        error {
            errorMessage: Unable to process row of table EBA_SALES_DEAL_STATUS_CODES.
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 10495526082658785649
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        error {
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 10495526287024785649
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
