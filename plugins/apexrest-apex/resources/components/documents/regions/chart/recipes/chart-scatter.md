# Scatter Chart

Native JET scatter chart plotting x/y value pairs with star markers and formatted axes; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00008-scatter.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00008-scatter.apx",
  "sourceSha256": "50bf5e1b066921c880f91511ee86666680c1caf99dab771b888b597e353b6040",
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
    name: Scatter Chart
    alias: HOME
    title: Scatter Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region open-close-scatter (
        name: Opening vs Closing Price
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
            type: scatter
        }
        title {
            title: Sample Corp Daily Prices
        }
        chartLayout {
            height: 400
        }
        animation {
            onDataChange: none
        }
        tooltip {
            showSeriesName: false
        }
        legend {
            hideAndShowBehavior: none
        }

        series daily-prices (
            name: Daily Prices
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select to_char(trunc(sysdate) - level, 'YYYY-MM-DD') as label,
                           round(100 + 8 * sin(level / 3), 2) as x_value,
                           round(100 + 8 * sin(level / 3) + 3 * cos(level), 2) as y_value
                      from dual
                   connect by level <= 30
                    ```
            }
            columnMapping {
                label: LABEL
                x: X_VALUE
                y: Y_VALUE
            }
            marker {
                shape: star
            }
        )

        axis x (
            name: x
            title: Opening Value
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            minorTicks {
                show: true
            }
        )

        axis y (
            name: y
            title: Closing Value
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            minorTicks {
                show: true
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
    "sourceSha256": "62b3ff4488f21cd4dcd0fd6c34068ba1553c685f99032c1565f42df990cb8c97",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
