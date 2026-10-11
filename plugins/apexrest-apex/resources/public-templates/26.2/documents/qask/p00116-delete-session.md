# Delete Session — Qask

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/qask/apexlang/qask/pages/p00116-delete-session.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 5dd6af07731c0051028132c5409f0bd987c7da7da913a71a4111d3583ddb0de4.

Application dependency inventory: oracle:26.2:public-template/qask/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 116 (
    name: Delete Session
    alias: DELETE-SESSION
    title: Delete Session
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: @host
        deepLinking: false
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

    region p116-session-code-p116-session-name (
        name: &P116_SESSION_CODE. - &P116_SESSION_NAME.
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       OWNER,
                       SESSION_CODE,
                       initcap(session_status) status,
                       closed_on DATE_CLOSED,
                       CREATED_ON CREATED,
                       started_on,
                       CREATED_BY,
                       PURPOSE,
                       SESSION_NAME,
                       (select count(*) from qask_session_questions 
                         where session_id = s.id) question_count,
                       (select count(*) from qask_responses 
                         where session_id = s.id) response_count
                  from QASK_SESSIONS s
                 where id = :P116_SESSION_ID
                ```
            pageItemsToSubmit: P116_SESSION_ID
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--noBorder
                t-Region--scrollBody
            ]
        }
        componentAppearance {
            template: @/value-attribute-pairs-column
            templateOptions: [
                #DEFAULT#
                t-AVPList--leftAligned
            ]
        }
        pagination {
            type: showAll
        }

        column CREATED (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Created
            }
            layout {
                sequence: 120
            }
            appearance {
                formatMask: fmMonth fmDD, YYYY
            }
            serverSideCondition {
                type: rowsReturned
                sqlQuery:
                    ```sql
                    select 1
                      from qask_sessions
                     where id = :P116_SESSION_ID
                       and started_on is null
                    ```
            }
        )

        column CREATED_BY (
            reportColumnQueryId: 8
            derivedColumn: N
            type: hidden
            layout {
                sequence: 180
            }
        )

        column DATE_CLOSED (
            reportColumnQueryId: 5
            derivedColumn: N
            type: hidden
            layout {
                sequence: 150
            }
        )

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column OWNER (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Owner
            }
            layout {
                sequence: 20
            }
        )

        column PURPOSE (
            reportColumnQueryId: 9
            derivedColumn: N
            heading {
                heading: Purpose
            }
            layout {
                sequence: 60
            }
            serverSideCondition {
                type: rowsReturned
                sqlQuery:
                    ```sql
                    select 1
                      from qask_sessions
                     where id = :P116_SESSION_ID
                       and purpose is not null
                    ```
            }
        )

        column QUESTION_COUNT (
            reportColumnQueryId: 11
            derivedColumn: N
            heading {
                heading: Question Count
                alignment: end
            }
            layout {
                sequence: 210
                columnAlignment: end
            }
        )

        column RESPONSE_COUNT (
            reportColumnQueryId: 12
            derivedColumn: N
            heading {
                heading: Participant Count
                alignment: end
            }
            layout {
                sequence: 220
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            serverSideCondition {
                type: rowsReturned
                sqlQuery:
                    ```sql
                    select 1
                      from qask_responses
                     where session_id = :P116_SESSION_ID
                    ```
            }
        )

        column SESSION_CODE (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 30
            }
        )

        column SESSION_NAME (
            reportColumnQueryId: 10
            derivedColumn: N
            type: hidden
            layout {
                sequence: 40
            }
        )

        column STARTED_ON (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Started
            }
            layout {
                sequence: 130
            }
            appearance {
                formatMask: fmMonth fmDD, YYYY
            }
            serverSideCondition {
                type: rowsReturned
                sqlQuery:
                    ```sql
                    select 1
                      from qask_sessions
                     where id = :P116_SESSION_ID
                       and started_on is not null
                    ```
            }
        )

        column STATUS (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Status
            }
            layout {
                sequence: 100
            }
        )

    )

    pageItem P116_SESSION_CODE (
        type: hidden
        layout {
            sequence: 10
            region: @p116-session-code-p116-session-name
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P116_SESSION_ID (
        type: hidden
        layout {
            sequence: 10
            region: @p116-session-code-p116-session-name
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P116_SESSION_NAME (
        type: hidden
        layout {
            sequence: 10
            region: @p116-session-code-p116-session-name
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button cancel (
        buttonName: cancel
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
            action: definedByDynamicAction
            executeValidations: false
        }
    )

    button delete-session (
        buttonName: delete_session
        label: Delete
        layout {
            sequence: 20
            region: @buttons
            slot: next
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
            warnOnUnsavedChanges: doNotCheck
            requiresConfirmation: true
        }
        confirmation {
            message: Are you sure you want to delete this session?
        }
        security {
            authorizationScheme: @host
        }
    )

    dynamicAction cancel (
        name: Cancel
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    computation p116-session-code (
        itemName: P116_SESSION_CODE
        execution {
            sequence: 10
            point: afterHeader
        }
        computation {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                return qask_util.get_session_code (
                    p_session_id => :P116_SESSION_ID );
                ```
        }
    )

    computation p116-session-name (
        itemName: P116_SESSION_NAME
        execution {
            sequence: 20
            point: afterHeader
        }
        computation {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                return qask_util.get_session_name (
                    p_session_id => :P116_SESSION_ID );
                ```
        }
    )

    process delete-session (
        name: delete session
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                qask_util.delete_session (
                    p_session_id => :P116_SESSION_ID );
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Session deleted.
        }
        error {
            errorMessage: Session failed to be deleted.
        }
        advanced {
            executionMappingIdentifier: 52446178140866674948
        }
        serverSideCondition {
            whenButtonPressed: @delete-session
        }
    )

    branch (
        name: after delete
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 100
                clearCache: 116
            }
        }
        serverSideCondition {
            whenButtonPressed: @delete-session
        }
    )

)


````
