# Debounce and Throttle Execution

Five keyup dynamic actions that copy a text area value with immediate, debounce and throttle execution types and immediate flags; synthetic data.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-dynamic-actions/apexlang/sample-dynamic-actions/pages/p00021-debounce-and-throttle.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-dynamic-actions/apexlang/sample-dynamic-actions/pages/p00021-debounce-and-throttle.apx",
  "sourceSha256": "953efa517524a19d47755fd3937e0d1d2197186de4c271d6970e5571bfc4687e",
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
    name: Debounce and throttle execution
    alias: HOME
    title: Debounce and throttle execution
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
            htmlCode: <p>Type in the text area. Each display item is updated by its own keyup dynamic action: immediately, with a 2000 ms debounce (delayed or immediate), or with a 2000 ms throttle (delayed or immediate).</p>
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
    pageItem P1_TEXT (
        type: textarea
        label {
            label: Enter text here
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
    pageItem P1_IMMEDIATE (
        type: displayOnly
        label {
            label: Immediate
        }
        layout {
            sequence: 20
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_DEBOUNCE_DELAY (
        type: displayOnly
        label {
            label: Debounce delay
        }
        layout {
            sequence: 30
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_DEBOUNCE_IMMEDIATE (
        type: displayOnly
        label {
            label: Debounce immediate
        }
        layout {
            sequence: 40
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_THROTTLE_IMMEDIATE (
        type: displayOnly
        label {
            label: Throttle immediate
        }
        layout {
            sequence: 50
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_THROTTLE_DELAY (
        type: displayOnly
        label {
            label: Throttle delay
        }
        layout {
            sequence: 60
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    dynamicAction update-immediate (
        name: Update P1_IMMEDIATE
        execution {
            sequence: 10
        }
        when {
            event: keyup
            selectionType: items
            items: P1_TEXT
        }
        action set-item-value (
            name: Set item value
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.triggeringElement.value
            }
            affectedElements {
                selectionType: items
                items: P1_IMMEDIATE
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction update-debounce-delay (
        name: Update P1_DEBOUNCE_DELAY
        execution {
            sequence: 20
            type: debounce
            time: 2000
        }
        when {
            event: keyup
            selectionType: items
            items: P1_TEXT
        }
        action set-item-value (
            name: Set item value
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.triggeringElement.value
            }
            affectedElements {
                selectionType: items
                items: P1_DEBOUNCE_DELAY
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction update-debounce-immediate (
        name: Update P1_DEBOUNCE_IMMEDIATE
        execution {
            sequence: 30
            type: debounce
            time: 2000
            immediate: true
        }
        when {
            event: keyup
            selectionType: items
            items: P1_TEXT
        }
        action set-item-value (
            name: Set item value
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.triggeringElement.value
            }
            affectedElements {
                selectionType: items
                items: P1_DEBOUNCE_IMMEDIATE
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction update-throttle-immediate (
        name: Update P1_THROTTLE_IMMEDIATE
        execution {
            sequence: 40
            type: throttle
            time: 2000
            immediate: true
        }
        when {
            event: keyup
            selectionType: items
            items: P1_TEXT
        }
        action set-item-value (
            name: Set item value
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.triggeringElement.value
            }
            affectedElements {
                selectionType: items
                items: P1_THROTTLE_IMMEDIATE
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction update-throttle-delay (
        name: Update P1_THROTTLE_DELAY
        execution {
            sequence: 50
            type: throttle
            time: 2000
        }
        when {
            event: keyup
            selectionType: items
            items: P1_TEXT
        }
        action set-item-value (
            name: Set item value
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.triggeringElement.value
            }
            affectedElements {
                selectionType: items
                items: P1_THROTTLE_DELAY
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
    "sourceSha256": "8a78fcda9ca3afaf1740c423cb253bb20a3db1ecd8d3414c7c4833084af88639",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
