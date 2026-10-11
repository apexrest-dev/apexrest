# Welcome Text — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00014-welcome-text.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 39d0150880eb930afe9269daf738f5c8aa08451885bf7641965787c23f31bbba.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 14 (
    name: Welcome Text
    alias: WELCOME-TEXT
    title: Welcome Text
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
    )

    region welcome-text (
        name: Welcome Text
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

    pageItem P14_WELCOME_TEXT (
        type: textarea
        label {
            label: Welcome Text, displayed on home page
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 10
            region: @welcome-text
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 80
            height: 4
        }
        validation {
            valueRequired: true
            maxLength: 4000
        }
        source {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                declare
                   c integer := 0;
                   t varchar2(4000) := null;
                begin
                select count(*) into c from eba_cust_preferences where preference_name = 'WELCOME_TEXT';
                if c = 0 then 
                    return null;
                else
                    t := EBA_CUST_FW.get_preference_value ('WELCOME_TEXT');
                    if t = '&'||'nbsp;' then 
                       return null;
                    else 
                       return t;
                    end if;
                end if;
                exception when others then return null;
                end;
                ```
            used: always
        }
    )

    button apply-changes (
        buttonName: APPLY_CHANGES
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

    button cancel (
        buttonName: CANCEL
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
            action: definedByDynamicAction
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

    process set-preference (
        name: set preference
        type: executeCode
        source {
            plsqlCode: EBA_CUST_FW.set_preference_value('WELCOME_TEXT',nvl(:P14_WELCOME_TEXT,'&'||'nbsp;'));
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Welcome text preference changed.
        }
        advanced {
            executionMappingIdentifier: 15066475800317033882
        }
        serverSideCondition {
            whenButtonPressed: @apply-changes
        }
    )

    branch (
        name: back to admin
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 12
            }
        }
    )

)


````
