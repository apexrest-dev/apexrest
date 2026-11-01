# Stacked Horizontal Bar Chart

Native JET horizontal stacked bar chart that derives series from a seriesName column of the region source; synthetic data.

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
    name: Stacked Horizontal Bar Chart
    alias: HOME
    title: Stacked Horizontal Bar Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region budget-by-project (
        name: Task Budget by Project
        type: chart
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Website Redesign' as label, 42000 as value, 'Under budget' as series from dual union all
                select 'Website Redesign', 8000, 'Over budget' from dual union all
                select 'CRM Migration', 30000, 'Under budget' from dual union all
                select 'CRM Migration', 21000, 'Over budget' from dual union all
                select 'Data Warehouse', 55000, 'Under budget' from dual union all
                select 'Data Warehouse', 4000, 'Over budget' from dual union all
                select 'Mobile App', 18000, 'Under budget' from dual union all
                select 'Mobile App', 12500, 'Over budget' from dual
                ```
        }
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
            type: bar
        }
        chartAppearance {
            orientation: horizontal
            stack: true
        }
        chartLayout {
            height: 400
        }
        dataCursor {
            dimOnHover: false
        }
        animation {
            onDataChange: none
        }
        legend {
            position: top
            hideAndShowBehavior: none
        }

        series budget-status (
            name: Budget Status
            execution {
                sequence: 10
            }
            source {
                location: regionSource
            }
            columnMapping {
                seriesName: SERIES
                label: LABEL
                value: VALUE
                labelTooltip: LABEL
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
            title: Budget (USD)
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
    "sourceSha256": "d3c4da7d6089d3a16ad7efa352a15450555189d01c63630b5e007616e1efadb9",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
