# Team Member Details — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00030-team-member-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 91d7c5fd81f3294ad9bc9f29a52111c09170a4dc7e53c3b5a6a12baf40b4b4fc.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 30 (
    name: Team Member Details
    alias: TEAM-MEMBER-DETAILS
    title: Team Member Details
    pageGroup: @opportunities
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
    javaScript {
        functionAndGlobalVariableDeclaration: var htmldb_delete_message='"DELETE_CONFIRM_MSG"';
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
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

    region team-member-details (
        name: Team Member Details
        type: staticContent
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P30_DEAL (
        type: hidden
        layout {
            sequence: 50
            region: @team-member-details
            slot: regionBody
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select deal_name
                from eba_sales_deals
                where id = :P30_DEAL_ID
                ```
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P30_DEAL_ID (
        type: hidden
        layout {
            sequence: 20
            region: @team-member-details
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: DEAL_ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P30_ID (
        type: hidden
        layout {
            sequence: 10
            region: @team-member-details
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

    pageItem P30_REP_ID (
        type: selectList
        label {
            label: Team Member
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @team-member
            nullDisplayValue: - Select Team Member -
        }
        layout {
            sequence: 40
            region: @team-member-details
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
            databaseColumn: REP_ID
            used: always
        }
        readOnly {
            type: itemIsNotNull
            item: P30_ID
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
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
        label: Add Team Member
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
        serverSideCondition {
            type: itemIsNull
            item: P30_ID
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 20
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
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
            databaseAction: delete
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P30_ID
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

    validation p30-rep-id-not-duplicated (
        name: P30_REP_ID not duplicated
        execution {
            sequence: 10
        }
        validation {
            type: noRowsReturned
            sqlQuery:
                ```sql
                select null
                from eba_sales_deal_team
                where ( :P30_ID is null or id = :P30_ID )
                    and deal_id = :P30_DEAL_ID
                    and rep_id = :P30_REP_ID
                ```
        }
        error {
            errorMessage: Selected team member is already associated with this opportunity.
            associatedItem: @P30_REP_ID
        }
    )

    process close (
        name: Close
        type: closeDialog
        settings {
            showSuccessMessages: false
        }
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 6542458416876038181
        }
    )

    process fetch-row-from-eba-sales-deal-team (
        name: Fetch Row from EBA_SALES_DEAL_TEAM
        type: autoRowFetch
        source {
            tableName: EBA_SALES_DEAL_TEAM
            pkColumn: ID
            pkItem: P30_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 7375775445935871430
        }
    )

    process process-row-of-eba-sales-deal-team (
        name: Process Row of EBA_SALES_DEAL_TEAM
        type: autoRowProcessing
        target {
            tableName: EBA_SALES_DEAL_TEAM
            pkColumn: ID
            pkItem: P30_ID
            supportedOperations: [
                insert
                delete
            ]
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 7375775665421871431
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 7375775855387871431
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
