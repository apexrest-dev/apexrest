# Country Details — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00018-country-details2.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 990ee6536d03099ba7dca884ddb3dc23d6d608d437494bad3705c6345f1dfd84.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 18 (
    name: Country Details
    alias: COUNTRY-DETAILS2
    title: Country Details
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

    region country-details (
        name: Country Details
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

    pageItem P18_COUNTRY_CODE (
        type: textField
        label {
            label: Country Code
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 40
            region: @country-details
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
            databaseColumn: COUNTRY_CODE
            used: always
        }
    )

    pageItem P18_COUNTRY_NAME (
        type: textField
        label {
            label: Name
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 30
            region: @country-details
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
            databaseColumn: COUNTRY_NAME
            used: always
        }
    )

    pageItem P18_ID (
        type: hidden
        layout {
            sequence: 1
            region: @country-details
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

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 40
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
        advanced {
            htmlDomId: CANCEL
        }
    )

    button create (
        buttonName: CREATE
        label: Create Country
        layout {
            sequence: 30
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
        advanced {
            htmlDomId: CREATE
        }
        serverSideCondition {
            type: itemIsNull
            item: P18_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 50
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
        advanced {
            htmlDomId: DELETE
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P18_ID
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 20
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
        advanced {
            htmlDomId: SAVE
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P18_ID
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
            executionMappingIdentifier: 6522287011958011354
        }
    )

    process fetch-row-from-eba-sales-countries (
        name: Fetch Row from eba_sales_COUNTRIES
        type: autoRowFetch
        source {
            tableName: EBA_SALES_COUNTRIES
            pkColumn: ID
            pkItem: P18_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        error {
            errorMessage: Unable to fetch row.
        }
        advanced {
            executionMappingIdentifier: 10495670283308993778
        }
    )

    process process-row-of-eba-sales-countries (
        name: Process Row of eba_sales_COUNTRIES
        type: autoRowProcessing
        target {
            tableName: EBA_SALES_COUNTRIES
            pkColumn: ID
            pkItem: P18_ID
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        error {
            errorMessage: Unable to process row of table eba_sales_COUNTRIES.
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 10495670508494993780
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
            executionMappingIdentifier: 10495670689818993780
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
