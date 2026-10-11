# Native Area Chart

Native Area Chart with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/region-components/chart/chart.area.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/region-components/chart/chart.area.md",
  "sourceSha256": "7dcbbda3fe6864e3f76451422c04fd69bed150afd4fdae83d60b6f47e6e4b96b",
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
- Rename region, button and dynamic-action identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and retain every submitted item and column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Native Area Chart
    alias: HOME
    title: Native Area Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region example (
            name: Synthetic Area Chart
            type: chart
            layout {
                sequence: 10
                slot: body
            }
            appearance {
                template: @/standard
                templateOptions: #DEFAULT#
            }
            chart {
                type: area
            }
            axis x (
                name: x
            )
            axis y (
                name: y
            )
            series values (
                name: Example Values
                execution {
                    sequence: 10
                }
                source {
                    type: sqlQuery
                    sqlQuery:
                        ```sql
                        select 'Alpha' LABEL, 12 VALUE from dual union all select 'Beta', 7 from dual
                        ```
                }
                columnMapping {
                    label: LABEL
                    value: VALUE
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
    "sourceSha256": "4903dbc0302a97a179350a1fe8b85ab2fb6b01ca88405d52f17626db73c3d30c",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
