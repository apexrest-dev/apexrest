# Reset item to a known default

Reset item to a known default with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/business-logic/dynamic-actions/dynamic-actions.set-value-static.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/business-logic/dynamic-actions/dynamic-actions.set-value-static.md",
  "sourceSha256": "d4f9e68addc8e39b8856bf47806c9c74e3d195c8a35b8cde5eecd7767da17e1b",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "static",
  "tables": [],
  "bindings": [],
  "submittedItems": []
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
    name: Reset item to a known default
    alias: HOME
    title: Reset item to a known default
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
            htmlCode: <p>Edit the value, then choose Reset to replace it with Draft.</p>
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
    pageItem P1_OUTPUT (
        type: textField
        label {
            label: Status
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
    button preview (
        buttonName: PREVIEW
        label: Reset
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
            action: definedByDynamicAction
        }
    )
    dynamicAction respond (
        name: Respond to input
        execution {
            sequence: 10

        }
        when {
            event: click
            selectionType: button
            button: @preview
        }
        action step-10 (
            action: setValue
            settings {
                type: static
                value: Draft
            }
            affectedElements {
                selectionType: items
                items: P1_OUTPUT
            }
            execution {
                sequence: 10
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
    "sourceSha256": "59277d50377ae06dbf61fbc356b52906d7c7bb4c8cd8f2e81e0232af4fa5a73a",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
