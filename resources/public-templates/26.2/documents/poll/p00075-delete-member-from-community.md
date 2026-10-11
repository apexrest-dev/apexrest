# Delete Member from Community — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00075-delete-member-from-community.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fb27b09224a76e4609e4f0625a6d5aab741999f1210f7837a9dfc0bce72655fe.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 75 (
    name: Delete Member from Community
    alias: DELETE-MEMBER-FROM-COMMUNITY
    title: Delete Member from Community
    pageGroup: @communities
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
        warnOnUnsavedChanges: false
    }
    javaScript {
        functionAndGlobalVariableDeclaration: var htmldb_delete_message='"DELETE_CONFIRM_MSG"';
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region buttons (
        name: buttons
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    region community-member (
        name: Community Member
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--noBorder
                t-Region--scrollBody
            ]
        }
    )

    pageItem P75_COMMUNITY_ID (
        type: hidden
        layout {
            sequence: 30
            region: @community-member
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: COMMUNITY_ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P75_COMMUNITY_NAME (
        type: displayOnly
        label {
            label: Community
            alignment: left
        }
        settings {
            sendOnPageSubmit: false
        }
        layout {
            sequence: 35
            region: @community-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select name from EBA_QPOLL_RESP_COMMUNITIES
                 where id = :P75_COMMUNITY_ID
                ```
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P75_ID (
        type: hidden
        layout {
            sequence: 10
            region: @community-member
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P75_MEMBER_NAME (
        type: displayOnly
        label {
            label: Member
            alignment: left
        }
        settings {
            sendOnPageSubmit: false
        }
        layout {
            sequence: 36
            region: @community-member
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select email from eba_qpoll_respondents
                 where id = :P75_RESPONDENT_ID
                ```
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P75_RESPONDENT_ID (
        type: hidden
        layout {
            sequence: 20
            region: @community-member
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: RESPONDENT_ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 74
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button delete (
        buttonName: DELETE
        label: Remove Member
        layout {
            sequence: 20
            region: @buttons
            slot: delete
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--danger
                t-Button--simple
            ]
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.confirm(htmldb_delete_message,'DELETE');
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
            databaseAction: delete
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P75_ID
        }
    )

    process fetch-row-from-eba-qpoll-resp-comm-ref (
        name: Fetch Row from EBA_QPOLL_RESP_COMM_REF
        type: autoRowFetch
        source {
            tableName: EBA_QPOLL_RESP_COMM_REF
            pkColumn: ID
            pkItem: P75_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 13930231164783031194
        }
    )

    process process-row-of-eba-qpoll-resp-comm-ref (
        name: Process Row of EBA_QPOLL_RESP_COMM_REF
        type: autoRowProcessing
        target {
            tableName: EBA_QPOLL_RESP_COMM_REF
            pkColumn: ID
            pkItem: P75_ID
            supportedOperations: delete
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 13930231372895031196
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 13930231592770031196
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    branch (
        execution {
            sequence: 1
        }
        behavior {
            target: {
                page: 74
            }
        }
    )

)


````
