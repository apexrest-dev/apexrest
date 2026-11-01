# Interactive Report Search Bar Actions

Interactive report with create and refresh buttons in the search bar slot and a refresh dynamic action; synthetic data and no business-table writes.

Status: ready.

Component: component:reports/interactive-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-report/interactive-report.page-header-actions.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/interactive-report/interactive-report.page-header-actions.md",
  "sourceSha256": "27d4294f3ff8a98ffa60d46312df53b3996662360d84db00cc04b39b51b3b8fb",
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
    name: Report Search Bar Actions
    alias: HOME
    title: Report Search Bar Actions
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region customers (
        name: Customers
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select level CUSTOMER_ID,
                       'Customer ' || level CUSTOMER_NAME,
                       case mod(level, 2) when 0 then 'Retail' else 'Wholesale' end SEGMENT
                  from dual
               connect by level <= 12
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
            htmlDomId: customers_ir
        }
        column CUSTOMER_ID (
            type: plainText
            heading {
                heading: Customer Id
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
        column CUSTOMER_NAME (
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
        column SEGMENT (
            type: plainText
            heading {
                heading: Segment
            }
            layout {
                sequence: 30
            }
            source {
                dataType: STRING
            }
        )
    )
    button create-customer (
        buttonName: CREATE_CUSTOMER
        label: Create
        layout {
            sequence: 10
            region: @customers
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: #DEFAULT#
            icon: fa-plus
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
                clearCache: 1
            }
        }
    )
    button refresh-customers (
        buttonName: REFRESH_CUSTOMERS
        label: Refresh
        layout {
            sequence: 20
            region: @customers
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-refresh
        }
        behavior {
            action: definedByDynamicAction
        }
    )
    dynamicAction refresh-customers-click (
        name: Refresh customers
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @refresh-customers
        }
        action refresh-report (
            action: refresh
            affectedElements {
                selectionType: region
                region: @customers
            }
            execution {
                sequence: 10
                fireOnInit: false
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
    "sourceSha256": "de273cc7744a124599ed20751a5512446caa92fac4e05a69fa05f864eec8d14c",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
