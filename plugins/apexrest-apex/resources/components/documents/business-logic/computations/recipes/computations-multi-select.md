# Initialize a multi-value selection

Initialize a multi-value selection with all page items and event handlers included; synthetic data and no business-table writes.

Status: ready.

Component: component:business-logic/computations.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/b94ccf4dec34b27859c2378fa71ba2bad884f2fe/apex/apexlang/templates/business-logic/computations/computations.sql-multi.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "b94ccf4dec34b27859c2378fa71ba2bad884f2fe",
  "path": "apex/apexlang/templates/business-logic/computations/computations.sql-multi.md",
  "sourceSha256": "d71ae41f29d40fccf451ff841af5141aa58081c7814ca3a33659c9630f36453a",
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
    name: Initialize a multi-value selection
    alias: HOME
    title: Initialize a multi-value selection
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region controls (
        name: Controls
        type: staticContent
        source {
            htmlCode: <p>The multi-select is initialized from two rows; the query returns one selected value per row.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_OUTPUT (
        type: selectMany
        label {
            label: Initial selections
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        settings {
            infiniteScroll: false
        }
        lov {
            type: staticValues
            staticValues: STATIC:Alpha;A,Beta;B,Gamma;C
        }
    )
    computation derive (
        itemName: P1_OUTPUT
        computation {
            type: sqlQueryMultipleValues
            sqlQuery:
                ```sql
                select CODE from (select 'A' CODE from dual union all select 'C' from dual) order by CODE
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "cac2419c8064ad0435f78448ea28f4f25973dc7bc5fce6a62c41fb3e99b18011",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
