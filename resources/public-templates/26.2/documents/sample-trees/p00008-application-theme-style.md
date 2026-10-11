# Application Theme Style — Sample Trees

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-trees/apexlang/sample-trees/pages/p00008-application-theme-style.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 00af2f08d10f85a909b2ebc7af02777b4af18fc624fa36f565ba1bc48ec69677.

Application dependency inventory: oracle:26.2:public-template/sample-trees/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 8 (
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
        authorizationScheme: mustNotBePublicUser
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>Select the look and feel of the application you would like to use for all users of this application.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
            renderComponents: belowContent
        }
    )

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
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    pageItem P8_DESKTOP_THEME_STYLE_ID (
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
            sequence: 20
            region: @about-this-page
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
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: webSafe
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @breadcrumb
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: settings
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 20
            region: @breadcrumb
            slot: create
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
                if :P8_DESKTOP_THEME_STYLE_ID is not null then
                    for c1 in (select theme_number
                               from apex_application_themes
                               where application_id = :app_id
                               and ui_type_name   = 'DESKTOP'
                               and is_current = 'Yes')
                    loop
                        apex_theme.set_current_style (
                            p_theme_number   => c1.theme_number,
                            p_id => :P8_DESKTOP_THEME_STYLE_ID
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
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 2127137868219220098
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
