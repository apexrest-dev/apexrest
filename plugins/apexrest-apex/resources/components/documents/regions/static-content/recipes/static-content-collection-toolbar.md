# Collection Toolbar

Static content toolbar holding smart filters and a create button above a cards collection; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/static-content.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.collection-toolbar.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.collection-toolbar.md",
  "sourceSha256": "b2a424ee2e78f6da535b0307a23cb3103b95f4c303cd921185a87751dce105ae",
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
    name: Collection Toolbar
    alias: HOME
    title: Collection Toolbar
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region toolbar (
        name: Collection Toolbar
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )
    region filters (
        name: Filters
        type: smartFilters
        source {
            filteredRegion: @projects
        }
        layout {
            sequence: 10
            parentRegion: @toolbar
            slot: subRegions
            columnSpan: 9
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        filter P1_SEARCH (
            type: search
            label {
                label: Search projects
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: NAME
            }
        )
        filter P1_STATUS (
            type: checkboxGroup
            label {
                label: Status
            }
            layout {
                sequence: 20
            }
            lov {
                type: distinctValues
            }
            source {
                databaseColumn: STATUS
            }
        )
    )
    region toolbar-actions (
        name: Toolbar Actions
        type: staticContent
        layout {
            sequence: 20
            parentRegion: @toolbar
            slot: subRegions
            startNewRow: false
            columnSpan: 3
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )
    button create-project (
        buttonName: CREATE_PROJECT
        label: Create Project
        layout {
            sequence: 10
            region: @toolbar-actions
            slot: next
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
            }
        }
    )
    region projects (
        name: Projects
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 1 ID, 'Website refresh' NAME, 'Open' STATUS from dual union all
                select 2, 'Mobile release', 'Closed' from dual union all
                select 3, 'Data migration', 'Open' from dual
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: #DEFAULT#
        }
        card {
            primaryKeyColumn1: ID
        }
        title {
            advancedFormatting: false
            column: NAME
        }
        subtitle {
            advancedFormatting: false
            column: STATUS
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
    "sourceSha256": "c761dd5460d822615cbf49b596a70381885a11390a6f454e4787137d0b42a2f8",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
