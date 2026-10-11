# Accept Service Terms — Qask

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/qask/apexlang/qask/pages/p09995-accept-service-terms.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ace9d769d0b8ed6bb5b0a39a932cf0696f74ce0b30d76f4e26544b39c7e77534.

Application dependency inventory: oracle:26.2:public-template/qask/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9995 (
    name: Accept Service Terms
    alias: ACCEPT-SERVICE-TERMS
    title: qAsk Accept Service Terms
    appearance {
        pageTemplate: @/login
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @host
        deepLinking: false
    }

    region accept-service-terms (
        name: Accept Service Terms
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/login
            templateOptions: #DEFAULT#
            icon: app-icon
        }
    )

    pageItem P9995_TERMS (
        type: displayOnly
        label {
            label: Terms of Use
            alignment: left
        }
        settings {
            format: html
            sendOnPageSubmit: false
        }
        layout {
            sequence: 30
            region: @accept-service-terms
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--normalDisplay
            ]
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select service_terms
                  from qask_service_terms
                 where id = :P9995_TERMS_ID
                ```
            used: always
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P9995_TERMS_ID
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P9995_TERMS_ID (
        type: hidden
        layout {
            sequence: 20
            region: @accept-service-terms
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button accept (
        buttonName: ACCEPT
        label: Accept Terms
        layout {
            sequence: 40
            region: @accept-service-terms
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

    dynamicAction handle-submit-on-enter (
        name: Handle Submit on Enter
        execution {
            sequence: 10
        }
        when {
            event: keypress
            selectionType: items
            items: P9995_USERNAME
        }
        clientSideCondition {
            type: jsExpression
            javaScriptExpression: this.browserEvent.keyCode === 13
        }

        action native-cancel-event (
            action: cancelEvent
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-submit-page (
            action: submitPage
            settings {
                requestButtonName: SEND_TOKEN
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    computation p9995-terms-id (
        itemName: P9995_TERMS_ID
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: functionBody
            plsqlFunctionBody: return qask_util.get_latest_service_terms_id;
        }
    )

    process accept-terms (
        name: accept_terms
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                qask_util.log_service_terms_accept (
                    p_email             => :APP_USER,
                    p_accepted_terms_id => :P9995_TERMS_ID );
                ```
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Service Terms Accepted.
        }
        advanced {
            executionMappingIdentifier: 54889672743796248031
        }
        serverSideCondition {
            whenButtonPressed: @accept
            type: itemIsNotNull
            item: P9995_TERMS_ID
        }
    )

    branch (
        name: Go To Sessions
        execution {
            sequence: 20
        }
        behavior {
            target: {
                page: 100
                clearCache: 9995
            }
        }
        serverSideCondition {
            whenButtonPressed: @accept
        }
    )

)


````
