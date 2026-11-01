# Checkbox Group in Columns

Checkbox group fed by a dual SQL query and laid out in four columns; synthetic data and no business-table writes.

Status: ready.

Component: component:items/checkbox-group.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/checkbox/checkbox.columns.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/checkbox/checkbox.columns.md",
  "sourceSha256": "fdc9372a687dc5731eb0313e14d25b8bea30dfbfc356876e40cc5152470f396d",
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
  "submittedItems": [
    "P1_DAYS"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename the region and item identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic values only with authorized project data and keep the item settings shown here.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Checkbox Group in Columns
    alias: HOME
    title: Checkbox Group in Columns
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region form (
        name: Form
        type: staticContent
        source {
            htmlCode: <p>A weekday checkbox group laid out in four columns.</p>
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
    pageItem P1_DAYS (
        type: checkboxGroup
        label {
            label: Working Days
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select to_char(date '2024-01-01' + level - 1, 'fmDay', 'nls_date_language=english') d,
                       to_char(level) r
                  from dual
                connect by level <= 7
                ```
        }
        layout {
            sequence: 10
            region: @form
            slot: regionBody
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        settings {
            noOfCols: 4
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
    "sourceSha256": "6064b51328226d33be8c715f38c052a1b88479c421216e1b0b910007706a653e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
