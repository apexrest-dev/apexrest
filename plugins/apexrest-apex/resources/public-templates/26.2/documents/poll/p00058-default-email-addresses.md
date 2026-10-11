# Default Email Addresses — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00058-default-email-addresses.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b856bbff01fbc25c4d3dec750aff674921f7271022ac21f8f1e712cfd2ef9f0c.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 58 (
    name: Default Email Addresses
    alias: DEFAULT-EMAIL-ADDRESSES
    title: Default Email Addresses
    pageGroup: @administration
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
        authorizationScheme: @administration-rights
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: <p>Use this page to configure the application's default "From" and "Reply To" email addresses.</p>
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
    )

    region default-email-addresses (
        name: " Default Email Addresses"
        type: staticContent
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            renderComponents: belowContent
        }
        advanced {
            excludeTitleFromTranslation: true
        }
    )

    pageItem P58_FROM (
        type: textField
        label {
            label: From
            alignment: left
        }
        layout {
            sequence: 10
            region: @default-email-addresses
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
            type: expression
            plsqlExpression: replace(eba_qpoll_fw.get_preference_value('NOTIFICATION_EMAIL_FROM'),'N/A',null)
            used: always
        }
        security {
            restrictedChars: webSafe
        }
        help {
            helpText: Enter the email address that emails sent from this application will use as their "from" address.
        }
    )

    pageItem P58_REPLY_TO (
        type: textField
        label {
            label: Reply To
            alignment: left
        }
        layout {
            sequence: 20
            region: @default-email-addresses
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 64
        }
        validation {
            maxLength: 255
        }
        source {
            type: expression
            plsqlExpression: replace(eba_qpoll_fw.get_preference_value('NOTIFICATION_EMAIL_REPLY_TO'),'N/A',null)
            used: always
        }
        security {
            restrictedChars: webSafe
        }
        help {
            helpText: Enter the email address that emails sent from this application will use as their "reply to" address.
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
        }
    )

    dynamicAction cnx (
        name: CNX
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

    validation p58-from-valid-email (
        name: P58_FROM VALID EMAIL
        execution {
            sequence: 10
        }
        validation {
            type: itemMatchesRegexp
            item: P58_FROM
            regexp: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}"
        }
        error {
            errorMessage: Not a valid email address.
            associatedItem: @P58_FROM
        }
        serverSideCondition {
            whenButtonPressed: @save
            type: itemIsNotNull
            item: P58_FROM
        }
    )

    validation p58-reply-to-valid-email (
        name: P58_REPLY_TO VALID EMAIL
        execution {
            sequence: 20
        }
        validation {
            type: itemMatchesRegexp
            item: P58_REPLY_TO
            regexp: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}"
        }
        error {
            errorMessage: Not a valid email address.
            associatedItem: @P58_REPLY_TO
        }
        serverSideCondition {
            whenButtonPressed: @save
            type: itemIsNotNull
            item: P58_REPLY_TO
        }
    )

    process save-email-addresses (
        name: Save Email Addresses
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                eba_qpoll_fw.set_preference_value('NOTIFICATION_EMAIL_FROM',lower(:P58_FROM));
                eba_qpoll_fw.set_preference_value('NOTIFICATION_EMAIL_REPLY_TO',nvl(lower(:P58_REPLY_TO),'N/A'));
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Default email addresses saved.
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 13904520971519200609
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: settings
            }
        }
    )

)


````
