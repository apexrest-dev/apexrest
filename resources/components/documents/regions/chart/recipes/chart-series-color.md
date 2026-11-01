# Chart Series Colors from SQL

Native JET pie chart whose slice colors come from a SQL column substituted into the series color attribute; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-series-color.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/chart/features/chart.feature-series-color.md",
  "sourceSha256": "e90b63ccddc93df74f476ad96ae93ec8620a8c686255a0b5e9dca6f69668d7a6",
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
    name: Chart Series Colors from SQL
    alias: HOME
    title: Chart Series Colors from SQL
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region fruit-prices (
        name: List Price by Product
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        chart {
            type: pie
        }
        chartLayout {
            height: 360
        }
        legend {
            position: end
        }

        series products (
            name: Products
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select product_name,
                           list_price,
                           case product_name
                             when 'Apples'     then 'green'
                             when 'Bananas'    then 'yellow'
                             when 'Grapes'     then 'purple'
                             when 'Cantaloupe' then 'orange'
                             when 'Dates'      then '#791b19'
                           end as series_color
                      from (select 'Apples' as product_name, 1.20 as list_price from dual union all
                            select 'Bananas', 0.60 from dual union all
                            select 'Grapes', 2.80 from dual union all
                            select 'Cantaloupe', 3.50 from dual union all
                            select 'Dates', 4.10 from dual)
                    ```
            }
            columnMapping {
                label: PRODUCT_NAME
                value: LIST_PRICE
            }
            appearance {
                color: &SERIES_COLOR.
            }
            label {
                show: true
                position: outsideSlice
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
    "sourceSha256": "7413eca949427495072c4f3f5700121d6ffeb0b9b875435cb574b2fb20c639f1",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
