# Reserved synthetic code validation

Reserved synthetic code validation with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:business-logic/validations.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/business-logic/validations/validations.sql.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/business-logic/validations/validations.sql.md",
  "sourceSha256": "4912d00e6dc7f413c336d3ed60d628b54cd364d4496b7ea24ebbb0b1fdd529f1",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "synthetic-dual",
  "tables": [],
  "bindings": [
    "P1_INPUT",
    "P1_OUTPUT"
  ],
  "submittedItems": [
    "P1_INPUT"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename region, button and dynamic-action identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and retain every submitted item and column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Reserved synthetic code validation
    alias: HOME
    title: Reserved synthetic code validation
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region controls (
        name: Controls
        type: staticContent
        source {
            htmlCode: <p>Reserved codes are rejected by a query that must return no rows for valid input.</p>
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
    pageItem P1_INPUT (
        type: textField
        label {
            label: Input
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_OUTPUT (
        type: textField
        label {
            label: Result
        }
        layout {
            sequence: 20
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    button preview (
        buttonName: PREVIEW
        label: Validate
        layout {
            sequence: 10
            region: @controls
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
        }
    )
    validation check-input (
        name: Validate input
        execution {
            sequence: 10
        }
        validation {
            type: noRowsReturned
            sqlQuery:
                ```sql
                select 1 from dual where upper(trim(:P1_INPUT)) in ('ADMIN', 'SYSTEM') or trim(:P1_INPUT) is null
                ```
        }
        error {
            errorMessage: Enter a non-empty code other than ADMIN or SYSTEM.
            associatedItem: @P1_INPUT
        }
        serverSideCondition {
            whenButtonPressed: @preview
        }
    )
    process accepted (
        name: Accept valid input
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    :P1_OUTPUT := 'Accepted: ' || :P1_INPUT;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @preview
        }
        successMessage {
            successMessage: Input passed validation.
        }
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "a7f263aa4716717e189f917d5073451f9c2309f860bda116735e97feb099fd30",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
