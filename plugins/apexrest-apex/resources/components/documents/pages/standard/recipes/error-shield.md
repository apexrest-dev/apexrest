# Error handling function with incident references

Page-level APEX error handling function that shows raise_application_error texts without the ORA prefix, maps named constraints to friendly messages and replaces unexpected technical errors with a generic message and a reference code; incidents are grouped by fingerprint and searchable by that code on a second page.

Status: ready.

Component: component:pages/standard.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/Aftorres02/OracleAPEX-ErrorShield/blob/71232a717ce6679d6fb843ed2647e194c8f3a54c/packages/ersh_error_handler_api.pkb",
  "repository": "https://github.com/Aftorres02/OracleAPEX-ErrorShield",
  "commit": "71232a717ce6679d6fb843ed2647e194c8f3a54c",
  "path": "packages/ersh_error_handler_api.pkb",
  "sourceSha256": "7dcc7ccdbce2a7d789dc7fea13f543ce38bfd725758787749073e1c695461b97",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "APEX error handling function APEXREST_EXAMPLE_ERROR_API.HANDLE_ERROR; incidents read from APEXREST_EXAMPLE_INCIDENTS; optional declared fixture",
  "tables": [
    "APEXREST_EXAMPLE_INCIDENTS",
    "APEXREST_EXAMPLE_CONSTRAINT_MESSAGES",
    "APEXREST_EXAMPLE_UNIQUE_CODES"
  ],
  "packages": [
    "APEXREST_EXAMPLE_ERROR_API"
  ],
  "errorHandling": "Page attribute errorHandling.errorHandlingFunctionName on page 1; incidents are written in an autonomous transaction and the function never raises",
  "bindings": [
    "P2_REFERENCE",
    "APP_ID",
    "APP_PAGE_ID",
    "APP_USER",
    "REQUEST"
  ],
  "submittedItems": [
    "P2_REFERENCE"
  ],
  "writes": true,
  "prerequisites": [
    {
      "path": "prerequisites/example-error-shield.sql",
      "execution": "Not executed. Creates the incident, constraint-message and demo tables; apply only to an explicitly authorized isolated development schema, or adapt to the project's logging model."
    },
    {
      "path": "prerequisites/example-error-api.sql",
      "execution": "Not executed. Apply after example-error-shield.sql to the same authorized development schema."
    }
  ],
  "authorization": "Incident details can contain internal error text; restrict the incidents page to support or administrator users. Preserve application authentication."
}
```

## Adaptation

- Choose free page numbers and rename all P2_ items consistently.
- Rename region, button and dynamic-action identifiers before merging into an existing application.
- Preserve the target application authentication and restrict the incidents page to support or administrator users.
- Once accepted, set the function on the application (Shared Components > Security > Error Handling) instead of individual pages, and remove the demo buttons and processes.
- Add rows to APEXREST_EXAMPLE_CONSTRAINT_MESSAGES (or the project's equivalent) for each named constraint users can hit; unknown constraints are masked with a reference code.
- Scrub or shorten stored error text if it can contain personal data, and purge old incidents on a schedule.
- When adapting into an APEX 26.2 application, give each process a unique advanced.executionMappingIdentifier (for example page * 100 + n).

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Error handling
    alias: HOME
    title: Error handling
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    // Page-level error handling function; set it on the application instead
    // to cover every page once the behavior is accepted.
    errorHandling {
        errorHandlingFunctionName: APEXREST_EXAMPLE_ERROR_API.HANDLE_ERROR
    }

    region scenarios (
        name: Error scenarios
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Each button raises one kind of error. A business rule shows its own text, a known constraint shows a friendly text, and an unexpected technical error is replaced by a generic message with a reference code that support can look up on the incidents page.</p>
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
    )

    button business-error (
        buttonName: BUSINESS_ERROR
        label: Business rule
        layout {
            sequence: 10
            region: @scenarios
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button duplicate-code (
        buttonName: DUPLICATE_CODE
        label: Duplicate code
        layout {
            sequence: 20
            region: @scenarios
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button unexpected-error (
        buttonName: UNEXPECTED_ERROR
        label: Unexpected error
        layout {
            sequence: 30
            region: @scenarios
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
            hot: true
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process raise-business-error (
        name: Raise business error
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    raise_application_error(-20010, 'Orders cannot be submitted after the monthly close.');
                end;
                ```
        }
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @business-error
        }
    )

    process insert-duplicate-code (
        name: Insert duplicate code
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    insert into APEXREST_EXAMPLE_UNIQUE_CODES (CODE) values ('A-100');
                end;
                ```
        }
        execution {
            sequence: 20
        }
        serverSideCondition {
            whenButtonPressed: @duplicate-code
        }
    )

    process raise-unexpected-error (
        name: Raise unexpected error
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                    l_divisor number := 0;
                    l_result  number;
                begin
                    l_result := 1 / l_divisor;
                end;
                ```
        }
        execution {
            sequence: 30
        }
        serverSideCondition {
            whenButtonPressed: @unexpected-error
        }
    )
)

