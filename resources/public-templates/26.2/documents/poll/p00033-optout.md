# Opt Out of Email — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00033-optout.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6ea3c1d65c53a60e7d5e5ca2ede900e7ba36e46dd78d0902ad9916ff4eb275c4.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 33 (
    name: Opt Out of Email
    alias: OPTOUT
    title: Opt Out of Email
    pageGroup: @opt-out
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            @media only screen and (max-width: 640px) {
            section.uRegion {
              width: auto !important;
            }
            }
            ```
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region hidden-items (
        name: Hidden Items
        type: staticContent
        layout {
            sequence: 10
            slot: body-3
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region hide-nobody (
        name: hide nobody
        type: staticContent
        source {
            htmlCode: "<style>.userBlock{display: none !important} .logoBarNav {padding-top: 8px;visibility: hidden;}</style>"
        }
        layout {
            sequence: 1
            slot: body-3
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

    region opt-in (
        name: Opt In
        type: staticContent
        source {
            htmlCode: <p>You have already opted out from receiving emails from &APPLICATION_TITLE.. If you would like to start receiving emails from &APPLICATION_TITLE. again, click the "Opt Back In" button below. Otherwise, click the "Cancel" button.</p>
        }
        layout {
            sequence: 30
            slot: body-3
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery:
                ```sql
                select null
                  from eba_qpoll_email_opt_out
                 where respondent_id = :P33_PERSON_ID;
                ```
        }
    )

    region opt-out (
        name: Opt Out
        type: staticContent
        source {
            htmlCode: <p>Clicking the "Opt Out" button below, will stop all &APPLICATION_TITLE. emails from being delivered to your email address. Click the "Cancel" button if you'd like to keep receiving emails from &APPLICATION_TITLE..</p>
        }
        layout {
            sequence: 20
            slot: body-3
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: noRowsReturned
            sqlQuery:
                ```sql
                select null
                  from eba_qpoll_email_opt_out
                 where respondent_id = :P33_PERSON_ID;
                ```
        }
    )

    pageItem P33_PERSON_ID (
        type: hidden
        layout {
            sequence: 10
            region: @hidden-items
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button opt-in (
        buttonName: OPT_IN
        label: Opt Back In
        layout {
            sequence: 30
            region: @opt-in
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery: select 1 from eba_qpoll_email_opt_out where respondent_id = :P33_PERSON_ID
        }
    )

    button opt-out (
        buttonName: OPT_OUT
        label: Opt Out
        layout {
            sequence: 40
            region: @opt-out
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: noRowsReturned
            sqlQuery: select 1 from eba_qpoll_email_opt_out where respondent_id = :P33_PERSON_ID
        }
    )

    process opt-in (
        name: Opt In
        type: executeCode
        source {
            plsqlCode: delete from eba_qpoll_email_opt_out where respondent_id = :P33_PERSON_ID;
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: You've successfully opted back in to receiving emails from &APPLICATION_TITLE..
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 13956675975854692675
        }
        serverSideCondition {
            whenButtonPressed: @opt-in
            type: itemIsNotNull
            item: P33_PERSON_ID
        }
    )

    process opt-out (
        name: Opt Out
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                insert into eba_qpoll_email_opt_out
                (respondent_id)
                values
                (:P33_PERSON_ID);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: You've successfully opted-out of receiving emails from &APPLICATION_TITLE..
        }
        error {
            errorMessage: #SQLERRM#
        }
        advanced {
            executionMappingIdentifier: 13956675767821692674
        }
        serverSideCondition {
            whenButtonPressed: @opt-out
            type: itemIsNotNull
            item: P33_PERSON_ID
        }
    )

    branch (
        name: out out confirmed
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 3
                clearCache: 33
                successMessage: false
            }
        }
        serverSideCondition {
            whenButtonPressed: @opt-out
        }
    )

)


````
