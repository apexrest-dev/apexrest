# Application Settings — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00028-application-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: dadfadd1bb2fa0d7458e57f4c638a14db89c2c733d2edd20e8e7f17257c2ab1d.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 28 (
    name: Application Settings
    alias: APPLICATION-SETTINGS
    title: Application Settings
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
        helpText: The preferences on this page are used to affect several aspects of the application. Click the item-level help icons to learn what each preference does.
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

    pageItem P28_APPLICATION_TITLE (
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
        help {
            helpText: The text entered here is used throughout the application, most notably, in the upper left-hand corner of every page. By default, the application name is "&APP_NAME.". The change will take effect immediately for the administrator making the change, but other users will only see the change when they get a new session (e.g. at next login).
        }
    )

    pageItem P28_FEEDBACK_RECIPIENTS (
        type: textarea
        label {
            label: Feedback Recipients
            alignment: left
        }
        layout {
            sequence: 20
            region: @rename-application
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 64
            height: 4
        }
        advanced {
            postText: &nbsp;<a href="f?p=&APP_ID.:119:&APP_SESSION.">Review/Manage Feedback</a>
        }
        source {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                if eba_cust_fw.get_preference_value(p_preference_name  => 'FEEDBACK_RECIPIENTS') = 'Preference does not exist' then
                    return null;
                else
                    return eba_cust_fw.get_preference_value(p_preference_name  => 'FEEDBACK_RECIPIENTS');
                end if;
                ```
        }
        help {
            helpText: <p>Provide a comma-separated list of the email addresses you would like feedback submissions emailed to. When feedback is submitted, the feedback will be emailed to the addresses in this list.</p>
        }
        config {
            buildOption: @feedback
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

    process save-preferences (
        name: Save Preferences
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                :APPLICATION_TITLE := :P28_APPLICATION_TITLE;
                
                eba_cust_fw.set_preference_value( 'APPLICATION_TITLE',   apex_escape.html(:P28_APPLICATION_TITLE) );
                eba_cust_fw.set_preference_value( 'FEEDBACK_RECIPIENTS', apex_escape.html(:P28_FEEDBACK_RECIPIENTS) );
                
                eba_cust_fw.set_preference_value(
                    p_preference_name => 'HOST_URL',
                    p_preference_value => nvl( wwv_flow_utilities.host_url(),
                                               nvl( wwv_flow_utilities.get_protocol(), 'http' )
                                                   ||'://'|| owa_util.get_cgi_env( 'HTTP_HOST' )
                                             )
                );
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Application settings saved.
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 14735810506743843183
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
