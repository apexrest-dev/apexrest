# Set item from an AJAX SQL query

Set item from an AJAX SQL query with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/business-logic/dynamic-actions/dynamic-actions.set-value-sql.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/business-logic/dynamic-actions/dynamic-actions.set-value-sql.md",
  "sourceSha256": "dd590c54311e432bdd2a39788095fceeb6239f49ab118e7cdf20caaae3004eea",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "synthetic-dual",
  "tables": [],
  "bindings": [
    "P1_INPUT"
  ],
  "submittedItems": [
    "P1_INPUT"
  ]
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
    name: Set item from an AJAX SQL query
    alias: HOME
    title: Set item from an AJAX SQL query
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
            htmlCode: <p>Change the input to request its normalized value from a single-row DUAL query.</p>
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
    pageItem P1_INPUT (
        type: textField
        label {
            label: Input
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
    pageItem P1_OUTPUT (
        type: textField
        label {
            label: Result
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
    dynamicAction respond (
        name: Respond to input
        execution {
            sequence: 10

        }
        when {
            event: change
            selectionType: items
            items: P1_INPUT
        }
        action step-10 (
            action: setValue
            settings {
                type: sqlQuery
                itemsToSubmit: P1_INPUT
                sqlQuery:
                    ```sql
                    select upper(trim(:P1_INPUT)) from dual
                    ```
            }
            affectedElements {
                selectionType: items
                items: P1_OUTPUT
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
    "sourceSha256": "bee7d177b74513a3138423b74552bab933fd1e3366d84324fa957f005076a295",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
