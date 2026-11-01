# Stock Chart

Native JET stock (candlestick) chart with open/high/low/close/volume mappings, time axis, data cursor and initial zoom; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00007-stock.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00007-stock.apx",
  "sourceSha256": "a987aebc058be9badfe2a259477d505836cbc26c88f70415c884ce4d63beeee7",
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
    name: Stock Chart
    alias: HOME
    title: Stock Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region sample-corp-stock (
        name: Sample Corp Stock Chart
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
                i-h480
                t-Region--scrollBody
            ]
        }
        chart {
            type: stock
        }
        dataCursor {
            cursor: true
            behavior: smooth
        }
        settings {
            timeAxisType: auto
            zoomAndScroll: delayed
            initialZooming: first
        }
        overview {
            show: false
        }

        series prices (
            name: Prices
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select pricing_date as label,
                           opening_val,
                           least(opening_val, closing_val) - 1.5 as low,
                           greatest(opening_val, closing_val) + 1.5 as high,
                           closing_val,
                           volume
                      from (select trunc(sysdate) - 60 + level as pricing_date,
                                   round(50 + 6 * sin(level / 5), 2) as opening_val,
                                   round(50 + 6 * sin((level + 1) / 5), 2) as closing_val,
                                   100000 + mod(level * 7919, 50000) as volume
                              from dual
                           connect by level <= 60)
                     order by pricing_date
                    ```
            }
            columnMapping {
                label: LABEL
                open: OPENING_VAL
                low: LOW
                high: HIGH
                close: CLOSING_VAL
                volume: VOLUME
                labelTooltip: LABEL
            }
        )

        axis x (
            name: x
            value {
                format: datetimeLong
            }
            minorTicks {
                show: true
            }
        )

        axis y (
            name: y
            value {
                format: currency
                decimalPlaces: 0
                baselineScaling: min
            }
            appearance {
                position: end
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
    "sourceSha256": "41a4869f31aa69f612c37944959b0cbb9a82b3739a7e9f67739283dd4de3fb7b",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
