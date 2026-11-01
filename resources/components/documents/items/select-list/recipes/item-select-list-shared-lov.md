# Select List with Shared LOV

Select list that references a shared static LOV with a labeled null entry; synthetic data and no business-table writes.

Status: ready.

Component: component:items/select-list.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/select-list/select-list.lov-shared.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/select-list/select-list.lov-shared.md",
  "sourceSha256": "92253faf4a42ce35161fb86a813ee3990f75a554fae16a879195ca927ce6c4e7",
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
    "P1_STATUS"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename the region and item identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Merge the shared LOV into the target shared-components/lovs.apx under a unique static ID before replacing its synthetic entries.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Select List with Shared LOV
    alias: HOME
    title: Select List with Shared LOV
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
            htmlCode: <p>A select list that references a shared static list of values.</p>
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
    pageItem P1_STATUS (
        type: selectList
        label {
            label: Status
        }
        lov {
            type: sharedComponent
            lov: @example-statuses
            displayNullValue: true
            nullDisplayValue: - Select status -
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
    )
)

```

## shared-components/lovs.apx

```apexlang
lov example-statuses (
    name: EXAMPLE_STATUSES
    source {
        location: staticValues
    }

    entry open (
        sequence: 10
        display: Open
        return: OPEN
    )

    entry in-progress (
        sequence: 20
        display: In Progress
        return: IN_PROGRESS
    )

    entry closed (
        sequence: 30
        display: Closed
        return: CLOSED
    )

)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "8f1de8eedb73f8e196e87d1d6c531134da4b68ded06f7574b4db1ca3343820d9",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
