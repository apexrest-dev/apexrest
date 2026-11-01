# Bar Chart 3D Effect

Native JET bar chart rendered with the threeDEffect style default through initialization JavaScript; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00004-pie.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00004-pie.apx",
  "sourceSha256": "98b50e17b3d28a783df38e87b6a00670c28243cc65330d292385219398fff61b",
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
    name: Bar Chart 3D Effect
    alias: HOME
    title: Bar Chart 3D Effect
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region quarterly-revenue (
        name: Quarterly Revenue (3D Effect)
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
            height: 380
        }
        legend {
            position: top
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( options ) {
                    // Add the Oracle JET 3D effect to the existing chart style defaults.
                    options.styleDefaults = $.extend( options.styleDefaults, { threeDEffect: "on", barGapRatio: 0.4 } );
                    return options;
                }
                ```
        }

        series this-year (
            name: This Year
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Q1' as quarter, 182000 as revenue from dual union all
                    select 'Q2', 205000 from dual union all
                    select 'Q3', 198000 from dual union all
                    select 'Q4', 251000 from dual
                    ```
            }
            columnMapping {
                label: QUARTER
                value: REVENUE
            }
        )

        series last-year (
            name: Last Year
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Q1' as quarter, 165000 as revenue from dual union all
                    select 'Q2', 171000 from dual union all
                    select 'Q3', 189000 from dual union all
                    select 'Q4', 220000 from dual
                    ```
            }
            columnMapping {
                label: QUARTER
                value: REVENUE
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
            title: Revenue (USD)
            value {
                format: currency
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
    "sourceSha256": "e322762617dad4e8eebd35daece0d5f3f7aba9ad273b74888c08ea83b5f5729e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
