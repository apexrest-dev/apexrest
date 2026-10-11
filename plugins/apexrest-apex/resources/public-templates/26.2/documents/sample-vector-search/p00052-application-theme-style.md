# Application Theme Style — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00052-application-theme-style.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 55fa0efef0ecc0fc0adee51157e5d46b06b23f270db2cdf3c4383929db00b20d.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 52 (
    name: Application Theme Style
    alias: APPLICATION-THEME-STYLE
    title: Application Theme Style
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region set-theme-style (
        name: Set Theme Style
        type: staticContent
        source {
            htmlCode: <p>Select the look and feel of the application you would like to use for all users of this application.</p>
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--customIcons
                t-Alert--info
            ]
            icon: fa-design
            renderComponents: belowContent
        }
    )

    pageItem P52_DESKTOP_THEME_STYLE_ID (
        type: selectList
        label {
            label: Theme Style
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                  select s.name d,
                         s.theme_style_id r
                    from apex_application_theme_styles s, apex_application_themes t
                   where s.application_id = t.application_id
                     and s.theme_number = t.theme_number
                     and s.application_id = :app_id
                     and t.ui_type_name   = 'DESKTOP'
                     and t.is_current = 'Yes'
                order by 1
                ```
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 30
            region: @set-theme-style
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
                  from apex_application_theme_styles s, apex_application_themes t
                 where s.application_id = t.application_id
                   and s.theme_number = t.theme_number
                   and s.application_id = :app_id
                   and t.ui_type_name   = 'DESKTOP'
                   and s.is_current = 'Yes'
                ```
            used: always
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1
                  from apex_application_theme_styles s, apex_application_themes t
                 where s.application_id = t.application_id
                   and s.theme_number = t.theme_number
                   and s.application_id = :app_id
                   and t.ui_type_name   = 'DESKTOP'
                   and t.is_current = 'Yes'
                ```
        }
        security {
            restrictedChars: webSafe
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 40
            region: @set-theme-style
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

    process set-theme-style (
        name: Set Theme Style
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                if :P52_DESKTOP_THEME_STYLE_ID is not null then
                    for c1 in ( select theme_number
                                  from apex_application_themes
                                 where application_id = :app_id
                                   and ui_type_name   = 'DESKTOP'
                                   and is_current     = 'Yes'
                               )
                    loop
                        apex_theme.set_current_style (
                            p_theme_number => c1.theme_number,
                            p_id           => :P52_DESKTOP_THEME_STYLE_ID
                        );
                    end loop;
                end if;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Theme Style Set for All Users.
        }
        advanced {
            executionMappingIdentifier: 2468175098550473
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    branch (
        name: Go To Page settings
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 50
            }
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
