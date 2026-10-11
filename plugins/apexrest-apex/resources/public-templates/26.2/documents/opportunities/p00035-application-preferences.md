# Application Preferences — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00035-application-preferences.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 198eb7813fa68d1772f8b0a2088b2d084c9134891d4ea4cad040c7f69c56b7ee.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 35 (
    name: Application Preferences
    alias: APPLICATION-PREFERENCES
    title: Application Preferences
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
    }
    help {
        helpText: Manage your application's preferences. Set the title text used to describe representatives in your line of business.
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

    region preferences (
        name: Preferences
        type: staticContent
        layout {
            sequence: 1210
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P35_REP_TITLE (
        type: textField
        label {
            label: Representative Title
            alignment: left
        }
        layout {
            sequence: 10
            region: @preferences
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            valueRequired: true
        }
        source {
            type: functionBody
            plsqlFunctionBody: return eba_sales_fw.get_preference_value('REP_TITLE');
        }
        help {
            inlineHelpText: The administrator changing this value will see the change immediately. Other users, however, will need to logout and log back in to see the change.
            helpText: By default, the term "Sales Rep" is used in many places of this application but this title may not be appropriate for some lines of business. Use this preference to change this title to something more appropriate to your line of business (e.g. Account Manager, Key Account Director, Global Consultant Advisor, etc...).
        }
    )

    pageItem P35_SALES_LDR_TITLE (
        type: textField
        label {
            label: Sales Leader Title
            alignment: left
        }
        layout {
            sequence: 20
            region: @preferences
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        source {
            type: functionBody
            plsqlFunctionBody: return replace(eba_sales_fw.get_preference_value('SALES_LDR_TITLE'),'Preference does not exist','Sales Leader');
        }
        default {
            type: static
            staticValue: Sales Leader
        }
        help {
            inlineHelpText: The administrator changing this value will see the change immediately. Other users, however, will need to logout and log back in to see the change.
            helpText: By default, the term "Sales Leader" is used in many places of this application but this title may not be appropriate for some lines of business. Use this preference to change this title to something more appropriate to your line of business (e.g. Account Manager, Key Account Director, Global Consultant Advisor, etc...).
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
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

    process save-preference-values (
        name: Save Preference Values
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                eba_sales_fw.set_preference_value('REP_TITLE', :P35_REP_TITLE);
                
                :REP_TITLE := apex_escape.html(eba_sales_fw.get_preference_value('REP_TITLE'));
                
                eba_sales_fw.set_preference_value('REP_TITLE_RAW', :P35_REP_TITLE);
                
                :REP_TITLE_RAW := eba_sales_fw.get_preference_value('REP_TITLE_RAW');
                
                eba_sales_fw.set_preference_value('SALES_LDR_TITLE', :P35_SALES_LDR_TITLE);
                
                :SALES_LDR_TITLE := apex_escape.html(eba_sales_fw.get_preference_value('SALES_LDR_TITLE'));
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Application preferences updated.
        }
        advanced {
            executionMappingIdentifier: 7523008615170793752
        }
    )

    branch (
        name: Go to Administration
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: settings
                action: resetPagination
            }
        }
    )

)


````
