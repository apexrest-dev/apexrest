# Contextual Info Rows

Classic report using the Contextual Info report template with one metric per row and a hidden-header, no-UI region; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/contextual-info.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.contextual-info-row-based.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.contextual-info-row-based.md",
  "sourceSha256": "2dee89286f681611e1b0229aa98d43831c7b7d63dcb0ba1a8c7735241254b344",
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
    name: Contextual Info Rows
    alias: HOME
    title: Contextual Info Rows
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region metrics (
        name: Order Metrics
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Open orders' METRIC, '42' VALUE from dual union all
                select 'Shipped today', '17' from dual union all
                select 'Average lead time', '3.2 days' from dual
                ```
        }
        layout {
            sequence: 10
            slot: body
            columnSpan: 4
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noUI
            ]
        }
        componentAppearance {
            template: @/contextual-info
            templateOptions: #DEFAULT#
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToYNoPagination
        }
        messages {
            whenNoDataFound: No metrics available
        }
        column METRIC (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Metric
            }
            layout {
                sequence: 10
            }
        )
        column VALUE (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Value
            }
            layout {
                sequence: 20
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
    "sourceSha256": "9c287dc0f2c6c842c0c82be68361f89039d34a66501d8a06074732bfa5c96f9d",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
