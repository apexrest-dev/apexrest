# Chart Links

Native JET bar chart whose data points link back to the page with a checksummed item value; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00009-bar.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00009-bar.apx",
  "sourceSha256": "2616e4946d735332c059922dc36d9993515cf08cf6debcfa36c19c7ea1715871",
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

- Choose a free page number, rename P1_SELECTED_PRODUCT consistently and point the series link target at that page.
- Rename region, series and axis identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and keep every column alias used by the series column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Chart Links
    alias: HOME
    title: Chart Links
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region product-sales (
        name: Product Sales (Click a Bar)
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        chart {
            type: bar
        }
        chartLayout {
            height: 360
        }
        legend {
            show: false
        }

        series sales (
            name: Sales
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Apples' as product_name, 120 as total_quantity from dual union all
                    select 'Bananas', 95 from dual union all
                    select 'Grapes', 60 from dual union all
                    select 'Oranges', 140 from dual union all
                    select 'Pears', 45 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: TOTAL_QUANTITY
            }
            link {
                type: redirectThisApp
                target: {
                    page: 1
                    items: {
                        P1_SELECTED_PRODUCT: &PRODUCT_NAME.
                    }
                    clearCache: 1
                }
            }
            label {
                show: true
            }
        )

        axis x (
            name: x
            title: Product
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            title: Quantity
            minorTicks {
                show: false
            }
        )
    )

    region selection (
        name: Selected Product
        type: staticContent
        source {
            htmlCode: <p>Click a bar to reload this page with the product passed through a checksummed link.</p>
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

    pageItem P1_SELECTED_PRODUCT (
        type: displayOnly
        label {
            label: Selected product
        }
        layout {
            sequence: 10
            region: @selection
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
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
    "sourceSha256": "62e740e73ef4e479cd76cc7f6635235bd9e4158e0894fb6fe857c8fbda8d8146",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
