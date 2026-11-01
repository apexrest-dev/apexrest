# Add and Remove Region CSS Class

Button dynamic actions that add and remove CSS classes on a region; synthetic data and no page submit.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.add-remove-class.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.add-remove-class.md",
  "sourceSha256": "dd8c7516f15dd2ed59e793e7ef6fef1b8ae43907b5a604dbfa33dabd0b5786a5",
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
    name: Add and remove a region CSS class
    alias: HOME
    title: Add and remove a region CSS class
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
            htmlCode: <p>Highlight adds CSS classes to the Status panel region; Clear removes them. No page submit occurs.</p>
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
    button highlight (
        buttonName: HIGHLIGHT
        label: Highlight
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
    button clear (
        buttonName: CLEAR
        label: Clear
        layout {
            sequence: 20
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
    region panel (
        name: Status panel
        type: staticContent
        source {
            htmlCode: <p>This region receives the highlight classes.</p>
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )
    dynamicAction highlight-panel (
        name: Highlight panel
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @highlight
        }
        action add-class (
            action: addClass
            settings {
                class: is-highlighted u-color-29-bg
            }
            affectedElements {
                selectionType: region
                region: @panel
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction clear-panel (
        name: Clear panel highlight
        execution {
            sequence: 20
        }
        when {
            event: click
            selectionType: button
            button: @clear
        }
        action remove-class (
            action: removeClass
            settings {
                class: is-highlighted u-color-29-bg
            }
            affectedElements {
                selectionType: region
                region: @panel
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
    "sourceSha256": "f997e9a537869417f4fc5346754d0a32b6db003ad6b9bf5e314fea1029530b9e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
