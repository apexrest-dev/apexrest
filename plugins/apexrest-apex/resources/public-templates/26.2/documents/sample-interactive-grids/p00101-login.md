# Login — Sample Interactive Grids

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-interactive-grids/apexlang/sample-interactive-grids/pages/p00101-login.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2983adaa48d289213997e9b99048d16bfdd22e5b5b9a1db54965f7a512cbddf6.

Application dependency inventory: oracle:26.2:public-template/sample-interactive-grids/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 101 (
    name: Login
    alias: LOGIN
    title: Sign In | &APP_NAME.
    appearance {
        pageTemplate: @/login
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            .appIcon.sample_ig {
            background-position: -192px -192px;
            }
            
            .appIcon {
            display: inline-block;
            width: 64px;
            height: 64px;
            background-image: url(#IMAGE_PREFIX#eba/img/eba_launchpad.png);
            background-repeat: no-repeat;
            border: none;
            -webkit-border-radius: 4px;
            -moz-border-radius: 4px;
            border-radius: 4px;
            -webkit-box-shadow: 0 0 1px rgba(0,0,0,0.75) inset;
            -moz-box-shadow: 0 0 1px rgba(0,0,0,0.75) inset;
            box-shadow: 0 0 1px rgba(0,0,0,0.75) inset;
            margin-right: 8px;
            vertical-align: middle;
            }
            ```
    }
    security {
        authentication: public
        pageAccessProtection: noArgumentsSupported
    }

    region sample-interactive-grids (
        name: Sample Interactive Grids
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/login
            templateOptions: #DEFAULT#
        }
        image {
            fileUrl: #APP_FILES#icons/app-icon-512.png
        }
        advanced {
            htmlDomId: sample_ig
        }
    )

    pageItem P101_PASSWORD (
        type: password
        label {
            label: Password
            alignment: left
        }
        layout {
            sequence: 20
            region: @sample-interactive-grids
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            icon: fa-key
            width: 64
            valuePlaceholder: password
        }
        validation {
            maxLength: 100
        }
        advanced {
            postText: <span class="t-Login-iconValidation a-Icon icon-check"></span>
        }
        sessionState {
            storage: request
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P101_USERNAME (
        type: textField
        label {
            label: Username
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 10
            region: @sample-interactive-grids
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            icon: fa-user
            width: 64
            valuePlaceholder: username
        }
        validation {
            maxLength: 100
        }
        advanced {
            postText: <span class="t-Login-iconValidation a-Icon icon-check"></span>
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: webSafe
        }
    )

    button login (
        buttonName: LOGIN
        label: Sign In
        layout {
            sequence: 30
            region: @sample-interactive-grids
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

    process clear-page-s-cache (
        name: Clear Page(s) Cache
        type: clearSessionState
        execution {
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 1323695069394702255
        }
    )

    process get-username-cookie (
        name: Get Username Cookie
        type: executeCode
        source {
            plsqlCode: :P101_USERNAME := apex_authentication.get_login_username_cookie;
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 1323694982873702255
        }
    )

    process login (
        name: Login
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_authentication.login(
                    p_username => :P101_USERNAME,
                    p_password => :P101_PASSWORD );
                ```
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 1323694773559702254
        }
    )

    process set-username-cookie (
        name: Set Username Cookie
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                apex_authentication.send_login_username_cookie (
                    p_username => lower(:P101_USERNAME) );
                ```
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 1323694862929702255
        }
    )

)


````
