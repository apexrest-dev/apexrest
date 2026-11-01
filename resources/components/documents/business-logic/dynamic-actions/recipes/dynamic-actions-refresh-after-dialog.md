# Refresh Region After Dialog Closes

Classic report that refreshes on the Dialog Closed event raised by a modal page opened from its title button; synthetic data.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.refresh-region-after-dialog.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.refresh-region-after-dialog.md",
  "sourceSha256": "d83af7226a519bc3d821e0ee6c97f5f60649a74213cc62c8e00527389749dc24",
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

- Choose free page numbers for the launcher and the modal page and rename all P1_/P2_ items consistently.
- Rename region, button, process and dynamic-action identifiers before merging into existing pages.
- Preserve the target application authentication and authorization.
- Keep the dialog page mode modal and the close/cancel step last in its chain.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Refresh region after dialog
    alias: HOME
    title: Refresh region after dialog
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region results (
        name: Example Results
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select level ID, 'Sample row ' || level TITLE, to_char(systimestamp, 'HH24:MI:SS.FF3') REFRESHED_AT from dual connect by level <= 3
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Id
            }
            layout {
                sequence: 10
            }
        )
        column TITLE (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Title
            }
            layout {
                sequence: 20
            }
        )
        column REFRESHED_AT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Refreshed at
            }
            layout {
                sequence: 30
            }
        )
    )
    button open-dialog (
        buttonName: OPEN_DIALOG
        label: Open dialog
        layout {
            sequence: 10
            region: @results
            slot: rightOfTitle
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
    dynamicAction refresh-after-dialog (
        name: Refresh results after dialog
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @results
        }
        action refresh-results (
            action: refresh
            affectedElements {
                selectionType: region
                region: @results
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
)

```

## pages/p00002-dialog.apx

```apexlang
page 2 (
    name: Close on the client
    alias: DIALOG
    title: Close on the client
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
            htmlCode: <p>Done closes this dialog; the parent report refreshes when the dialog-closed event reaches its region.</p>
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
    button done (
        buttonName: DONE
        label: Done
        layout {
            sequence: 10
            region: @dialog-buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )
    dynamicAction close-dialog (
        name: Close dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @done
        }
        action native-dialog-close (
            action: closeDialog
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
    "sourceSha256": "999dbffa20920b45d57d40a4d2d61b7dddccc50e0dcb009e6901cd257a869c85",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
