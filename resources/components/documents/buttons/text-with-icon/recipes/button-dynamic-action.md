# Button Defined by Dynamic Action

Text-with-icon button whose click is handled by a dynamic action that shows an alert; synthetic data and no server calls.

Status: ready.

Component: component:buttons/text-with-icon.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.defined-by-da.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.defined-by-da.md",
  "sourceSha256": "d90c12bc9dc7018606430770f24f8b31b9a0c9f6d7a9662ea274eec1ece32f7f",
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
    name: Button Defined by Dynamic Action
    alias: HOME
    title: Button Defined by Dynamic Action
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
            htmlCode: <p>The button has no server behavior; a click dynamic action shows a message.</p>
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
    button show-tip (
        buttonName: SHOW_TIP
        label: Show Tip
        layout {
            sequence: 10
            region: @actions
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-lightbulb-o
        }
        behavior {
            action: definedByDynamicAction
        }
    )
    dynamicAction show-tip-click (
        name: Show Tip on Click
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @show-tip
        }
        action step-10 (
            action: alert
            settings {
                message: Buttons defined by dynamic actions run only client-side logic.
                style: information
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
    "sourceSha256": "f484b41ddd4e87079a65981b259e55bd12965f693e45a5f3a8cea9df5c5bdd3e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
