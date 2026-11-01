# Percent Graph Columns

Classic report with percent graph columns including custom foreground and background colors; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/classic-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.percent-graph-columns.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.percent-graph-columns.md",
  "sourceSha256": "4888831c14dde8f28b7f7e2343a788f5b7977052a8d606b4942c66d67be09a6e",
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
    name: Percent Graph Columns
    alias: HOME
    title: Percent Graph Columns
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region progress (
        name: Project Progress
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Website refresh' PROJECT, 80 PCT_COMPLETE, 35 PCT_BUDGET from dual union all
                select 'Mobile release', 45, 60 from dual union all
                select 'Data migration', 10, 15 from dual
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--horizontalBorders
            ]
        }
        pagination {
            type: rowRangesXToYNoPagination
        }
        column PROJECT (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Project
            }
            layout {
                sequence: 10
            }
        )
        column PCT_COMPLETE (
            reportColumnQueryId: 2
            derivedColumn: N
            type: percentGraph
            heading {
                heading: Complete
                alignment: start
            }
            layout {
                sequence: 20
            }
        )
        column PCT_BUDGET (
            reportColumnQueryId: 3
            derivedColumn: N
            type: percentGraph
            heading {
                heading: Budget Used
                alignment: start
            }
            layout {
                sequence: 30
            }
            appearance {
                backgroundColor: #E5E5E5
                foregroundColor: #309FDB
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
    "sourceSha256": "155a0fbeb6e337e06d077df0c3e13f53b09b479383873161a7fe0dca27ef54a0",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
