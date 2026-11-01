# Confirm Before Action

Button dynamic action that shows a Confirm dialog and runs Set Value and Alert actions only after OK; synthetic data.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.alert-confirm-cancel.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.alert-confirm-cancel.md",
  "sourceSha256": "074ca421526c81ae61ba540e9313675bb1e7f05a441f3b37eafec9826d65b81e",
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
    name: Confirm before action
    alias: HOME
    title: Confirm before action
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
            htmlCode: <p>Proceed opens a confirmation dialog. OK runs the following actions; Cancel stops the action chain and leaves the value unchanged.</p>
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
    pageItem P1_RESULT (
        type: displayOnly
        label {
            label: Last confirmation
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
    button proceed (
        buttonName: PROCEED
        label: Proceed
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
            action: definedByDynamicAction
        }
    )
    dynamicAction confirm-proceed (
        name: Confirm proceed
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @proceed
        }
        action confirm (
            action: confirm
            settings {
                title: Proceed with the example?
                message: Choose OK to continue or Cancel to stop.
                style: warning
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action record-confirmed (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: 'Confirmed at ' + new Date().toLocaleTimeString()
            }
            affectedElements {
                selectionType: items
                items: P1_RESULT
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
        action alert-confirmed (
            action: alert
            settings {
                title: Confirmed
                message: The actions after the confirmation ran because OK was chosen.
                style: success
            }
            execution {
                sequence: 30
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
    "sourceSha256": "66d5bfca5a0f959df93417c13108e6f80e60895a3ec88e609b759cba4a0d57b7",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