```

## pages/p00002-incidents.apx

```apexlang
page 2 (
    name: Incidents
    alias: INCIDENTS
    title: Incidents
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region search (
        name: Find an incident
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )

    region incidents (
        name: Incidents
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select REFERENCE_CODE,
                       to_char(LAST_SEEN_AT, 'YYYY-MM-DD HH24:MI:SS') LAST_SEEN,
                       OCCURRENCE_COUNT,
                       PAGE_ID,
                       APP_USER,
                       ORA_SQLCODE,
                       COMPONENT_TYPE || ' ' || COMPONENT_NAME COMPONENT,
                       ERROR_MESSAGE
                  from APEXREST_EXAMPLE_INCIDENTS
                 where :P2_REFERENCE is null
                    or REFERENCE_CODE = upper(trim(:P2_REFERENCE))
                 order by LAST_SEEN_AT desc
                ```
            pageItemsToSubmit: P2_REFERENCE
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
            whenNoDataFound: No incidents match this reference.
        }

        column REFERENCE_CODE (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Reference
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
        )

        column LAST_SEEN (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Last seen
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

        column OCCURRENCE_COUNT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Occurrences
                alignment: end
            }
            layout {
                sequence: 30
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column PAGE_ID (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Page
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column APP_USER (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: User
            }
            layout {
                sequence: 50
            }
            sorting {
                sortable: false
            }
        )

        column ORA_SQLCODE (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: ORA code
                alignment: end
            }
            layout {
                sequence: 60
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column COMPONENT (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Component
            }
            layout {
                sequence: 70
            }
            sorting {
                sortable: false
            }
        )

        column ERROR_MESSAGE (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Internal detail
            }
            layout {
                sequence: 80
            }
            sorting {
                sortable: false
            }
        )
    )

    pageItem P2_REFERENCE (
        type: textField
        label {
            label: Reference code
            alignment: left
        }
        layout {
            sequence: 10
            region: @search
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        validation {
            maxLength: 12
        }
        help {
            inlineHelpText: Paste the code a user reported, for example ERR-1A2B3C4D.
        }
    )

    dynamicAction refresh-incidents (
        name: Refresh incidents after the reference changes
        execution {
            sequence: 10
        }
        when {
            event: change
            selectionType: items
            items: P2_REFERENCE
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @incidents
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
)

```

## prerequisites/example-error-shield.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply only to an explicitly authorized project schema; adapt an existing logging model instead of replacing it.
-- Incidents group identical failures by fingerprint, so one reference code names one root cause.
create table APEXREST_EXAMPLE_INCIDENTS (
    ID number generated by default on null as identity primary key,
    REFERENCE_CODE varchar2(12 char) not null,
    FINGERPRINT varchar2(64 char) not null,
    APPLICATION_ID number,
    PAGE_ID number,
    APP_USER varchar2(255 char),
    REQUEST varchar2(255 char),
    COMPONENT_TYPE varchar2(255 char),
    COMPONENT_NAME varchar2(255 char),
    ORA_SQLCODE number,
    ERROR_MESSAGE varchar2(4000 char),
    OCCURRENCE_COUNT number default 1 not null,
    FIRST_SEEN_AT timestamp default systimestamp not null,
    LAST_SEEN_AT timestamp default systimestamp not null,
    constraint APEXREST_EXAMPLE_INCIDENTS_FP unique (FINGERPRINT),
    constraint APEXREST_EXAMPLE_INCIDENTS_REF unique (REFERENCE_CODE)
);

-- Friendly texts for named constraints; a constraint without a row keeps the default handling.
create table APEXREST_EXAMPLE_CONSTRAINT_MESSAGES (
    CONSTRAINT_NAME varchar2(128 char) primary key,
    MESSAGE varchar2(4000 char) not null
);

-- Demo table whose unique constraint has a friendly message.
create table APEXREST_EXAMPLE_UNIQUE_CODES (
    CODE varchar2(20 char) not null,
    constraint APEXREST_EXAMPLE_UNIQUE_CODES_UK unique (CODE)
);

insert into APEXREST_EXAMPLE_CONSTRAINT_MESSAGES (CONSTRAINT_NAME, MESSAGE)
values ('APEXREST_EXAMPLE_UNIQUE_CODES_UK', 'This code is already in use. Choose another code.');
insert into APEXREST_EXAMPLE_UNIQUE_CODES (CODE) values ('A-100');
commit;

```

## prerequisites/example-error-api.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-error-shield.sql, only to an explicitly authorized project schema.
-- handle_error is an APEX error handling function: it must never raise, it shows
-- raise_application_error texts without the ORA prefix, maps known constraints and
-- replaces every unexpected technical error with a generic message and a reference code.
create or replace package APEXREST_EXAMPLE_ERROR_API authid definer as
    function handle_error(p_error in apex_error.t_error) return apex_error.t_error_result;
end APEXREST_EXAMPLE_ERROR_API;
/
create or replace package body APEXREST_EXAMPLE_ERROR_API as
    c_generic constant varchar2(200) :=
        'An unexpected error occurred. Contact support and quote reference ';

    -- Records the incident in its own transaction so the user's rolled-back work
    -- does not remove it. Returns the stable reference code of the root cause.
    function record_incident(p_error in apex_error.t_error) return varchar2
    is
        pragma autonomous_transaction;
        l_fingerprint APEXREST_EXAMPLE_INCIDENTS.FINGERPRINT%type;
        l_reference   APEXREST_EXAMPLE_INCIDENTS.REFERENCE_CODE%type;
    begin
        select rawtohex(standard_hash(
                   v('APP_ID') || '|' || v('APP_PAGE_ID') || '|' || p_error.ora_sqlcode || '|'
                   || substr(p_error.message, 1, 200), 'SHA256'))
          into l_fingerprint
          from dual;
        l_reference := 'ERR-' || substr(l_fingerprint, 1, 8);

        merge into APEXREST_EXAMPLE_INCIDENTS t
        using (select l_fingerprint FINGERPRINT from dual) s
           on (t.FINGERPRINT = s.FINGERPRINT)
         when matched then update
              set t.OCCURRENCE_COUNT = t.OCCURRENCE_COUNT + 1,
                  t.LAST_SEEN_AT = systimestamp,
                  t.APP_USER = v('APP_USER')
         when not matched then insert (
              REFERENCE_CODE, FINGERPRINT, APPLICATION_ID, PAGE_ID, APP_USER, REQUEST,
              COMPONENT_TYPE, COMPONENT_NAME, ORA_SQLCODE, ERROR_MESSAGE)
              values (
              l_reference, l_fingerprint, v('APP_ID'), v('APP_PAGE_ID'), v('APP_USER'), v('REQUEST'),
              p_error.component.type, p_error.component.name, p_error.ora_sqlcode,
              substr(p_error.message
                     || case when p_error.additional_info is not null
                                  and p_error.additional_info <> p_error.message
                             then ' ' || p_error.additional_info end, 1, 4000));
        commit;
        return l_reference;
    exception
        when others then
            rollback;
            return null;
    end record_incident;

    procedure mask(p_error in apex_error.t_error, p_result in out nocopy apex_error.t_error_result)
    is
        l_reference varchar2(12);
    begin
        l_reference := record_incident(p_error);
        p_result.message := c_generic || nvl(l_reference, 'unavailable') || '.';
        p_result.additional_info := null;
    end mask;

    function handle_error(p_error in apex_error.t_error) return apex_error.t_error_result
    is
        l_result     apex_error.t_error_result;
        l_constraint varchar2(255);
    begin
        l_result := apex_error.init_error_result(p_error => p_error);

        if p_error.is_internal_error then
            -- Keep access-denied and session errors; mask everything else.
            if not p_error.is_common_runtime_error then
                mask(p_error, l_result);
            end if;
            return l_result;
        end if;

        if p_error.ora_sqlcode in (-1, -2091, -2290, -2291, -2292) then
            l_constraint := apex_error.extract_constraint_name(p_error => p_error);
            begin
                select MESSAGE
                  into l_result.message
                  from APEXREST_EXAMPLE_CONSTRAINT_MESSAGES
                 where CONSTRAINT_NAME = l_constraint;
            exception
                when no_data_found then
                    null;
            end;
        end if;

        if p_error.ora_sqlcode is not null and l_result.message = p_error.message then
            if p_error.ora_sqlcode between -20999 and -20000 then
                l_result.message := apex_error.get_first_ora_error_text(p_error => p_error);
            else
                mask(p_error, l_result);
            end if;
        end if;

        if l_result.page_item_name is null and l_result.column_alias is null then
            apex_error.auto_set_associated_item(p_error => p_error, p_error_result => l_result);
        end if;
        return l_result;
    exception
        when others then
            l_result.message := c_generic || 'unavailable.';
            l_result.additional_info := null;
            return l_result;
    end handle_error;
end APEXREST_EXAMPLE_ERROR_API;
/

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2026 Angel Flores

Copyright (c) 2015 OraOpenSource

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
    "sourceSha256": "b68b81295653f60bf0d0d365fa24ba935a8a269a28ecf4d02758e685094d1743",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
