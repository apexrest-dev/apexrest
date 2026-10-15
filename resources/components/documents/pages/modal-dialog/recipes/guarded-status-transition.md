# Guarded status transition dialog

List page opening a modal dialog that moves one APEXREST_EXAMPLE_ROWS row from Open to Closed only after an explicit confirmation, through a package that matches the allowed source status and the loaded ROW_VERSION; a refused transition keeps the dialog open and closed rows show no action.

Status: ready.

Component: component:pages/modal-dialog.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/600ner70/PTW_LV/blob/904f0c7b95c8a4d8d4bc47c04fa53ee88a24e712/pages/p00017-cancel-permit.apx",
  "repository": "https://github.com/600ner70/PTW_LV",
  "commit": "904f0c7b95c8a4d8d4bc47c04fa53ee88a24e712",
  "path": "pages/p00017-cancel-permit.apx",
  "sourceSha256": "cd836108270e30a701756f937d924cd607a41f2d27225c13c03d4d7dedd66949",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "localDatabase/table read; transition through APEXREST_EXAMPLE_ROW_STATUS_API; optional declared fixture",
  "tables": [
    "APEXREST_EXAMPLE_ROWS"
  ],
  "packages": [
    "APEXREST_EXAMPLE_ROW_STATUS_API"
  ],
  "columns": [
    {
      "name": "ID",
      "type": "number"
    },
    {
      "name": "NAME",
      "type": "varchar2"
    },
    {
      "name": "STATUS",
      "type": "varchar2"
    },
    {
      "name": "ROW_VERSION",
      "type": "number"
    }
  ],
  "transition": "Open -> Closed; the update matches STATUS = 'Open' and the loaded ROW_VERSION, otherwise ORA-20003",
  "bindings": [
    "P2_ID",
    "P2_ROW_VERSION"
  ],
  "submittedItems": [
    "P2_CONFIRM"
  ],
  "writes": true,
  "prerequisites": [
    {
      "path": "prerequisites/example-rows.sql",
      "execution": "Not executed. Apply only to an explicitly authorized isolated development schema, or adapt to the existing project table/API."
    },
    {
      "path": "prerequisites/example-row-status-api.sql",
      "execution": "Not executed. Apply after example-rows.sql to the same authorized development schema, or map the process to the project's existing transition API."
    }
  ],
  "authorization": "Preserve application authentication and assign a project-specific authorization scheme to the dialog page and its action before deployment."
}
```

## Adaptation

- Choose free page numbers and rename all P1_ and P2_ items, links and button references consistently.
- Rename region, button and dynamic-action identifiers before merging into an existing application.
- Preserve the target application authentication and authorization; restrict who may perform the transition.
- Map the invokeApi process to the project's transition API; keep the allowed-source-status and ROW_VERSION guard in the database, not only in the page.
- Do not commit inside page processes or expose SQLERRM to users; let APEX commit the submit and show the API message.
- When adapting into an APEX 26.2 application, give each process a unique advanced.executionMappingIdentifier (for example page * 100 + n).
- Package errors are shown with their ORA-2000x prefix; register an application error-handling function if users should see only the message text.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Rows
    alias: HOME
    title: Rows
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region rows (
        name: Rows
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       NAME,
                       STATUS,
                       ROW_VERSION,
                       case when STATUS = 'Open'
                            then apex_page.get_url(p_page => 2, p_items => 'P2_ID', p_values => ID, p_clear_cache => '2')
                       end CLOSE_URL
                  from APEXREST_EXAMPLE_ROWS
                 order by NAME
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
            whenNoDataFound: No rows.
        }

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Name
            }
            layout {
                sequence: 20
            }
        )

        column STATUS (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Status
            }
            layout {
                sequence: 30
            }
        )

        column ROW_VERSION (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Version
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
        )

        // Only Open rows get the action, and closed rows render no empty link.
        // The dialog and the package still re-check the status because the
        // list can be stale.
        column CLOSE_URL (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Action
            }
            layout {
                sequence: 50
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {if ?CLOSE_URL/}<a href="#CLOSE_URL!ATTR#" aria-label="Close #NAME!ATTR#">Close</a>{endif/}
                    ```
            }
        )
    )

    dynamicAction refresh-rows (
        name: Refresh rows after the dialog closes
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
                region: @rows
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
)

