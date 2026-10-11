# Debounced live report search

Debounced live report search with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/business-logic/dynamic-actions/dynamic-actions.execution-debounce-throttle.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/business-logic/dynamic-actions/dynamic-actions.execution-debounce-throttle.md",
  "sourceSha256": "baf97766d32536c1470008bed61c5619f4d992a507c18d074f43c0434d579893",
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
    name: Debounced live report search
    alias: HOME
    title: Debounced live report search
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
            htmlCode: <p>Search the two sample titles. Clear the filter to see all rows; unmatched text produces no rows.</p>
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
            label: Search title
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
    region results (
            name: Example Results
            type: classicReport
            source {
                location: localDatabase
                type: sqlQuery
                pageItemsToSubmit: P1_INPUT
                sqlQuery:
                    ```sql
                    select ID, TITLE, STATUS from (select 1 ID, 'Alpha sample' TITLE, 'Open' STATUS from dual union all select 2, 'Beta sample', 'Closed' from dual) where :P1_INPUT is null or instr(upper(TITLE), upper(:P1_INPUT)) > 0 order by ID
                    ```
            }
            layout {
                sequence: 20
                slot: body
            }
            appearance {
                template: @/interactive-report
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
            column STATUS (
                reportColumnQueryId: 3
                derivedColumn: N
                heading {
                    heading: Status
                }
                layout {
                    sequence: 30
                }
            )
        )
    dynamicAction respond (
        name: Respond to input
        execution {
            sequence: 10
            type: debounce
            time: 300
            immediate: false
        }
        when {
            event: input
            selectionType: items
            items: P1_INPUT
        }
        action step-10 (
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

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "a676cec8c043d8de05dd6e0ceacd096844a6a94224b428aebb0dfa07e52e2b40",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
