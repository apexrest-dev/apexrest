# Theme Style Selection — Json Sample Sources

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/pages/p00601-theme-style-selection.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d8bac7d1f48be893a44a8a79a9fdb07a5c3aef985d2952adfe415bfc630fd953.

Application dependency inventory: oracle:26.2:public-template/json-sample-sources/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 601 (
    name: Theme Style Selection
    alias: THEME-STYLE-SELECTION
    title: Theme Style Selection
    pageGroup: @administration
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: @administration-rights
    }
    help {
        helpText:
            ```html
            <p>Select the default color scheme used to display the application.</p>
            <p>If <strong>Allow End Users to choose Theme Style</strong> is checked, then each end user can select from the available theme styles by clicking the <em>Customize</em> link in the bottom left corner of the Home page.</p>
            ```
    }
    config {
        buildOption: @feature-theme-style-selection
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

    region configure-appearance (
        name: Configure Appearance
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
    )

    pageItem P601_DESKTOP_THEME_STYLE_ID (
        type: selectList
        label {
            label: Theme Style
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @desktop-theme-styles
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @configure-appearance
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select s.theme_style_id
                from apex_application_theme_styles s,
                    apex_application_themes t
                where s.application_id = t.application_id
                    and s.theme_number = t.theme_number
                    and s.application_id = :app_id
                    and s.is_current = 'Yes'
                ```
            used: always
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select null
                  from apex_application_theme_styles s,
                       apex_application_themes t
                 where s.application_id = t.application_id
                   and s.theme_number   = t.theme_number
                   and s.application_id = :app_id
                ```
        }
        security {
            restrictedChars: webSafe
        }
        help {
            inlineHelpText: The default Theme Style applies to all users.
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
            executeValidations: false
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 20
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

    process save-theme-style (
        name: Save Theme Style
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                if :P601_DESKTOP_THEME_STYLE_ID is not null then
                    for l_theme in (select theme_number
                                      from apex_application_themes
                                     where application_id = :app_id
                                       and is_current     = 'Yes')
                    loop
                        apex_util.set_current_theme_style (
                            p_theme_number   => l_theme.theme_number,
                            p_theme_style_id => :P601_DESKTOP_THEME_STYLE_ID
                            );
                    end loop;
                end if;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Application Appearance Settings Saved.
        }
        advanced {
            executionMappingIdentifier: 14298291012288427
        }
    )

    branch (
        name: Branch to Admin Page
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 600
                action: resetPagination
            }
        }
    )

)


````
