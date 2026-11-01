# Icon Button with Trigger Action

Icon button with a nested trigger action that hides a region without a separate dynamic action; synthetic data and no server calls.

Status: ready.

Component: component:buttons/icon.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.trigger-action.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.trigger-action.md",
  "sourceSha256": "d25157586555b1afb6da1d891daa8a8f04c80f327e0d03b12707a76d57919ab5",
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
- Rename region, button and process identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace the synthetic behavior only with authorized project logic and keep the button action type unchanged.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Button with Trigger Action
    alias: HOME
    title: Button with Trigger Action
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region details (
        name: Details
        type: staticContent
        source {
            htmlCode: <p>The Hide Details button runs a declarative trigger action without a separate dynamic action.</p>
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
    region actions (
        name: Actions
        type: staticContent
        source {
            htmlCode: <p>Hide the details region.</p>
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )
    button hide-details (
        buttonName: HIDE_DETAILS
        label: Hide Details
        layout {
            sequence: 10
            region: @actions
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-eye-slash
        }
        behavior {
            action: triggerAction
            executeValidations: false
        }

        triggerAction hide-region (
            action: hide
            affectedElements {
                selectionType: region
                region: @details
            }
            execution {
                sequence: 10
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
    "sourceSha256": "f2fe088c6c8da5dc8d735b2adb3577aae5337b384ead76361f75117147be74ee",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
