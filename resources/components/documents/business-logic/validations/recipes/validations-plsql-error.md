# PL/SQL Error Validation

PL/SQL Error validation that raises an application error for an invalid quantity range and shows it through #SQLERRM_TEXT#; synthetic data.

Status: ready.

Component: component:business-logic/validations.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/validations/validations.plsql-error.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/validations/validations.plsql-error.md",
  "sourceSha256": "55a256efb779cde4cec56ec761eddc4b8281d05342a3692a48cd7b0600049871",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "synthetic-dual",
  "tables": [],
  "bindings": [],
  "submittedItems": [
    "P1_MIN_QTY",
    "P1_MAX_QTY"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename region, button, process and dynamic-action identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic logic only with authorized project code and keep server code free of business-table DML unless explicitly authorized.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Validation with PL/SQL raising an error
    alias: HOME
    title: Validation with PL/SQL raising an error
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
            htmlCode: <p>The validation code raises an application error when the maximum is lower than the minimum; #SQLERRM_TEXT# shows the raised text as the validation message.</p>
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
    pageItem P1_MIN_QTY (
        type: numberField
        label {
            label: Minimum quantity
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
    pageItem P1_MAX_QTY (
        type: numberField
        label {
            label: Maximum quantity
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
    pageItem P1_RESULT (
        type: displayOnly
        label {
            label: Result
        }
        layout {
            sequence: 30
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    button check (
        buttonName: CHECK
        label: Validate
        layout {
            sequence: 10
            region: @controls
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
        }
    )
    validation max-not-below-min (
        name: Maximum not below minimum
        execution {
            sequence: 10
        }
        validation {
            type: plsqlError
            plsqlCodeRaisingError:
                ```plsql
                begin
                    if :P1_MIN_QTY is not null
                       and :P1_MAX_QTY is not null
                       and to_number(:P1_MAX_QTY) < to_number(:P1_MIN_QTY)
                    then
                        raise_application_error(-20001, 'Maximum quantity ' || :P1_MAX_QTY || ' is lower than minimum ' || :P1_MIN_QTY || '.');
                    end if;
                end;
                ```
        }
        error {
            errorMessage: #SQLERRM_TEXT#
            associatedItem: @P1_MAX_QTY
        }
        serverSideCondition {
            whenButtonPressed: @check
        }
    )
    process accepted (
        name: Accept valid range
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    :P1_RESULT := 'Accepted range: ' || :P1_MIN_QTY || ' to ' || :P1_MAX_QTY;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @check
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
    "sourceSha256": "4020553519a7fee718736783e23350d3ec8a4fb97c16655a6fd242aa40653d6b",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
