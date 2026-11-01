# Chart Custom Tooltips

Native JET bar chart whose tooltips come from a SQL-formatted column mapped as customTooltip; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-custom-tooltip.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-custom-tooltip.md",
  "sourceSha256": "5068c89ef7d2b639998cc65b26c6668122f42f5c8a5d3ec6f97b2c45f554b2b5",
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
- Rename region, series and axis identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and keep every column alias used by the series column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Chart Custom Tooltips
    alias: HOME
    title: Chart Custom Tooltips
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region order-quantities (
        name: Order Quantities with Custom Tooltips
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
        tooltip {
            showSeriesName: false
        }
        legend {
            show: false
        }

        series orders (
            name: Orders
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select product_name,
                           quantity,
                           product_name || ': ' || to_char(quantity, 'FM999,990') || ' units, ' ||
                           to_char(quantity * unit_price, 'FM$999,990.00') || ' revenue' as tooltip_text
                      from (select 'Apples' as product_name, 1250 as quantity, 0.45 as unit_price from dual union all
                            select 'Bananas', 980, 0.30 from dual union all
                            select 'Grapes', 430, 2.10 from dual union all
                            select 'Oranges', 760, 0.65 from dual)
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
                customTooltip: TOOLTIP_TEXT
            }
            label {
                show: true
            }
        )

        axis x (
            name: x
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            title: Quantity
            value {
                format: decimal
                decimalPlaces: 0
            }
            minorTicks {
                show: false
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
    "sourceSha256": "773d1de59fa768fa15f095edacad6758d3b3ad63e5ac6edfd7c2bcf3caf54099",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
