# Dialog Form Buttons

Modal dialog read-only form with a dialog-footer buttons container, cancel dynamic action and close-dialog process; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/form.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/form/form.dialog-buttons.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/form/form.dialog-buttons.md",
  "sourceSha256": "ddfb86b89314c9ceee556a69d66199d3618c34c85702dadd7f784c7a92dd18b1",
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
- Rename region, button and dynamic-action identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and retain every submitted item and column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Dialog Form Buttons
    alias: HOME
    title: Dialog Form Buttons
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region customer (
        name: Customer
        type: form
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 1 CUSTOMER_ID, 'Acme Corporation' CUSTOMER_NAME, 'Retail' SEGMENT from dual
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        edit {
            enabled: false
        }
    )
    pageItem P1_CUSTOMER_ID (
        type: hidden
        layout {
            sequence: 10
            region: @customer
            slot: regionBody
        }
        source {
            formRegion: @customer
            column: CUSTOMER_ID
            dataType: number
            queryOnly: true
            primaryKey: true
        }
    )
    pageItem P1_CUSTOMER_NAME (
        type: displayOnly
        label {
            label: Customer
        }
        layout {
            sequence: 20
            region: @customer
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @customer
            column: CUSTOMER_NAME
            dataType: varchar2
            queryOnly: true
        }
    )
    pageItem P1_SEGMENT (
        type: displayOnly
        label {
            label: Segment
        }
        layout {
            sequence: 30
            region: @customer
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @customer
            column: SEGMENT
            dataType: varchar2
            queryOnly: true
        }
    )
    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )
    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )
    button done (
        buttonName: DONE
        label: Done
        layout {
            sequence: 20
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-check
        }
        behavior {
            action: submitPage
        }
    )
    dynamicAction cancel-dialog (
        name: Cancel Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }
        action cancel-dialog-action (
            action: cancelDialog
            execution {
                sequence: 10
            }
        )
    )
    process initialize-form (
        name: Initialize form Customer
        type: formInitialization
        formRegion: @customer
        execution {
            sequence: 10
            point: beforeHeader
        }
    )
    process close-dialog (
        name: Close Dialog
        type: closeDialog
        execution {
            sequence: 10
            point: afterSubmit
        }
        serverSideCondition {
            whenButtonPressed: @done
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
    "sourceSha256": "cffdfccb9dd1a828e8a268353bfb602615eb0cd51388581c3885952c2a3a1f3a",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
