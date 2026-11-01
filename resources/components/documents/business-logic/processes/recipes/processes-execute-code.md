# Execute Code Page Process

Before-header and button-conditioned after-submit Execute Code processes that compute a total from session state; synthetic data and no DML.

Status: ready.

Component: component:business-logic/processes.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/processes/processes.execute-code.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/processes/processes.execute-code.md",
  "sourceSha256": "e4c11f782906eafb517a5dde44473d6d4f6996d3f8af5aff079e9a25129cd17c",
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
    "P1_QUANTITY",
    "P1_UNIT_PRICE"
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
    name: Execute code process
    alias: HOME
    title: Execute code process
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
            htmlCode: <p>A before-header process seeds a default; an after-submit process runs inline PL/SQL on session state only when Calculate is pressed.</p>
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
    pageItem P1_QUANTITY (
        type: numberField
        label {
            label: Quantity
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
    pageItem P1_UNIT_PRICE (
        type: numberField
        label {
            label: Unit price
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
    pageItem P1_TOTAL (
        type: displayOnly
        label {
            label: Total
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
    button calculate (
        buttonName: CALCULATE
        label: Calculate
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
    process seed-defaults (
        name: Seed defaults
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    if :P1_UNIT_PRICE is null then
                        :P1_UNIT_PRICE := 12.5;
                    end if;
                end;
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
    )
    process calculate-total (
        name: Calculate total
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    :P1_TOTAL := to_char(nvl(to_number(:P1_QUANTITY), 0) * nvl(to_number(:P1_UNIT_PRICE), 0), 'FM999G999G990D00');
                    apex_debug.message('Calculated total %s', :P1_TOTAL);
                end;
                ```
        }
        execution {
            sequence: 10
            point: afterSubmit
        }
        serverSideCondition {
            whenButtonPressed: @calculate
        }
        successMessage {
            successMessage: Total calculated.
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
    "sourceSha256": "459b5c26eae012fe65ded93fd9fbbf0a80e57c228ee843dda31112efdab381ab",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
