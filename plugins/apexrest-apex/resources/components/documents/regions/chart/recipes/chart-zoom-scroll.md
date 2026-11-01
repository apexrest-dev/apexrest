# Chart Zoom and Scroll

Native JET line chart with time axis, delayed zoom and scroll, initial zooming, overview and data cursor; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-zoom-scroll.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-zoom-scroll.md",
  "sourceSha256": "523e9d30f7b897ee1116d0d0fb649a3aed3a1075218bf293047da8bb1cdc7c32",
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
    name: Chart Zoom and Scroll
    alias: HOME
    title: Chart Zoom and Scroll
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region daily-visits (
        name: Daily Site Visits
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
            type: line
        }
        chartLayout {
            height: 400
        }
        dataCursor {
            cursor: true
            behavior: smooth
        }
        settings {
            timeAxisType: enabled
            zoomAndScroll: delayed
            initialZooming: first
        }
        overview {
            show: true
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

        series visits (
            name: Visits
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select trunc(sysdate) - 180 + level as visit_date,
                           round(1200 + 300 * sin(level / 7) + mod(level * 37, 150)) as visits
                      from dual
                   connect by level <= 180
                     order by visit_date
                    ```
            }
            columnMapping {
                label: VISIT_DATE
                value: VISITS
            }
        )

        axis x (
            name: x
            value {
                format: dateMedium
            }
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            title: Visits
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
    "sourceSha256": "3713c5773443831bf9feca2e682d700031aada4bc4b4c395a52debdec531afbe",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
