# Secondary Interactive Report

Compact secondary interactive report with alternate pagination, row limit, hidden key column and five-row saved report; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/interactive-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-report/interactive-report.secondary.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-report/interactive-report.secondary.md",
  "sourceSha256": "5891981662cfb01415f7d53560a3b8f3a354dad7d6b7301a96de8f6716ef0dae",
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
    name: Secondary Interactive Report
    alias: HOME
    title: Secondary Interactive Report
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region recent-activity (
        name: Recent Activity
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select level ACTIVITY_ID,
                       'Activity ' || level ACTIVITY,
                       systimestamp - numtodsinterval(level, 'HOUR') LOGGED_AT
                  from dual
               connect by level <= 30
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: recent_activity_ir
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 500
        }
        messages {
            whenNoDataFound: No recent activity
        }
        column ACTIVITY_ID (
            type: hidden
            heading {
                heading: Activity Id
            }
            layout {
                sequence: 10
            }
            source {
                dataType: NUMBER
            }
        )
        column ACTIVITY (
            type: plainText
            heading {
                heading: Activity
            }
            layout {
                sequence: 20
            }
            source {
                dataType: STRING
            }
        )
        column LOGGED_AT (
            type: plainText
            heading {
                heading: Logged
            }
            layout {
                sequence: 30
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: TIMESTAMP
            }
        )
        savedReport primary (
            visibility: primaryDefault
            view {
                rowsPerPage: 5
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
    "sourceSha256": "c970dabc60ec44b59154815e6ddacb77543026d0287e1dc791829dad8a64a59f",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
