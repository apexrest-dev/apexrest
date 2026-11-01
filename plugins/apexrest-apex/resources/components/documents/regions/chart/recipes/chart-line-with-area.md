# Line with Area Chart

Native JET line-with-area chart with curved lines, styled markers and data labels for two series; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00018-line-with-area.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00018-line-with-area.apx",
  "sourceSha256": "7a1bc6323065ee071fa7d20bfd712e9b009d743b55f6b04cfff02a6c70b6f6a7",
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
    name: Line with Area Chart
    alias: HOME
    title: Line with Area Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region quarterly-orders (
        name: Quarterly Orders by Channel
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                js-showMaximizeButton
                t-Region--scrollBody
            ]
        }
        chart {
            type: lineWithArea
        }
        chartLayout {
            height: 420
        }
        dataCursor {
            behavior: smooth
            dimOnHover: false
        }
        animation {
            onDataChange: none
        }
        legend {
            position: top
        }

        series online (
            name: Online
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Q1' as quarter, 320 as orders from dual union all
                    select 'Q2', 410 from dual union all
                    select 'Q3', 385 from dual union all
                    select 'Q4', 520 from dual
                    ```
            }
            columnMapping {
                label: QUARTER
                value: ORDERS
            }
            line {
                type: curved
            }
            marker {
                show: true
                shape: circle
            }
            label {
                show: true
                position: aboveMarker
            }
        )

        series retail (
            name: Retail Stores
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Q1' as quarter, 210 as orders from dual union all
                    select 'Q2', 190 from dual union all
                    select 'Q3', 240 from dual union all
                    select 'Q4', 300 from dual
                    ```
            }
            columnMapping {
                label: QUARTER
                value: ORDERS
            }
            line {
                style: dashed
                type: curved
            }
            marker {
                show: true
                shape: diamond
            }
            label {
                show: true
                position: belowMarker
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
            title: Orders
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
    "sourceSha256": "26444e40f9eb91e4f4a723bd9098ac09c3eb87d0985b83a1ffc2a836d9e4ce2b",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
