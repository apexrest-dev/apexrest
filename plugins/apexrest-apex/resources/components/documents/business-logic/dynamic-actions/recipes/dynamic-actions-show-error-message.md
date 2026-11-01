# Show Error or Success Message on Change

Change dynamic action with a JavaScript client-side condition that shows a page error message or, on the false branch, clears errors and shows a success message; synthetic data.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.show-error-message.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.show-error-message.md",
  "sourceSha256": "08ff6791e64cffd877b8e21163cf4f95ec423c2ba1499d6a69f3ed055fa27eda",
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
  "submittedItems": []
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
    name: Show error or success message on change
    alias: HOME
    title: Show error or success message on change
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
            htmlCode: <p>Enter a quantity. Values outside 1 to 100 show a page-level error message; valid values clear errors and show a success message.</p>
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
            label: Quantity (1-100)
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
    dynamicAction check-quantity (
        name: Check quantity
        execution {
            sequence: 10
        }
        when {
            event: change
            selectionType: items
            items: P1_QUANTITY
        }
        clientSideCondition {
            type: jsExpression
            javaScriptExpression: !(Number(apex.items.P1_QUANTITY.value) >= 1 && Number(apex.items.P1_QUANTITY.value) <= 100)
        }
        action show-error (
            action: showErrorMessage
            settings {
                message: Quantity must be a number from 1 to 100.
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action clear-errors (
            action: clearErrors
            execution {
                sequence: 20
                fireWhenEventResultIs: false
                fireOnInit: false
            }
        )
        action show-success (
            action: showSuccessMessage
            settings {
                message: Quantity accepted.
            }
            execution {
                sequence: 30
                fireWhenEventResultIs: false
                fireOnInit: false
            }
        )
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "7df41dfc811fd16dfc6577d6b8d659785b071d5509738e3bfbedd2c2429131cf",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
