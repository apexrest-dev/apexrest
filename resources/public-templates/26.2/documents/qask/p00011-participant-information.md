# Participant Information — Qask

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/qask/apexlang/qask/pages/p00011-participant-information.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 654ed6f2706ddb7ec3dfbbae8eca33fb5b31bdd3627c003f6a7dd7f6e46a988d.

Application dependency inventory: oracle:26.2:public-template/qask/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Participant Information
    alias: PARTICIPANT-INFORMATION
    title: Participant Information
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
    }
    css {
        inline:
            ```css
            .apex-item-text {
                --a-field-input-font-size: 2rem;
                --a-field-input-line-height: 4rem;
            }
            .t-Form-itemWrapper {
                justify-content: center;
            }
            
            .t-Alert--wizard .t-Alert-buttons {
                margin-block-start: 0.5rem;
            }
            
            .t-Button--large {
                --a-button-font-size: 1rem;
            }
            
            ```
    }
    security {
        authentication: public
        deepLinking: true
        pageAccessProtection: noArgumentsSupported
    }

    region welcome-to-qask (
        name: Welcome to qAsk
        type: staticContent
        source {
            htmlCode: Enter details requested for this Session
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--customIcons
                t-Alert--info
                t-Form--noPadding
            ]
            cssClasses: u-tC
            icon: app-icon
            renderComponents: belowContent
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P11_EMAIL (
        type: textField
        label {
            label: Your Email
            alignment: left
        }
        layout {
            sequence: 30
            region: @welcome-to-qask
            slot: regionBody
            alignment: left
            labelColumnSpan: 0
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                margin-top-md
            ]
            width: 30
            valuePlaceholder: Your Email
        }
        serverSideCondition {
            type: expression
            plsqlExpression: qask_util.session_resp_email_req_yn(p_session_id => :SESSION_ID) = 'Y'
        }
        security {
            sessionStateProtection: restricted
            restrictedChars: noSpecialCharNoNewline
        }
    )

    pageItem P11_NAME (
        type: textField
        label {
            label: Your Name
            alignment: left
        }
        layout {
            sequence: 20
            region: @welcome-to-qask
            slot: regionBody
            alignment: left
            labelColumnSpan: 0
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--large
                margin-top-md
            ]
            width: 30
            valuePlaceholder: Your Name
        }
        advanced {
            cssClasses: [
                u-tC
                w320
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression: qask_util.session_resp_name_req_yn(p_session_id => :SESSION_ID) = 'Y'
        }
        security {
            sessionStateProtection: restricted
            restrictedChars: noSpecialCharNoNewline
        }
    )

    button join (
        buttonName: Join
        label: Join
        layout {
            sequence: 40
            region: @welcome-to-qask
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
            cssClasses: [
                w260
                margin-auto
                padding-md
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    validation email-required (
        name: email required
        execution {
            sequence: 30
        }
        validation {
            type: functionBodyReturningBoolean
            plsqlFunctionBody:
                ```plsql
                if :P11_EMAIL is not null then
                   return true;
                else
                   return false;
                end if;
                ```
        }
        error {
            errorMessage: Email is required
            associatedItem: @P11_EMAIL
        }
        serverSideCondition {
            whenButtonPressed: @join
            type: expression
            plsqlExpression: qask_util.session_resp_email_req_yn (p_session_id => :SESSION_ID) = 'Y'
        }
    )

    validation email-valid (
        name: email valid
        execution {
            sequence: 40
        }
        validation {
            type: itemMatchesRegexp
            item: P11_EMAIL
            regexp: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}"
        }
        error {
            errorMessage: Email is not valid
            associatedItem: @P11_EMAIL
        }
        serverSideCondition {
            whenButtonPressed: @join
            type: expression
            plsqlExpression: qask_util.session_resp_email_req_yn (p_session_id => :SESSION_ID) = 'Y'
        }
    )

    validation name-required (
        name: name required
        execution {
            sequence: 20
        }
        validation {
            type: functionBodyReturningBoolean
            plsqlFunctionBody:
                ```plsql
                if :P11_NAME is not null then
                   return true;
                else
                   return false;
                end if;
                ```
        }
        error {
            errorMessage: Name is required
            associatedItem: @P11_NAME
        }
        serverSideCondition {
            whenButtonPressed: @join
            type: expression
            plsqlExpression: qask_util.session_resp_name_req_yn (p_session_id => :SESSION_ID) = 'Y'
        }
    )

    branch (
        name: show question
        execution {
            sequence: 20
        }
        behavior {
            target: {
                page: 20
                clearCache: 20
                action: resetRegions
            }
        }
    )

)


````
