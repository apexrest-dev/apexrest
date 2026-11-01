# Status Meter Gauge

Native JET circular status meter gauge with a max value, threshold colors and value formatting; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00005-status-meter-gauge.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00005-status-meter-gauge.apx",
  "sourceSha256": "be509f3c1acdf6e214f6be7dd8fe40f5bebea7870e89627ee11e8c84e97d82c3",
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
    name: Status Meter Gauge
    alias: HOME
    title: Status Meter Gauge
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region ticket-resolution (
        name: Tickets Resolved This Week
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
            type: statusMeterGauge
        }
        chartLayout {
            maxWidth: 300
            height: 300
        }
        gauge {
            orientation: circular
            indicatorSize: 0.5
            innerRadius: 0.7
            startAngle: 180
            angleExtent: 180
        }
        value {
            format: decimal
            decimalPlaces: 0
            formatScaling: none
        }

        series resolved (
            name: Resolved
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Resolved' as label, 14 as value, 20 as max_value from dual
                    ```
            }
            columnMapping {
                label: LABEL
                value: VALUE
                maxValue: MAX_VALUE
            }
            thresholds {
                values: 8,14,20
                colors: #D63B25,#F5C342,#2E8540
                display: all
            }
            label {
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
    "sourceSha256": "33f32b97812d0cc9dc565e21d5dbb7e5db341d8c76078493b82d20a3602b9538",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
