# Login — Sample Charts

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-charts/apexlang/sample-charts/pages/p00101-login.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 3610b5c4b19e147b83b8c85ed26174f8f4baf0cd388f035c075d567a98229ebb.

Application dependency inventory: oracle:26.2:public-template/sample-charts/dependencies.

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
            .appIcon.sample_charts {
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
    advanced {
        reloadOnSubmit: always
    }

    region sample-charts (
        name: Sample Charts
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
            htmlDomId: sample_charts
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
            region: @sample-charts
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
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P101_USERNAME (
        type: textField
        label {
            label: Username
            alignment: left
        }
        layout {
            sequence: 10
            region: @sample-charts
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
            valueRequired: true
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
            sequence: 10
            region: @sample-charts
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
            executionMappingIdentifier: 8193498741571641633
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
            executionMappingIdentifier: 8193498637253641633
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
            executionMappingIdentifier: 8193498446651641632
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
            executionMappingIdentifier: 8193498539747641633
        }
    )

)


````
