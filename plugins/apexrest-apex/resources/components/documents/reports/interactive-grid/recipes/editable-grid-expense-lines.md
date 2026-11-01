# Editable Grid with Typed Columns

Editable Interactive Grid over synthetic data with select-list, date-picker, number and static LOV columns, row actions and a saved primary report.

Status: ready.

Component: component:reports/interactive-grid.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/forms-patterns/apexlang/sample-forms/pages/p00011-fp-04-editable-grid.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/forms-patterns/apexlang/sample-forms/pages/p00011-fp-04-editable-grid.apx",
  "sourceSha256": "bbddd9644bf6d089315f0bdcf111b778af1e0fa8688effe3234ff588fdedc5df",
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
- The grid reads DUAL rows and has no Interactive Grid Automatic Row Processing, so Save does not persist anything.
- Preserve the target application authentication and authorization.
- To save, point the grid at an authorized project table and add an interactiveGridAutoRowProcessing process for this region.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Editable Expense Grid
    alias: HOME
    title: Editable Expense Grid
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region title-bar (
        name: Editable Expense Grid
        type: staticContent
        layout {
            sequence: 1
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useRegionTitle
            ]
        }
    )
    region expenses (
        name: Expense Lines
        type: interactiveGrid
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select l.*
                  from (
                    select 1 REPORT_LINE_ID, 10 REPORT_ID, 1 CATEGORY_ID, date '2026-10-02' EXPENSE_DATE, 'Metro Taxi' MERCHANT, 'Airport transfer' DESCRIPTION, 42.5 AMOUNT, 'Y' REIMBURSABLE_YN from dual union all
                    select 2, 10, 2, date '2026-10-02', 'Harbor Hotel', 'Two nights', 318.0, 'Y' from dual union all
                    select 3, 10, 3, date '2026-10-03', 'Cafe Lumen', 'Team lunch', 64.2, 'Y' from dual union all
                    select 4, 20, 4, date '2026-10-11', 'Office Depot', 'Notebook and pens', 18.75, 'N' from dual union all
                    select 5, 20, 1, date '2026-10-12', 'City Rail', 'Return ticket', 27.0, 'Y' from dual
                       ) l
                 order by l.EXPENSE_DATE desc, l.REPORT_LINE_ID desc
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
            htmlDomId: expense-grid
        }
        edit {
            enabled: true
            allowedOperations: [
                add
                update
                delete
            ]
        }
        pagination {
            type: page
        }
        toolbar {
            controls: [
                searchCol
                searchField
                actionsMenu
                resetButton
                saveButton
            ]
        }

        savedReport PRIMARY (
            visibility: primary
            view {
                default: grid
            }
            singleRowView {
                displayedColumns: true
            }
            displayColumn (
                column: @APEX$ROW_ACTION
                layout {
                    sequence: 10
                }
            )
            displayColumn (
                column: @REPORT_LINE_ID
                layout {
                    sequence: 20
                }
            )
            displayColumn (
                column: @REPORT_ID
                layout {
                    sequence: 30
                }
            )
            displayColumn (
                column: @CATEGORY_ID
                layout {
                    sequence: 40
                }
            )
            displayColumn (
                column: @EXPENSE_DATE
                layout {
                    sequence: 50
                }
            )
            displayColumn (
                column: @MERCHANT
                layout {
                    sequence: 60
                }
            )
            displayColumn (
                column: @DESCRIPTION
                layout {
                    sequence: 70
                }
            )
            displayColumn (
                column: @AMOUNT
                layout {
                    sequence: 80
                }
            )
            displayColumn (
                column: @REIMBURSABLE_YN
                layout {
                    sequence: 90
                }
            )
        )
        column APEX$ROW_ACTION (
            type: actionsMenu
            layout {
                sequence: 10
            }
        )
        column APEX$ROW_SELECTOR (
            type: rowSelector
            layout {
                sequence: 20
            }
        )
        column REPORT_LINE_ID (
            type: hidden
            heading {
                heading: Expense ID
            }
            layout {
                sequence: 30
            }
            source {
                databaseColumn: REPORT_LINE_ID
                dataType: number
                primaryKey: true
            }
        )
        column REPORT_ID (
            type: selectList
            heading {
                heading: Expense Report
            }
            lov {
                type: sqlQuery
                sqlQuery: select 'Berlin client visit (EUR)' d, 10 r from dual union all select 'October office supplies (USD)' d, 20 r from dual
                displayExtraValues: false
                nullDisplayValue: - Select -
            }
            layout {
                sequence: 40
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: REPORT_ID
                dataType: number
            }
        )
        column CATEGORY_ID (
            type: selectList
            heading {
                heading: Category
            }
            lov {
                type: staticValues
                staticValues: STATIC2:Transport;1,Lodging;2,Meals;3,Supplies;4
                displayExtraValues: false
                nullDisplayValue: - Select -
            }
            layout {
                sequence: 50
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: CATEGORY_ID
                dataType: number
            }
        )
        column EXPENSE_DATE (
            type: datePicker
            heading {
                heading: Expense Date
            }
            layout {
                sequence: 60
            }
            appearance {
                formatMask: YYYY-MM-DD
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: EXPENSE_DATE
                dataType: date
            }
        )
        column MERCHANT (
            type: textField
            heading {
                heading: Merchant
            }
            layout {
                sequence: 70
            }
            validation {
                valueRequired: true
                maxLength: 150
            }
            source {
                databaseColumn: MERCHANT
                dataType: varchar2
            }
        )
        column DESCRIPTION (
            type: textField
            heading {
                heading: Description
            }
            layout {
                sequence: 80
            }
            validation {
                maxLength: 500
            }
            source {
                databaseColumn: DESCRIPTION
                dataType: varchar2
            }
        )
        column AMOUNT (
            type: numberField
            heading {
                heading: Amount
            }
            layout {
                sequence: 90
            }
            appearance {
                formatMask: FM9G999G999G990D00
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: AMOUNT
                dataType: number
            }
        )
        column REIMBURSABLE_YN (
            type: selectList
            heading {
                heading: Reimbursable
            }
            lov {
                type: staticValues
                staticValues: STATIC:Yes;Y,No;N
                displayNullValue: false
            }
            layout {
                sequence: 100
            }
            validation {
                valueRequired: true
            }
            source {
                databaseColumn: REIMBURSABLE_YN
                dataType: varchar2
            }
            default {
                type: static
                staticValue: Y
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
    "sourceSha256": "c13ea8dbdf3c57bc53e736f87026b3e3dc71283e5ba29a328a15316ff34225c6",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
