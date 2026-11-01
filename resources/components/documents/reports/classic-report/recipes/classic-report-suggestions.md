# Suggestions List Report

Single-column classic report rendering a simple list of suggestion links; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/classic-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.suggestions-simple-list.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.suggestions-simple-list.md",
  "sourceSha256": "4e3287c5f14253af1a776d6abe75cb12607270f09a9b7a0350bac9bfa7fd0e23",
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
    name: Suggestions List
    alias: HOME
    title: Suggestions List
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region suggestions (
        name: Suggested Searches
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Open orders this week' SUGGESTION from dual union all
                select 'Customers without orders' from dual union all
                select 'Top products by revenue' from dual
                ```
        }
        layout {
            sequence: 10
            slot: body
            columnSpan: 4
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
        messages {
            whenNoDataFound: No suggestions
        }
        column SUGGESTION (
            reportColumnQueryId: 1
            derivedColumn: N
            type: link
            heading {
                heading: Suggestion
            }
            layout {
                sequence: 10
            }
            link {
                target: {
                    page: 1
                }
                linkText: #SUGGESTION#
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
    "sourceSha256": "d0e511419e8825dbb9f0a4df3424b1a71dd23fb0e4d29e3b8747c95c348da50b",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
