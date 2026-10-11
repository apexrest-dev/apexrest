# Login Page Template — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01114-login-page-template.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 65d990fc3e288052ace766694b887e087925f5064368f3e5cbe78b90ac716adc.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1114 (
    name: Login Page Template
    alias: LOGIN-PAGE-TEMPLATE
    title: Login Page Template - &APP_TITLE.
    appearance {
        pageTemplate: @/login
        templateOptions: [
            #DEFAULT#
            t-LoginPage--bg3
        ]
    }
    navigationMenu {
        overrideUserInterfaceLevel: true
        list: @ut-sample-navigation-menu
        listPosition: top
        listTemplate: @/top-navigation-menu
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
    help {
        helpText: No help is available for this page.
    }

    region login-region (
        name: Login Region
        type: staticContent
        layout {
            sequence: 30
            slot: contentBody
        }
        appearance {
            template: @/login
            templateOptions: #DEFAULT#
            icon: app-sample-universal-theme
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P1114_PASSWORD (
        type: password
        label {
            label: Password
            alignment: left
        }
        settings {
            submitWhenEnterPressed: false
        }
        layout {
            sequence: 20
            region: @login-region
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            icon: fa-key
            width: 30
            valuePlaceholder: password
        }
        advanced {
            cssClasses: icon-login-password
        }
        sessionState {
            storage: request
        }
    )

    pageItem P1114_USER (
        type: textField
        label {
            label: User Name
            alignment: left
        }
        layout {
            sequence: 10
            region: @login-region
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            icon: fa-user
            width: 30
            valuePlaceholder: username
        }
    )

    button p1114-login (
        buttonName: P1114_LOGIN
        label: Log In
        layout {
            sequence: 10
            region: @login-region
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

)


````
