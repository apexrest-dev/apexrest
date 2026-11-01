# Read-only Grid with Toolbar

Read-only interactive grid with page pagination, total count, toolbar controls, download settings and saved report; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/interactive-grid.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-grid/interactive-grid.standard.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-grid/interactive-grid.standard.md",
  "sourceSha256": "3a22e21a8775da503e3096690005e7bb26b8f4815f193c3984f1502c210c280e",
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
    name: Read-only Grid with Toolbar
    alias: HOME
    title: Read-only Grid with Toolbar
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region inventory (
        name: Inventory
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select level PRODUCT_ID,
                       'Product ' || level PRODUCT_NAME,
                       mod(level * 7, 50) QUANTITY,
                       level * 9.99 UNIT_PRICE
                  from dual
               connect by level <= 40
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        edit {
            enabled: false
        }
        pagination {
            type: page
            showTotalCount: true
        }
        performance {
            lazyLoading: false
        }
        messages {
            whenNoDataFound: No products found
        }
        toolbar {
            controls: [
                searchCol
                searchField
                actionsMenu
                resetButton
            ]
        }
        download {
            formats: [
                csv
                html
            ]
            csvSeparator: ;
            filename: inventory
        }
        savedReport primary (
            visibility: primary
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }
        )
        column PRODUCT_ID (
            type: hidden
            layout {
                sequence: 10
            }
            source {
                databaseColumn: PRODUCT_ID
                dataType: number
                primaryKey: true
            }
        )
        column PRODUCT_NAME (
            type: textField
            heading {
                heading: Product
            }
            layout {
                sequence: 20
            }
            source {
                databaseColumn: PRODUCT_NAME
                dataType: varchar2
            }
        )
        column QUANTITY (
            type: numberField
            heading {
                heading: Quantity
                alignment: end
            }
            layout {
                sequence: 30
                columnAlignment: end
            }
            source {
                databaseColumn: QUANTITY
                dataType: number
            }
        )
        column UNIT_PRICE (
            type: numberField
            heading {
                heading: Unit Price
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G990D00
            }
            source {
                databaseColumn: UNIT_PRICE
                dataType: number
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
    "sourceSha256": "6f0180447fb5b712f3f6d47aa5c7c4f0a63cd87c65c88b1542d89573f5dd8bd5",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
