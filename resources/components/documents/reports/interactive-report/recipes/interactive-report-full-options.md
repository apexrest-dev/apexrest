# Interactive Report Options

Interactive report with custom row link, download formats, messages, pagination, actions-menu and saved-report defaults; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/interactive-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-report/interactive-report.standard.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-report/interactive-report.standard.md",
  "sourceSha256": "263eaa80a005b6f8ba2be346f2c9c297b7ae743cda57a194e8dcbc0cd585c1d6",
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
    name: Interactive Report Options
    alias: HOME
    title: Interactive Report Options
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    pageItem P1_ORDER_ID (
        type: hidden
        layout {
            sequence: 10
            slot: body
        }
    )
    region orders (
        name: Orders
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select level ORDER_ID,
                       'Customer ' || level CUSTOMER,
                       case mod(level, 3) when 0 then 'Closed' when 1 then 'Open' else 'Pending' end STATUS,
                       level * 125.5 ORDER_TOTAL,
                       trunc(sysdate) - level ORDER_DATE
                  from dual
               connect by level <= 25
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: orders_ir
        }
        link {
            linkColumn: customTarget
            target: {
                page: 1
                items: {
                    P1_ORDER_ID: #ORDER_ID#
                }
                clearCache: 1
            }
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToYOfZ
        }
        performance {
            maxRowsToProcess: 10000
        }
        messages {
            whenNoDataFound: No orders found
            whenMoreDataFound: More than 10,000 orders found. Refine the filter.
        }
        actionsMenu {
            savePublicReport: false
        }
        download {
            formats: [
                csv
                html
            ]
        }
        detailView {
            show: false
        }
        column ORDER_ID (
            type: plainText
            heading {
                heading: Order
                alignment: end
            }
            layout {
                sequence: 10
                columnAlignment: end
            }
            source {
                dataType: NUMBER
            }
        )
        column CUSTOMER (
            type: plainText
            heading {
                heading: Customer
            }
            layout {
                sequence: 20
            }
            source {
                dataType: STRING
            }
        )
        column STATUS (
            type: plainText
            heading {
                heading: Status
            }
            layout {
                sequence: 30
            }
            source {
                dataType: STRING
            }
        )
        column ORDER_TOTAL (
            type: plainText
            heading {
                heading: Total
                alignment: end
            }
            layout {
                sequence: 40
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G990D00
            }
            source {
                dataType: NUMBER
            }
        )
        column ORDER_DATE (
            type: plainText
            heading {
                heading: Order Date
            }
            layout {
                sequence: 50
            }
            appearance {
                formatMask: DD-MON-YYYY
            }
            source {
                dataType: DATE
            }
        )
        savedReport primary (
            visibility: primaryDefault
            view {
                rowsPerPage: 10
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
    "sourceSha256": "e20570c680baba8c4d0aa352ea46b7f9210e51c9d961a9107a2fd27a785d1e50",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
