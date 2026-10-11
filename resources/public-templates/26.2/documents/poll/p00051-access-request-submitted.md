# Access Request Submitted — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00051-access-request-submitted.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0f9f09dae5a2c07154356ff0800183eebe1ca540a5caf06f94864e89bad738c6.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 51 (
    name: Access Request Submitted
    alias: ACCESS-REQUEST-SUBMITTED
    title: Access Request Submitted
    pageGroup: @request-access
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region hide-nobody (
        name: hide nobody
        type: staticContent
        source {
            htmlCode: "<style>.userBlock{display: none !important} .logoBarNav {padding-top: 8px;visibility: hidden;}</style>"
        }
        layout {
            sequence: 10
            slot: body
        }
        advanced {
            excludeTitleFromTranslation: true
        }
        serverSideCondition {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                if apex_authentication.is_authenticated then
                   return false;
                else
                   return true;
                end if;
                ```
        }
    )

    region your-request-for-access-has-been-submitted (
        name: Your request for access has been submitted
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Thank you for requesting access.</p>
                <ul>
                <li>You will receive an email with login credentials upon approval.
                <li>Email address: &P14_EMAIL_ADDRESS.
                </ul>
                ```
        }
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
            renderComponents: belowContent
        }
        headerAndFooter {
            headerText:
                ```html
                <center><img src="#IMAGE_PREFIX#themes/apps/icons/success_96.png" alt="Success!" /></center>
                <br clear="all">
                ```
        }
    )

)


````
