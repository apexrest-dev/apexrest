# Approval workflow with named transitions

Request list with status badges opening a modal dialog that approves or rejects one REQUESTED request through named package verbs that lock the row and check the legal source status; reject requires a reason and a danger confirmation, decided requests show no action and a refused decision keeps the dialog open.

Status: ready.

Component: component:pages/modal-dialog.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/Pp-py/apexlang-skills/blob/1950b914cfc778623e655390455d78efed834751/skills/apexlang-architecture/examples/absences-workflow/04-page-absence-resolve.apx",
  "repository": "https://github.com/Pp-py/apexlang-skills",
  "commit": "1950b914cfc778623e655390455d78efed834751",
  "path": "skills/apexlang-architecture/examples/absences-workflow/04-page-absence-resolve.apx",
  "sourceSha256": "a6f119fe4d86865eda7940603e7bdf180367a76f7177733dba5c88de43b09f71",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "localDatabase/table read; transitions through APEXREST_EXAMPLE_REQUEST_FLOW_API; optional declared fixture",
  "tables": [
    "APEXREST_EXAMPLE_REQUESTS"
  ],
  "packages": [
    "APEXREST_EXAMPLE_REQUEST_FLOW_API"
  ],
  "columns": [
    {
      "name": "ID",
      "type": "number"
    },
    {
      "name": "REQUESTER",
      "type": "varchar2"
    },
    {
      "name": "REQUEST_TYPE",
      "type": "varchar2"
    },
    {
      "name": "DATE_FROM",
      "type": "date"
    },
    {
      "name": "DATE_TO",
      "type": "date"
    },
    {
      "name": "STATUS",
      "type": "varchar2"
    },
    {
      "name": "REJECTION_REASON",
      "type": "varchar2"
    },
    {
      "name": "DECIDED_BY",
      "type": "varchar2"
    },
    {
      "name": "DECIDED_AT",
      "type": "timestamp"
    }
  ],
  "transitions": "REQUESTED -> APPROVED (approve), REQUESTED -> REJECTED (reject, reason required); each verb locks the row with FOR UPDATE and raises ORA-20004..20006 otherwise",
  "bindings": [
    "P2_ID",
    "APP_USER"
  ],
  "submittedItems": [
    "P2_REASON"
  ],
  "writes": true,
  "prerequisites": [
    {
      "path": "prerequisites/example-requests.sql",
      "execution": "Not executed. Creates and seeds APEXREST_EXAMPLE_REQUESTS; apply only to an explicitly authorized isolated development schema, or adapt to the existing project table."
    },
    {
      "path": "prerequisites/example-request-flow-api.sql",
      "execution": "Not executed. Apply after example-requests.sql to the same authorized development schema, or map the processes to the project's existing transition API."
    }
  ],
  "authorization": "Preserve application authentication; restrict the dialog page and the Approve/Reject buttons and processes to an approver authorization scheme before deployment."
}
```

## Adaptation

- Choose free page numbers and rename all P1_ and P2_ items, URLs and button references consistently.
- Rename region, button and dynamic-action identifiers before merging into an existing application.
- Preserve the target application authentication and add an approver authorization scheme to the dialog, both decision buttons and both processes.
- Map the invokeApi processes to the project's transition verbs; keep the legal-source-status check and row lock in the database, never set STATUS directly from the page.
- When adapting into an APEX 26.2 application, give each process a unique advanced.executionMappingIdentifier (for example page * 100 + n).
- Package errors are shown with their ORA-2000x prefix; register an application error-handling function if users should see only the message text.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Requests
    alias: HOME
    title: Requests
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region requests (
        name: Requests
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       REQUESTER,
                       REQUEST_TYPE,
                       to_char(DATE_FROM, 'YYYY-MM-DD') || ' - ' || to_char(DATE_TO, 'YYYY-MM-DD') PERIOD,
                       STATUS,
                       DECIDED_BY,
                       case when STATUS = 'REQUESTED'
                            then apex_page.get_url(p_page => 2, p_items => 'P2_ID', p_values => ID, p_clear_cache => '2')
                       end RESOLVE_URL
                  from APEXREST_EXAMPLE_REQUESTS
                 order by case STATUS when 'REQUESTED' then 0 else 1 end, DATE_FROM
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }
        messages {
            whenNoDataFound: No requests.
        }

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column REQUESTER (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Requester
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

        column REQUEST_TYPE (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Type
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column PERIOD (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Period
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )

        column STATUS (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Status
            }
            layout {
                sequence: 50
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {case STATUS/}{when APPROVED/}<span class="t-Badge u-success">Approved</span>{when REJECTED/}<span class="t-Badge u-danger">Rejected</span>{otherwise/}<span class="t-Badge u-warning">Requested</span>{endcase/}
                    ```
            }
            sorting {
                sortable: false
            }
        )

        column DECIDED_BY (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Decided by
            }
            layout {
                sequence: 60
            }
            sorting {
                sortable: false
            }
        )

        column RESOLVE_URL (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Action
            }
            layout {
                sequence: 70
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {if ?RESOLVE_URL/}<a href="#RESOLVE_URL!ATTR#" aria-label="Resolve request from #REQUESTER!ATTR#">Resolve</a>{endif/}
                    ```
            }
            sorting {
                sortable: false
            }
        )
    )

    dynamicAction refresh-requests (
        name: Refresh requests after the dialog closes
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: jsExpression
            javaScriptExpression: window
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @requests
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
)

```

## pages/p00002-resolve-request.apx

```apexlang
page 2 (
    name: Resolve request
    alias: RESOLVE-REQUEST
    title: Resolve request
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        chained: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region request (
        name: Request
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )

    region already-decided (
        name: Already decided
        type: staticContent
        source {
            htmlCode: <p>This request is no longer waiting for a decision.</p>
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--warning
            ]
        }
        serverSideCondition {
            type: item!=value
            item: P2_STATUS
            value: REQUESTED
        }
    )

    region dialog-buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 30
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
    )

    pageItem P2_ID (
        type: hidden
        layout {
            sequence: 10
            region: @request
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P2_REQUESTER (
        type: displayOnly
        label {
            label: Requester
            alignment: left
        }
        layout {
            sequence: 20
            region: @request
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    pageItem P2_REQUEST_TYPE (
        type: displayOnly
        label {
            label: Type
            alignment: left
        }
        layout {
            sequence: 30
            region: @request
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    pageItem P2_PERIOD (
        type: displayOnly
        label {
            label: Period
            alignment: left
        }
        layout {
            sequence: 40
            region: @request
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    pageItem P2_STATUS (
        type: displayOnly
        label {
            label: Status
            alignment: left
        }
        layout {
            sequence: 50
            region: @request
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    pageItem P2_REASON (
        type: textarea
        label {
            label: Rejection reason
            alignment: left
        }
        layout {
            sequence: 60
            region: @request
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        validation {
            maxLength: 400
        }
        help {
            inlineHelpText: Required when rejecting; stored with the request.
        }
        serverSideCondition {
            type: item=value
            item: P2_STATUS
            value: REQUESTED
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @dialog-buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button reject (
        buttonName: REJECT
        label: Reject
        layout {
            sequence: 20
            region: @dialog-buttons
            slot: delete
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            requiresConfirmation: true
        }
        confirmation {
            message: Reject this request? The decision cannot be undone.
            style: danger
        }
        serverSideCondition {
            type: item=value
            item: P2_STATUS
            value: REQUESTED
        }
    )

    button approve (
        buttonName: APPROVE
        label: Approve
        layout {
            sequence: 30
            region: @dialog-buttons
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
        serverSideCondition {
            type: item=value
            item: P2_STATUS
            value: REQUESTED
        }
    )

    dynamicAction cancel-dialog (
        name: Cancel dialog
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

    validation reject-reason-required (
        name: Reason required when rejecting
        execution {
            sequence: 10
        }
        validation {
            type: itemIsNotNull
            item: P2_REASON
        }
        error {
            errorMessage: Enter the rejection reason.
            associatedItem: @P2_REASON
        }
        serverSideCondition {
            whenButtonPressed: @reject
        }
    )

    process load-request (
        name: Load request
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    select REQUESTER,
                           REQUEST_TYPE,
                           to_char(DATE_FROM, 'YYYY-MM-DD') || ' - ' || to_char(DATE_TO, 'YYYY-MM-DD'),
                           STATUS
                      into :P2_REQUESTER, :P2_REQUEST_TYPE, :P2_PERIOD, :P2_STATUS
                      from APEXREST_EXAMPLE_REQUESTS
                     where ID = :P2_ID;
                end;
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P2_ID
        }
    )

    process approve-request (
        name: Approve request
        type: invokeApi
        invoke {
            package: APEXREST_EXAMPLE_REQUEST_FLOW_API
            procedureOrFunction: approve
        }
        parameter p_id (
            parameter {
                direction: in
                dataType: number
            }
            value {
                type: item
                item: P2_ID
            }
            advanced {
                displaySequence: 1
            }
        )
        parameter p_decided_by (
            parameter {
                direction: in
                dataType: varchar2
            }
            value {
                type: expression
                plsqlExpression: :APP_USER
            }
            advanced {
                displaySequence: 2
            }
        )
        execution {
            sequence: 20
        }
        serverSideCondition {
            whenButtonPressed: @approve
        }
        successMessage {
            successMessage: Request approved.
        }
    )

    process reject-request (
        name: Reject request
        type: invokeApi
        invoke {
            package: APEXREST_EXAMPLE_REQUEST_FLOW_API
            procedureOrFunction: reject
        }
        parameter p_id (
            parameter {
                direction: in
                dataType: number
            }
            value {
                type: item
                item: P2_ID
            }
            advanced {
                displaySequence: 1
            }
        )
        parameter p_reason (
            parameter {
                direction: in
                dataType: varchar2
            }
            value {
                type: item
                item: P2_REASON
            }
            advanced {
                displaySequence: 2
            }
        )
        parameter p_decided_by (
            parameter {
                direction: in
                dataType: varchar2
            }
            value {
                type: expression
                plsqlExpression: :APP_USER
            }
            advanced {
                displaySequence: 3
            }
        )
        execution {
            sequence: 30
        }
        serverSideCondition {
            whenButtonPressed: @reject
        }
        successMessage {
            successMessage: Request rejected.
        }
    )

    // Runs only after a successful decision; a validation or guard error stops
    // processing first and keeps the dialog open with the message.
    process close-dialog (
        name: Close dialog
        type: closeDialog
        execution {
            sequence: 90
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: APPROVE,REJECT
        }
    )
)

```

## prerequisites/example-requests.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply only to an explicitly authorized project schema; adapt existing data models instead of replacing them.
-- Requests move REQUESTED -> APPROVED or REQUESTED -> REJECTED; the UI never sets STATUS directly.
create table APEXREST_EXAMPLE_REQUESTS (
    ID number generated by default on null as identity primary key,
    REQUESTER varchar2(60 char) not null,
    REQUEST_TYPE varchar2(30 char) not null,
    DATE_FROM date not null,
    DATE_TO date not null,
    STATUS varchar2(20 char) default 'REQUESTED' not null,
    REJECTION_REASON varchar2(400 char),
    DECIDED_BY varchar2(255 char),
    DECIDED_AT timestamp,
    constraint APEXREST_EXAMPLE_REQUESTS_STATUS check (STATUS in ('REQUESTED', 'APPROVED', 'REJECTED')),
    constraint APEXREST_EXAMPLE_REQUESTS_DATES check (DATE_TO >= DATE_FROM)
);
insert into APEXREST_EXAMPLE_REQUESTS (REQUESTER, REQUEST_TYPE, DATE_FROM, DATE_TO)
values ('Ana', 'Vacation', date '2026-07-01', date '2026-07-10');
insert into APEXREST_EXAMPLE_REQUESTS (REQUESTER, REQUEST_TYPE, DATE_FROM, DATE_TO)
values ('Ben', 'Training', date '2026-08-03', date '2026-08-04');
insert into APEXREST_EXAMPLE_REQUESTS (REQUESTER, REQUEST_TYPE, DATE_FROM, DATE_TO, STATUS, DECIDED_BY, DECIDED_AT)
values ('Cleo', 'Sick leave', date '2026-06-20', date '2026-06-22', 'APPROVED', 'ADMIN', systimestamp);
commit;

```

## prerequisites/example-request-flow-api.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-requests.sql, only to an explicitly authorized project schema.
-- Each transition is a named verb that locks the row and checks its legal source status.
-- The package never commits; APEX commits the page submit.
create or replace package APEXREST_EXAMPLE_REQUEST_FLOW_API authid definer as
    procedure approve(
        p_id         in number,
        p_decided_by in varchar2);

    procedure reject(
        p_id         in number,
        p_reason     in varchar2,
        p_decided_by in varchar2);
end APEXREST_EXAMPLE_REQUEST_FLOW_API;
/
create or replace package body APEXREST_EXAMPLE_REQUEST_FLOW_API as
    function locked_status(p_id in number) return varchar2
    is
        l_status APEXREST_EXAMPLE_REQUESTS.STATUS%type;
    begin
        select STATUS
          into l_status
          from APEXREST_EXAMPLE_REQUESTS
         where ID = p_id
           for update;
        return l_status;
    exception
        when no_data_found then
            raise_application_error(-20004, 'The request no longer exists.');
    end locked_status;

    procedure approve(
        p_id         in number,
        p_decided_by in varchar2)
    is
    begin
        if locked_status(p_id) <> 'REQUESTED' then
            raise_application_error(-20005, 'Only a request in REQUESTED status can be approved.');
        end if;
        update APEXREST_EXAMPLE_REQUESTS
           set STATUS = 'APPROVED',
               REJECTION_REASON = null,
               DECIDED_BY = p_decided_by,
               DECIDED_AT = systimestamp
         where ID = p_id;
    end approve;

    procedure reject(
        p_id         in number,
        p_reason     in varchar2,
        p_decided_by in varchar2)
    is
    begin
        if locked_status(p_id) <> 'REQUESTED' then
            raise_application_error(-20005, 'Only a request in REQUESTED status can be rejected.');
        end if;
        if trim(p_reason) is null then
            raise_application_error(-20006, 'A rejection reason is required.');
        end if;
        update APEXREST_EXAMPLE_REQUESTS
           set STATUS = 'REJECTED',
               REJECTION_REASON = trim(p_reason),
               DECIDED_BY = p_decided_by,
               DECIDED_AT = systimestamp
         where ID = p_id;
    end reject;
end APEXREST_EXAMPLE_REQUEST_FLOW_API;
/

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2026 Pablo Portillo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "b6fefe69af3a00d9a6b77c0ed0da6759009736ac7a54bd34bf01ac975d3be430",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
