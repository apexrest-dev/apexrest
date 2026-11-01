# Combination Chart (Bar, Line, Area)

Native JET combination chart mixing bar, line and area series with a secondary Y2 axis; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00006-dashboard.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00006-dashboard.apx",
  "sourceSha256": "063490e4c8ff00a3ff04916f3f7ac95280b079c72d1360b4e94caf3bfbe2b503",
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
    name: Combination Chart (Bar, Line, Area)
    alias: HOME
    title: Combination Chart (Bar, Line, Area)
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region store-orders (
        name: Orders by Store
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h320
                t-Region--scrollBody
            ]
        }
        chart {
            type: combination
        }
        legend {
            position: end
            hideAndShowBehavior: noRescaling
        }

        series north-store (
            name: North Store
            type: bar
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Apples' as product_name, 45 as quantity from dual union all
                    select 'Bananas', 30 from dual union all
                    select 'Grapes', 22 from dual union all
                    select 'Oranges', 38 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
            }
            label {
                show: true
                position: center
            }
        )

        series south-store (
            name: South Store
            type: bar
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Apples' as product_name, 28 as quantity from dual union all
                    select 'Bananas', 41 from dual union all
                    select 'Grapes', 19 from dual union all
                    select 'Oranges', 26 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
            }
        )

        series target (
            name: Weekly Target
            type: line
            execution {
                sequence: 30
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Apples' as product_name, 40 as quantity from dual union all
                    select 'Bananas', 40 from dual union all
                    select 'Grapes', 25 from dual union all
                    select 'Oranges', 30 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: QUANTITY
            }
            label {
                show: true
                position: aboveMarker
            }
        )

        series online-share (
            name: Online Share
            type: area
            execution {
                sequence: 40
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Apples' as product_name, 0.35 as share from dual union all
                    select 'Bananas', 0.20 from dual union all
                    select 'Grapes', 0.55 from dual union all
                    select 'Oranges', 0.30 from dual
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: SHARE
            }
            appearance {
                assignedToY2Axis: true
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
            title: Quantity
            minorTicks {
                show: false
            }
        )

        axis y-2 (
            name: y2
            title: Online Share
            value {
                format: percent
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
    "sourceSha256": "99e07d12499216a78787a17e21fdc3e9b516afe8d7409e8d95b02fcbbafe81b3",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
