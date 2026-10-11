# Login — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00101-login.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1607501515269c9998bb6885d9c0e2ba56bc429e0b4de21c1164075bc55bfec0.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 101 (
    name: Login
    alias: LOGIN
    title: Sign In | &APPLICATION_TITLE.
    pageGroup: @login
    appearance {
        pageTemplate: @/login
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
    }
    advanced {
        reloadOnSubmit: always
    }

    region p101-app-name (
        name: &P101_APP_NAME.
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
            htmlDomId: group_calendar
        }
    )

    pageItem P101_APP_NAME (
        type: hidden
        layout {
            sequence: 30
            region: @p101-app-name
            slot: regionBody
        }
        source {
            type: expression
            plsqlExpression: nvl(:APPLICATION_TITLE, :APP_NAME)
            used: always
        }
        security {
            sessionStateProtection: restricted
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
            region: @p101-app-name
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
            region: @p101-app-name
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
    )

    button login (
        buttonName: LOGIN
        label: Sign In
        layout {
            sequence: 10
            region: @p101-app-name
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
        error {
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 8920372040592394812
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
            executionMappingIdentifier: 8920371942958394812
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
        error {
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 8920371746011394759
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
        error {
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 8920371851472394812
        }
    )

)


````
