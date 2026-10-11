# Rename Application — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00008-rename-application.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d04899152065e6ddcd3dd17646b20a7316389cc49c0541fa0d79c43587168e44.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 8 (
    name: Rename Application
    alias: RENAME-APPLICATION
    title: Rename Application
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
        helpText: <p>Use this to control the application name displayed on the top left of each page and on the login pages.  By default, the application name is "&APP_NAME.".  The change will take effect immediately for the administrator making the change, but other users will only see the change when they get a new session (e.g. at next login).</p>
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 30
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    region form-items (
        name: Form Items
        type: staticContent
        layout {
            sequence: 40
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P8_APPLICATION_TITLE (
        type: textField
        label {
            label: Application Name
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 10
            region: @form-items
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
            type: staticValue
            staticValue: &APPLICATION_TITLE.
            used: always
        }
        default {
            type: static
            staticValue: &APP_NAME.
        }
        security {
            restrictedChars: webSafe
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

    process set-application-title (
        name: Set Application Title
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                :APPLICATION_TITLE := :P8_APPLICATION_TITLE;
                
                begin
                    insert into eba_qpoll_preferences
                    (preference_name, preference_value)
                    values
                    ('APPLICATION_TITLE', apex_escape.html(:P8_APPLICATION_TITLE));
                exception
                    when DUP_VAL_ON_INDEX then
                        update eba_qpoll_preferences
                           set preference_value = apex_escape.html(:P8_APPLICATION_TITLE)
                         where preference_name = 'APPLICATION_TITLE';
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Application renamed.
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 14511481800938382392
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
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
