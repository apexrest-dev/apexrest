# Popup LOV with Null Entry

Modal-dialog popup LOV with a labeled null entry over a dual SQL query; synthetic data and no business-table writes.

Status: ready.

Component: component:items/popup-lov.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/popup-lov/popup-lov.lov-display-null.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/popup-lov/popup-lov.lov-display-null.md",
  "sourceSha256": "16c17153634d9bbbeae610694e9b0b146074ab49fe35408402e99659139f3450",
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
    "P1_COUNTRY"
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
    name: Popup LOV with Null Entry
    alias: HOME
    title: Popup LOV with Null Entry
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
            htmlCode: <p>A modal-dialog popup LOV with a labeled null entry and automatic initial fetch.</p>
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
    pageItem P1_COUNTRY (
        type: popupLov
        label {
            label: Country
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Germany' d, 'DE' r from dual union all
                select 'Japan', 'JP' from dual union all
                select 'Brazil', 'BR' from dual
                ```
            displayNullValue: true
            nullDisplayValue: - No country -
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
            displayAs: modalDialog
            title: Select Country
            initialFetch: auto
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
    "sourceSha256": "95656ee6b45d11d9dbdeb5e247c95cdefcedaf6e53a35d9431dc5f59c81ec4cd",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
