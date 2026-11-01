# Bubble Chart

Native JET bubble chart mapping x, y and z (bubble size) columns with percent-formatted axes; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00011-bubble.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00011-bubble.apx",
  "sourceSha256": "2f5c587f6a661fb93904d689b0afe2ce031e0ec3588232bc2aa986f4fe8e4858",
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
    name: Bubble Chart
    alias: HOME
    title: Bubble Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region pension-contributions (
        name: Pension Contributions by Country
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
            type: bubble
        }
        title {
            title: Pension Contribution Revenues (% of GDP)
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

        series contributions (
            name: Contributions
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Austria' as country, 0.040 as employee, 0.050 as employer, 0.090 as total from dual union all
                    select 'Belgium', 0.025, 0.065, 0.090 from dual union all
                    select 'Canada', 0.020, 0.025, 0.045 from dual union all
                    select 'France', 0.040, 0.075, 0.115 from dual union all
                    select 'Germany', 0.060, 0.065, 0.125 from dual union all
                    select 'Japan', 0.055, 0.060, 0.115 from dual union all
                    select 'Spain', 0.020, 0.080, 0.100 from dual
                    ```
            }
            columnMapping {
                label: COUNTRY
                x: EMPLOYEE
                y: EMPLOYER
                z: TOTAL
            }
            label {
                show: true
                position: center
            }
        )

        axis x (
            name: x
            title: Employee Contribution (% of GDP)
            value {
                format: percent
                decimalPlaces: 1
                formatScaling: none
            }
            minorTicks {
                show: true
            }
        )

        axis y (
            name: y
            title: Employer Contribution (% of GDP)
            value {
                format: percent
                decimalPlaces: 1
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
    "sourceSha256": "a7be2ac8585dcb249c2116c211b97953ec5ac1310246a0487bd005d7c6cbaec6",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
