# Rename Application — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00045-rename-application.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: cf5c5f5c2664672630afcccbd9d1aa7b59a688e3cd9677257515c2848d6cec0a.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 45 (
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
        helpText: Change the application name, displayed on the top left of each page, to one of your choosing. By default, the application name is "Opportunities". You can also change the application's subtitle text (displayed on the home page).
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

    region rename-application (
        name: Rename Application
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

    pageItem P45_APPLICATION_SUBTITLE (
        type: textField
        label {
            label: Application Subtitle
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 20
            region: @rename-application
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
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select preference_value
                from eba_sales_preferences
                where preference_name = 'APPLICATION_SUBTITLE'
                union all
                select 'Manage Opportunities'
                from dual
                where not exists ( select null
                                   from eba_sales_preferences
                                   where preference_name = 'APPLICATION_SUBTITLE')
                ```
        }
        default {
            type: static
            staticValue: &APP_NAME.
        }
        security {
            restrictedChars: webSafe
        }
    )

    pageItem P45_APPLICATION_TITLE (
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
            region: @rename-application
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
            slot: create
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
                :APPLICATION_TITLE := :P45_APPLICATION_TITLE;
                
                merge into eba_sales_preferences dst
                using ( select 'APPLICATION_TITLE' preference_name, :P45_APPLICATION_TITLE preference_value from dual ) src
                on ( dst.preference_name = src.preference_name )
                when matched then
                    update set dst.preference_value = src.preference_value
                when not matched then
                    insert ( preference_name, preference_value )
                    values ( src.preference_name, src.preference_value );
                
                merge into eba_sales_preferences dst
                using ( select 'APPLICATION_SUBTITLE' preference_name, :P45_APPLICATION_SUBTITLE preference_value from dual ) src
                on ( dst.preference_name = src.preference_name )
                when matched then
                    update set dst.preference_value = src.preference_value
                when not matched then
                    insert ( preference_name, preference_value )
                    values ( src.preference_name, src.preference_value );
                
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
            executionMappingIdentifier: 7356126946694575717
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
