# Create Collection — Sample Collections

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-collections/apexlang/sample-collections/pages/p00002-create-collection.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 152b9729735075c64215833dcc0a8c4e730a47b7072f317c2f60bc4ed1f0e2ac.

Application dependency inventory: oracle:26.2:public-template/sample-collections/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 2 (
    name: Create Collection
    alias: CREATE-COLLECTION
    title: Create Collection
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
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
            sequence: 20
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region collection (
        name: Collection
        type: staticContent
        layout {
            sequence: 10
            slot: wizardBody
            columnAttributes: valign=top
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P2_NAME (
        type: textField
        label {
            label: Collection Name
            alignment: left
        }
        settings {
            trimSpaces: none
            submitWhenEnterPressed: true
        }
        layout {
            sequence: 10
            region: @collection
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
            maxLength: 2000
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button cancel (
        buttonName: Cancel
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button create (
        buttonName: Create
        label: Create Collection
        layout {
            sequence: 20
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button create-replace (
        buttonName: Create_Replace
        label: Create/Replace Collection
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
        }
    )

    process create (
        name: Create
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_collection.create_collection( p_collection_name => :P2_NAME );
                commit;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Successfully created collection <b>&P2_NAME.</b>.
        }
        error {
            errorMessage: Error creating collection <b>&P2_NAME.</b>.
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 8866745713371998896
        }
        serverSideCondition {
            whenButtonPressed: @create
        }
    )

    process create-on-return-key-submit (
        name: Create on Return Key Submit
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_collection.create_collection( p_collection_name => :P2_NAME );
                commit;
                ```
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Successfully created collection <b>&P2_NAME.</b>.
        }
        error {
            errorMessage: Error creating collection <b>&P2_NAME.</b>.
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 1156315145607388521
        }
        serverSideCondition {
            type: request=Value
            value: P2_NAME
        }
    )

    process create-replace (
        name: Create/Replace
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_collection.create_or_truncate_collection( p_collection_name => :P2_NAME );
                commit;
                ```
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Successfully created/replaced collection <b>&P2_NAME.</b>.
        }
        error {
            errorMessage: Error creating/replacing collection <b>&P2_NAME.</b>.
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 8866750420045010910
        }
        serverSideCondition {
            whenButtonPressed: @create-replace
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            type: page
            pageNumber: 3
        }
    )

)


````
