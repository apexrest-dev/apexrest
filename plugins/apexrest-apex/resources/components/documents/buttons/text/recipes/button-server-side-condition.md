# Button with Server-Side Condition

Hot submit button rendered only when a page item equals a value; synthetic data and no business-table writes.

Status: ready.

Component: component:buttons/text.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.server-side-condition.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.server-side-condition.md",
  "sourceSha256": "e84238e131bdd7370794f5e2be19fce725f153cb545ab7db1132e5ac37d9c583",
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
    "P1_STATUS"
  ]
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
    name: Conditional Button
    alias: HOME
    title: Conditional Button
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region form (
        name: Form
        type: staticContent
        source {
            htmlCode: <p>The Approve button renders only when the status is PENDING.</p>
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
    pageItem P1_STATUS (
        type: selectList
        label {
            label: Status
        }
        lov {
            type: staticValues
            staticValues: STATIC:Pending;PENDING,Approved;APPROVED
        }
        layout {
            sequence: 10
            region: @form
            slot: regionBody
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        default {
            type: static
            staticValue: PENDING
        }
    )
    button apply-status (
        buttonName: APPLY_STATUS
        label: Apply Status
        layout {
            sequence: 10
            region: @form
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
            warnOnUnsavedChanges: doNotCheck
        }
    )
    button approve (
        buttonName: APPROVE
        label: Approve
        layout {
            sequence: 20
            region: @form
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: item=value
            item: P1_STATUS
            value: PENDING
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
    "sourceSha256": "1f4862b55d2528ec36612cdfa27dbcc6abaaac3e7c0219a20080322e9dfa7785",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
