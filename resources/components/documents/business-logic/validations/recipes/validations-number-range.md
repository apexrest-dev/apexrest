# Null-safe numeric range validation

Null-safe numeric range validation with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:business-logic/validations.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/business-logic/validations/validations.expression.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/business-logic/validations/validations.expression.md",
  "sourceSha256": "e7b110c343ad586ddd4eab23716eb04e97dea67aacc3da2564cff7f0fc0e8cdd",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "session-state",
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
    name: Null-safe numeric range validation
    alias: HOME
    title: Null-safe numeric range validation
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
            htmlCode: <p>Try 42 to pass; empty input, zero, negative values and three digits must fail.</p>
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
            type: expression
            plsqlExpression:
                ```plsql
                :P1_INPUT is not null and regexp_like(:P1_INPUT, '^[0-9]{1,2}$') and nvl(length(ltrim(:P1_INPUT, '0')), 0) > 0
                ```
        }
        error {
            errorMessage: Enter a whole number from 1 through 99.
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
    "sourceSha256": "716a1741a1ebdeb54ca6d53fcda392ac72fc17cc5ad9553268ce51c09a93c17e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
