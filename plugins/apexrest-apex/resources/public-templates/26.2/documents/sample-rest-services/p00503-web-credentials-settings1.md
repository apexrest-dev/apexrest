# Web Credentials Settings — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00503-web-credentials-settings1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 07ff22e3473e8566c50fa05648b87add6f847876884b64b38d73c465ad466068.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 503 (
    name: Web Credentials Settings
    alias: WEB-CREDENTIALS-SETTINGS1
    title: Web Credentials Settings
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: @administration-rights
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
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>The <strong>Cards Layout</strong> page in the <strong>Data Display Options</strong> section, and the <strong>REST Data Source Plugins</strong> page in the <strong>Advanced Features</strong> section both rely on <a title="Movie Database API" href="https://www.themoviedb.org/documentation/api" target="_blank">The Movie Database (TMDb) API</a>. To run these pages without error, you will need to get your own API key from <a title="Movie Database API" href="https://www.themoviedb.org/documentation/api" target="_blank">The Movie Database (TMDb) API</a>, then configure the Web Credential using the API Key field below.</p>
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
    )

    region web-credential (
        name: Web Credential
        type: staticContent
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
    )

    pageItem P304_SOURCE (
        type: hidden
        layout {
            sequence: 30
            slot: body
        }
        default {
            type: static
            staticValue: 500
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_API_KEY (
        type: password
        label {
            label: API Key
            alignment: left
        }
        layout {
            sequence: 20
            region: @web-credential
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--indicatorAsterisk
                t-Form-fieldContainer--xlarge
            ]
            width: 80
        }
        validation {
            valueRequired: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P3_NAME (
        type: displayOnly
        label {
            label: Credentials Name
            alignment: left
        }
        layout {
            sequence: 10
            region: @web-credential
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        source {
            type: staticValue
            staticValue: MovieDb API Key
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button save (
        buttonName: Save
        label: Save
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

    process mark-as-provided (
        name: Mark As Provided
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    if :P3_API_KEY is not null then 
                        apex_app_setting.set_value('TMDB_APIKEY', 'YES');
                    end if;
                end;
                ```
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 7467261941816239
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
                    apex_credential.set_persistent_credentials(
                        p_credential_static_id => 'moviedb_api_key',
                        p_username             => 'api_key',
                        p_password             => :P3_API_KEY
                    );
                end;
                
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Web Credentials set successfully
        }
        error {
            errorMessage: error  while setting Web Credentials , please try again
        }
        advanced {
            executionMappingIdentifier: 7466853553816239
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

    branch (
        name: goback
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: &P304_SOURCE.
                clearCache: &DEBUG.
                request: &SESSION.
            }
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )

)


````
