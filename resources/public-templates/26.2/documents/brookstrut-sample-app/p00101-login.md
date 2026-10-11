# Login — Brookstrut Sample App

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/brookstrut-sample-app/apexlang/brookstrut/pages/p00101-login.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 413e5c4613868b400c19e6c5830071238fa947f3931066480b43f6f9b7165a71.

Application dependency inventory: oracle:26.2:public-template/brookstrut-sample-app/dependencies.

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
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            .appIcon.brookstrut {
            background-position: -320px -384px;
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
    }
    advanced {
        reloadOnSubmit: always
    }

    region app-name (
        name: &APP_NAME.
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
            fileUrl: "#APP_FILES#icons/app-icon-192.png	"
        }
        advanced {
            htmlDomId: brookstrut
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
            region: @app-name
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            cssClasses: icon-login-password
            width: 64
            valuePlaceholder: password
        }
        validation {
            valueRequired: true
            maxLength: 100
        }
        advanced {
            postText: <span class="t-Login-iconValidation a-Icon icon-check"></span>
        }
        sessionState {
            storage: request
        }
        security {
            encryptSessionState: false
            restrictedChars: webSafe
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
            region: @app-name
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            cssClasses: icon-login-username
            width: 64
            valuePlaceholder: username
        }
        validation {
            valueRequired: true
            maxLength: 100
        }
        advanced {
            postText: <span class="t-Login-iconValidation a-Icon icon-check"></span>
        }
        security {
            restrictedChars: webSafe
        }
    )

    button login (
        buttonName: LOGIN
        label: Sign In
        layout {
            sequence: 10
            region: @app-name
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

    dynamicAction set-focus (
        name: Set Focus
        execution {
            sequence: 10
        }
        when {
            event: ready
        }
        clientSideCondition {
            type: jsExpression
            javaScriptExpression: ( $v( "P101_USERNAME" ) === "" )
        }

        action native-set-focus (
            action: setFocus
            affectedElements {
                selectionType: items
                items: P101_USERNAME
            }
            execution {
                sequence: 10
            }
        )

        action native-set-focus-2 (
            action: setFocus
            affectedElements {
                selectionType: items
                items: P101_PASSWORD
            }
            execution {
                sequence: 20
                fireWhenEventResultIs: false
            }
        )

    )

    process clear-page-s-cache (
        name: Clear Page(s) Cache
        type: clearSessionState
        execution {
            sequence: 30
        }
        advanced {
            executionMappingIdentifier: 22202516004377822257
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
            executionMappingIdentifier: 22202515900059822257
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
            executionMappingIdentifier: 22202515709457822256
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
            executionMappingIdentifier: 22202515802553822257
        }
    )

)


````
