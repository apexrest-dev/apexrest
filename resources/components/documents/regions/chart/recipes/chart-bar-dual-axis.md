# Bar Chart with Dual Y Axis

Native JET bar chart with two series, formatted data labels and a secondary Y2 axis split; synthetic data.

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

- Choose a free page number and rename all P1_ items consistently.
- Rename region, series and axis identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and keep every column alias used by the series column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Bar Chart with Dual Y Axis
    alias: HOME
    title: Bar Chart with Dual Y Axis
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region units-and-revenue (
        name: Units and Revenue by Product
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
        advanced {
            htmlDomId: unitsRevenueChart
        }
        chart {
            type: bar
        }
        chartLayout {
            height: 400
        }
        dataCursor {
            dimOnHover: false
        }
        legend {
            position: top
        }

        series units-sold (
            name: Units Sold
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Laptops' as product_name, 120 as units from dual union all
                    select 'Monitors', 85 from dual union all
                    select 'Keyboards', 240 from dual union all
                    select 'Headsets', 160 from dual union all
                    select 'Docking Stations', 60 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: UNITS
            }
            label {
                show: true
                position: insideBarEdge
                fontColor: WHITE
            }
        )

        series revenue (
            name: Revenue (USD)
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Laptops' as product_name, 156000 as revenue from dual union all
                    select 'Monitors', 25500 from dual union all
                    select 'Keyboards', 12000 from dual union all
                    select 'Headsets', 14400 from dual union all
                    select 'Docking Stations', 13200 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: REVENUE
            }
            appearance {
                assignedToY2Axis: true
            }
            label {
                show: true
                position: outsideBarEdge
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
            title: Units Sold
            value {
                format: decimal
                decimalPlaces: 0
            }
            minorTicks {
                show: false
            }
        )

        axis y-2 (
            name: y2
            title: Revenue (USD)
            value {
                format: currency
                decimalPlaces: 0
            }
            minorTicks {
                show: false
            }
            dualYAxes {
                show: true
                splitterPosition: 0.7
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
    "sourceSha256": "61e182f3614555ddcf14d634b5a3d1aafc258aeded59bae0e160c020add710bd",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
