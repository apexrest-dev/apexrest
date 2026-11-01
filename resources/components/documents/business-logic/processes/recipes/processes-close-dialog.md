# Close Dialog Process

Modal dialog page whose Save request runs a session-state process and then a request-conditioned Close Dialog process last; synthetic data.

Status: ready.

Component: component:business-logic/processes.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/processes/processes.close-dialog.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/processes/processes.close-dialog.md",
  "sourceSha256": "c2a310eadcaeecf967bc84c0767438b027aac88bc8248a5277133577c54a97b3",
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
    "P2_NOTE"
  ]
}
```

## Adaptation

- Choose free page numbers for the launcher and the modal page and rename all P1_/P2_ items consistently.
- Rename region, button, process and dynamic-action identifiers before merging into existing pages.
- Preserve the target application authentication and authorization.
- Keep the dialog page mode modal and the close/cancel step last in its chain.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Close dialog process
    alias: HOME
    title: Close dialog process
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region launcher (
        name: Launcher
        type: staticContent
        source {
            htmlCode: <p>Open the modal dialog, then press Save; the dialog closes only after its after-submit processing succeeds.</p>
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
    button open-dialog (
        buttonName: OPEN_DIALOG
        label: Open dialog
        layout {
            sequence: 10
            region: @launcher
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 2
                clearCache: 2
            }
        }
    )
)

```

## pages/p00002-dialog.apx

```apexlang
page 2 (
    name: Save and close
    alias: DIALOG
    title: Save and close
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        chained: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region dialog-body (
        name: Dialog body
        type: staticContent
        source {
            htmlCode: <p>Save runs a session-state process first and the close dialog process last.</p>
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )
    region dialog-buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
    )
    pageItem P2_NOTE (
        type: textField
        label {
            label: Note
        }
        layout {
            sequence: 10
            region: @dialog-body
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @dialog-buttons
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
    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 20
            region: @dialog-buttons
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
    dynamicAction cancel-dialog (
        name: Cancel dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }
        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    process record-note (
        name: Record note
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    apex_debug.message('Dialog note: %s', :P2_NOTE);
                end;
                ```
        }
        execution {
            sequence: 10
            point: afterSubmit
        }
        serverSideCondition {
            whenButtonPressed: @save
        }
    )
    process close-dialog (
        name: Close Dialog
        type: closeDialog
        execution {
            sequence: 90
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: SAVE
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
    "sourceSha256": "804adb2c61776eec7fa88d40ae2c8dc6580793debe5c5d3610f35486d17462ef",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