```

## pages/p00002-close-row.apx

```apexlang
page 2 (
    name: Close row
    alias: CLOSE-ROW
    title: Close row
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

    region row-summary (
        name: Row
        type: staticContent
        source {
            htmlCode: <p>Closing is final in this example. Only an Open row at the version loaded here can be closed.</p>
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )

    region already-closed (
        name: Already closed
        type: staticContent
        source {
            htmlCode: <p>This row is no longer Open, so it cannot be closed again.</p>
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
            value: Open
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
            region: @row-summary
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P2_ROW_VERSION (
        type: hidden
        layout {
            sequence: 20
            region: @row-summary
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P2_NAME (
        type: displayOnly
        label {
            label: Name
            alignment: left
        }
        layout {
            sequence: 30
            region: @row-summary
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
            label: Current status
            alignment: left
        }
        layout {
            sequence: 40
            region: @row-summary
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    pageItem P2_CONFIRM (
        type: checkbox
        label {
            label: I confirm this row can be closed
            alignment: left
        }
        layout {
            sequence: 50
            region: @row-summary
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: item=value
            item: P2_STATUS
            value: Open
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

    button close-row (
        buttonName: CLOSE-ROW
        label: Close row
        layout {
            sequence: 20
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
            value: Open
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

    validation confirmation-required (
        name: Confirmation required
        execution {
            sequence: 10
        }
        validation {
            type: functionBodyReturningBoolean
            plsqlFunctionBody:
                ```plsql
                return :P2_CONFIRM = 'Y';
                ```
        }
        error {
            errorMessage: Confirm that this row can be closed.
            associatedItem: @P2_CONFIRM
        }
        serverSideCondition {
            whenButtonPressed: @close-row
        }
    )

    process load-row (
        name: Load row
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    select NAME, STATUS, ROW_VERSION
                      into :P2_NAME, :P2_STATUS, :P2_ROW_VERSION
                      from APEXREST_EXAMPLE_ROWS
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

    process close-row (
        name: Close row
        type: invokeApi
        invoke {
            package: APEXREST_EXAMPLE_ROW_STATUS_API
            procedureOrFunction: close_row
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
        parameter p_row_version (
            parameter {
                direction: in
                dataType: number
            }
            value {
                type: item
                item: P2_ROW_VERSION
            }
            advanced {
                displaySequence: 2
            }
        )
        execution {
            sequence: 20
        }
        serverSideCondition {
            whenButtonPressed: @close-row
        }
        successMessage {
            successMessage: Row closed.
        }
    )

    // Runs only after the transition succeeded; a validation or package error
    // stops processing first and keeps the dialog open with the message.
    process close-dialog (
        name: Close dialog
        type: closeDialog
        execution {
            sequence: 90
        }
        serverSideCondition {
            whenButtonPressed: @close-row
        }
    )
)

```

## prerequisites/example-rows.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply only to an explicitly authorized project schema; adapt existing data models instead of replacing them.
create table APEXREST_EXAMPLE_ROWS (
    ID number generated by default on null as identity primary key,
    NAME varchar2(200 char) not null,
    STATUS varchar2(20 char) default 'Open' not null,
    ROW_VERSION number default 1 not null,
    constraint APEXREST_EXAMPLE_ROWS_STATUS check (STATUS in ('Open', 'Closed'))
);
create or replace trigger APEXREST_EXAMPLE_ROWS_VERSION
before update on APEXREST_EXAMPLE_ROWS
for each row
begin
    :new.ROW_VERSION := :old.ROW_VERSION + 1;
end;
/

```

## prerequisites/example-row-status-api.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-rows.sql, only to an explicitly authorized project schema.
-- The package owns the Open -> Closed transition. It never commits; APEX commits the
-- page submit. The update matches both the allowed source status and the version the
-- page loaded, so a concurrent change or an already closed row updates nothing.
create or replace package APEXREST_EXAMPLE_ROW_STATUS_API authid definer as
    procedure close_row(
        p_id          in number,
        p_row_version in number);
end APEXREST_EXAMPLE_ROW_STATUS_API;
/
create or replace package body APEXREST_EXAMPLE_ROW_STATUS_API as
    procedure close_row(
        p_id          in number,
        p_row_version in number)
    is
    begin
        update APEXREST_EXAMPLE_ROWS
           set STATUS = 'Closed'
         where ID = p_id
           and STATUS = 'Open'
           and ROW_VERSION = p_row_version;
        if sql%rowcount = 0 then
            raise_application_error(-20003, 'This row can no longer be closed. It was already closed or changed by someone else. Reload and try again.');
        end if;
    end close_row;
end APEXREST_EXAMPLE_ROW_STATUS_API;
/

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2026 600ner70

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
    "sourceSha256": "84bb235e6b5c1dafa739aff215414b855dfade5430d58c10c2d537b74d9be8c9",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
