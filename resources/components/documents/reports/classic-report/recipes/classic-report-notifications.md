# Notifications Report

Classic report using the Alerts report template to list notifications; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/classic-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.ao-notifications.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/classic-report/classic-report.ao-notifications.md",
  "sourceSha256": "a90cd044ee86899592c52e0fcfbd2b17e61468e463192bd6557ec8628f441a47",
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
    name: Notifications Report
    alias: HOME
    title: Notifications Report
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region notifications (
        name: Notifications
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Maintenance window' ALERT_TITLE, 'Synthetic: the system will be unavailable Sunday 02:00-03:00.' ALERT_DESC, 'warning' ALERT_TYPE from dual union all
                select 'New release', 'Synthetic: version 2.0 is now available.', 'success' from dual
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
            template: @/alerts
            templateOptions: #DEFAULT#
        }
        pagination {
            type: rowRangesXToYNoPagination
        }
        messages {
            whenNoDataFound: No notifications
        }
        column ALERT_TITLE (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Title
            }
            layout {
                sequence: 10
            }
        )
        column ALERT_DESC (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Description
            }
            layout {
                sequence: 20
            }
        )
        column ALERT_TYPE (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Type
            }
            layout {
                sequence: 30
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
    "sourceSha256": "abccd8a6e92aa92a489cbaf439c12c915ed88ba8c6a295c6783fe56d5a8091e3",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
