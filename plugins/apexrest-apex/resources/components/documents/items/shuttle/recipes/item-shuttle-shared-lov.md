# Shuttle with Shared LOV

Shuttle that references a shared static LOV and shows only moving controls; synthetic data and no business-table writes.

Status: ready.

Component: component:items/shuttle.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/shuttle/shuttle.lov-shared.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/shuttle/shuttle.lov-shared.md",
  "sourceSha256": "1dbf73e7e327350b1cf235c82f71f5ee6fa900799deb7b47328bb0b0dc4ab460",
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
    "P1_SKILLS"
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
    name: Shuttle with Shared LOV
    alias: HOME
    title: Shuttle with Shared LOV
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
            htmlCode: <p>A shuttle that references a shared static list of values and limits controls to moving.</p>
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
    pageItem P1_SKILLS (
        type: shuttle
        label {
            label: Skills
        }
        lov {
            type: sharedComponent
            lov: @example-skills
        }
        layout {
            sequence: 10
            region: @form
            slot: regionBody
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 6
        }
        settings {
            showControls: movingOnly
        }
    )
)

```

## shared-components/lovs.apx

```apexlang
lov example-skills (
    name: EXAMPLE_SKILLS
    source {
        location: staticValues
    }

    entry sql (
        sequence: 10
        display: SQL
        return: SQL
    )

    entry plsql (
        sequence: 20
        display: PL/SQL
        return: PLSQL
    )

    entry javascript (
        sequence: 30
        display: JavaScript
        return: JS
    )

    entry css (
        sequence: 40
        display: CSS
        return: CSS
    )

)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "dd2d86d97c3d6cd09d0fd13d4076648cd1f1f6a3f61ce653e7f851a2e9db151d",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
