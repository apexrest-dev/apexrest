# Project Exceptions — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00153-user-project-exceptions.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0cd4ba1ab0625b9ba5cee6f7f6b235b453e12b3ad37927224c89a7a9ee9bea8f.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 153 (
    name: Project Exceptions
    alias: USER-PROJECT-EXCEPTIONS
    title: &NOMENCLATURE_PROJECT. Exceptions
    pageGroup: @users
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            .sp-tag {
              padding: .125rem .25rem;
              display: inline-block;
              vertical-align: text-bottom;
              border-radius: .1875rem;
              background-color: rgba(0, 0, 0, .1);
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .sp-tags-container {
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: .25rem;
              justify-content: flex-start;
            }
            
            h3:first-of-type {
              margin-block-start: 0;
            }
            ```
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 7
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
            cssClasses: has-header-actions
        }
    )

    region buttons (
        name: buttons
        type: staticContent
        layout {
            sequence: 5
            parentRegion: @nomenclature-project-exceptions
            slot: subRegions
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
        config {
            buildOption: @email-configured
        }
    )

    region hidden-stuff (
        name: hidden stuff
        type: staticContent
        layout {
            sequence: 1
            slot: body
        }
    )

    region nomenclature-project-exceptions (
        name: &NOMENCLATURE_PROJECT. Exceptions
        type: staticContent
        layout {
            sequence: 121
            slot: body
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region project-exceptions-content (
        name: Project Exceptions content
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                return sp_contributor_summary.project_exceptions (
                           p_team_member_id   => :P153_ID,
                           p_links            => 'APP',
                           p_include_title_yn => 'N',
                           p_apex_session     => :APP_SESSION );
                ```
            pageItemsToSubmit: P153_ID
        }
        layout {
            sequence: 25
            parentRegion: @nomenclature-project-exceptions
            slot: subRegions
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noBorder
                t-Region--scrollBody
                margin-top-none
            ]
        }
    )

    pageItem P153_EMAIL (
        type: hidden
        layout {
            sequence: 40
            region: @hidden-stuff
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: webSafe
        }
    )

    pageItem P153_FIRST_NAME (
        type: hidden
        layout {
            sequence: 50
            region: @hidden-stuff
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: webSafe
        }
    )

    pageItem P153_ID (
        type: hidden
        layout {
            sequence: 10
            region: @hidden-stuff
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P153_LAST_NAME (
        type: hidden
        layout {
            sequence: 60
            region: @hidden-stuff
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: webSafe
        }
    )

    button email-me-except (
        buttonName: EMAIL_ME_EXCEPT
        label: Email to me
        layout {
            sequence: 40
            region: @breadcrumb
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--primary
            ]
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button subscribe-me-except (
        buttonName: SUBSCRIBE_ME_EXCEPT
        label: Subscribe me
        layout {
            sequence: 20
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--link
            ]
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1 from sp_notifications n
                 where static_id = 'PROJECT_EXCEPTIONS'
                   and is_active_yn = 'Y'
                   and not exists (select 1 from sp_notification_subscriptions
                                    where notification_id = n.id
                                      and team_member_id = :APP_USER_ID
                                      and opted_in_yn = 'Y')
                   and :APP_USER_ID is not null
                   and :P153_ID = :APP_USER_ID
                ```
        }
        config {
            buildOption: @subscriptions
        }
    )

    button unsubscribe-me-except (
        buttonName: UNSUBSCRIBE_ME_EXCEPT
        label: Unsubscribe
        layout {
            sequence: 30
            region: @buttons
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--link
            ]
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select 1 from sp_notifications n
                 where static_id = 'PROJECT_EXCEPTIONS'
                   and is_active_yn = 'Y'
                   and exists (select 1 from sp_notification_subscriptions
                                where notification_id = n.id
                                  and team_member_id = :APP_USER_ID
                                  and opted_in_yn = 'Y')
                   and :P153_ID = :APP_USER_ID
                ```
        }
        config {
            buildOption: @subscriptions
        }
    )

    button up (
        buttonName: UP
        label: Navigate Up
        layout {
            sequence: 10
            region: @breadcrumb
            slot: up
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-arrow-up
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 5
                items: {
                    P5_ID: &P153_ID.
                }
                clearCache: 5
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process email-exceptions (
        name: Email exceptions
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                    l_summary      clob;
                begin
                
                    l_summary := sp_contributor_summary.project_exceptions (
                                     p_team_member_id  => :P153_ID,
                                     p_links           => 'EMAIL'
                                     );
                
                    apex_mail.send ( 
                            p_to                 => :APP_USER,   
                            p_from               => :APP_USER,  
                            p_application_id     => :APP_ID,  
                            p_template_static_id => 'EMAIL_ME',  
                            p_placeholders       => '{' || '"APPLICATION_LINK": "' || sp_util.get_setting(p_static_id => 'APP_HOME_URL') ||'", '|| 
                                                           '"APP_NAME": '   || apex_json.stringify( :NOMENCLATURE_STRATEGIC_PLANNER ) ||', '||
                                                           '"SUBJECT": '    || apex_json.stringify( :NOMENCLATURE_STRATEGIC_PLANNER ||' '||:NOMENCLATURE_PROJECT ||' Exceptions') ||', '||
                                                           '"SUMMARY": '    || apex_json.stringify( l_summary ) ||
                                                     '}' ); 
                
                end;
                ```
        }
        execution {
            sequence: 40
        }
        successMessage {
            successMessage: Project Exceptions email sent.
        }
        advanced {
            executionMappingIdentifier: 20626362095971225003
        }
        serverSideCondition {
            whenButtonPressed: @email-me-except
        }
    )

    process set-name-details-in-session-state (
        name: set name details in session state
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                for c1 in (
                    select first_name, last_name, email
                      from sp_team_members
                     where id = :P153_ID
                ) loop
                    :P153_FIRST_NAME := c1.first_name;
                    :P153_LAST_NAME  := c1.last_Name;
                    :P153_EMAIL      := c1.email;
                end loop;
                ```
        }
        execution {
            sequence: 20
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 20626360830952225002
        }
    )

    process subscribe-exceptions (
        name: Subscribe exceptions
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_util.notification_opt_in (
                    p_team_member_id  => :APP_USER_ID,
                    p_notification_id => sp_util.get_notification_id('PROJECT_EXCEPTIONS') );
                ```
        }
        execution {
            sequence: 90
        }
        successMessage {
            successMessage: Subscribed to Project Exceptions.
        }
        advanced {
            executionMappingIdentifier: 20626362494195225003
        }
        serverSideCondition {
            whenButtonPressed: @subscribe-me-except
        }
    )

    process unsubscribe-exceptions (
        name: Unsubscribe exceptions
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_util.notification_opt_out (
                    p_team_member_id  => :APP_USER_ID,
                    p_notification_id => sp_util.get_notification_id('PROJECT_EXCEPTIONS') );
                ```
        }
        execution {
            sequence: 100
        }
        successMessage {
            successMessage: Unsubscribed from Project Exceptions.
        }
        advanced {
            executionMappingIdentifier: 20626363259299225004
        }
        serverSideCondition {
            whenButtonPressed: @unsubscribe-me-except
        }
    )

)


````
