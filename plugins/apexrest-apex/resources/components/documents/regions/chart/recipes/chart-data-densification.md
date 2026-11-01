# Chart Data Densification

Native JET bar chart whose SQL fills missing months with zero values before plotting; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-data-densification.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-data-densification.md",
  "sourceSha256": "e74be120ab6080c365149096a74e061f2cc3963d2a2c0e56823c5aa5e89a8e2a",
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
    name: Chart Data Densification
    alias: HOME
    title: Chart Data Densification
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region monthly-sales (
        name: Monthly Sales (Gaps Filled)
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
        multiSeriesChartData {
            sortOrder: labelAsc
        }
        animation {
            onDataChange: none
        }
        legend {
            hideAndShowBehavior: none
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
                    with monthly_sales as (
                        select add_months(trunc(sysdate, 'MM'), -11) as month_start, 4200 as sales from dual union all
                        select add_months(trunc(sysdate, 'MM'), -9), 3900 from dual union all
                        select add_months(trunc(sysdate, 'MM'), -8), 5100 from dual union all
                        select add_months(trunc(sysdate, 'MM'), -5), 6100 from dual union all
                        select add_months(trunc(sysdate, 'MM'), -2), 4800 from dual union all
                        select trunc(sysdate, 'MM'), 5300 from dual
                    ),
                    range_of_months as (
                        select add_months(min_month, level - 1) as month_start
                          from (select min(month_start) as min_month, max(month_start) as max_month from monthly_sales)
                       connect by level <= months_between(max_month, min_month) + 1
                    )
                    select to_char(r.month_start, 'YYYY-MM') as month_label,
                           nvl(m.sales, 0) as sales
                      from range_of_months r
                      left join monthly_sales m on m.month_start = r.month_start
                     order by r.month_start
                    ```
            }
            columnMapping {
                label: MONTH_LABEL
                value: SALES
            }
            label {
                show: true
            }
        )

        axis x (
            name: x
            title: Month
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            title: Sales (USD)
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
    "sourceSha256": "a2f1facddcdb9d3c40deb2650a90a98dff256b1fcf3d2ecaf467f09a7bc3085d",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
