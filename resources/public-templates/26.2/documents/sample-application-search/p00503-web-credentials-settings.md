# Web Credentials Settings — Sample Application Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-application-search/apexlang/sample-application-search/pages/p00503-web-credentials-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 101f388847b884147f30def9d84e5e22be1900585dd94387acc4555303c26645.

Application dependency inventory: oracle:26.2:public-template/sample-application-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 503 (
    name: Web Credentials Settings
    alias: WEB-CREDENTIALS-SETTINGS
    title: Web Credentials Settings
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>Search Configurations can be based on REST Data Sources. The <strong>REST Data Source</strong> page in the <strong>Basics</strong> section rely on REST Data Sources. To run this page without error, please use the links and instructions below. You will need to get your own API key from <a title="Movie Database API" href="https://www.themoviedb.org/documentation/api" target="_blank">The Movie Database (TMDb) API Key</a> that you will then submit in the form below to successfully configure the necessary <strong>credentials.</strong></p>
        }
        layout {
            sequence: 10
            slot: body
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

    region credentials-form (
        name: Credentials Form
        type: staticContent
        layout {
            sequence: 20
            slot: body
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

    pageItem P503_API_KEY (
        type: password
        label {
            label: API Key
            alignment: left
        }
        layout {
            sequence: 20
            region: @credentials-form
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--large
            ]
            width: 30
        }
        validation {
            valueRequired: true
        }
        sessionState {
            storage: request
        }
    )

    pageItem P503_NAME (
        type: displayOnly
        label {
            label: Credentials Name
            alignment: left
        }
        layout {
            sequence: 10
            region: @credentials-form
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        default {
            type: static
            staticValue: TMDb API Key
        }
        security {
            sessionStateProtection: restricted
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: administration
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

    process mark-web-credentials (
        name: Mark Web Credentials
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                  v_count number;
                begin
                  select count(*) into v_count
                  from eba_demo_search_web_creds
                  where credential_static_id = 'tmdb_api_key';
                  
                  if v_count = 0 then
                    insert into eba_demo_search_web_creds(credential_static_id)
                    values('tmdb_api_key');
                  end if;
                end;
                ```
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Credentials have been set.
        }
        advanced {
            executionMappingIdentifier: 2452928787820844908
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    process set-web-credentials (
        name: Set Web Credentials
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    apex_credential.set_persistent_credentials (
                    p_credential_static_id => 'tmdb_api_key',
                    p_username             => 'api_key',
                    p_password             => :P503_API_KEY );
                end;
                ```
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 2452928493040844905
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    branch (
        name: Go To Page 103
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 103
                clearCache: 103
            }
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
