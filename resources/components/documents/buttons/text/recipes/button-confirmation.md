# Submit Button with Confirmation

Text submit button that asks for a danger-style confirmation and then clears session state; synthetic data and no business-table writes.

Status: ready.

Component: component:buttons/text.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.confirmation.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.confirmation.md",
  "sourceSha256": "d189eea26f646d13b53b0be564a2ac62d946ab8960e86711ad03d8b0bb025a95",
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
    name: Button with Confirmation
    alias: HOME
    title: Button with Confirmation
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region actions (
        name: Actions
        type: staticContent
        source {
            htmlCode: <p>Clearing the draft asks for confirmation first.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )
    button clear-draft (
        buttonName: CLEAR_DRAFT
        label: Clear Draft
        layout {
            sequence: 10
            region: @actions
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
            requiresConfirmation: true
            warnOnUnsavedChanges: doNotCheck
        }
        confirmation {
            message: Clear the current draft? This cannot be undone.
            style: danger
        }
    )
    process clear-draft (
        name: Clear Draft
        type: clearSessionState
        execution {
            sequence: 10
            point: processing
        }
        serverSideCondition {
            whenButtonPressed: @clear-draft
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
    "sourceSha256": "972bf6f21344fb9070352cf1be325fcfe20664d71901ae517bc130ae0e865fb5",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
