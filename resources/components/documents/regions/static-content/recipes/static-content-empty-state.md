# Empty State Static Content

Static content empty state with hidden header, icon, message and a hot call-to-action button; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/static-content.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.empty-state.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.empty-state.md",
  "sourceSha256": "dec7a80234c5ecaf07be351eb4f1ca0d600d9ac9370ba0617d382a9f9d2a98c2",
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
    name: Empty State
    alias: HOME
    title: Empty State
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region empty-state (
        name: No Projects Yet
        type: staticContent
        source {
            htmlCode:
                ```html
                <div class="u-tC">
                    <span class="fa fa-folder-open-o fa-3x u-color-29-text" aria-hidden="true"></span>
                    <h2 class="t-Region-title">No projects yet</h2>
                    <p>Synthetic empty state. Create your first project to get started.</p>
                </div>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noBorder
            ]
        }
    )
    region empty-state-actions (
        name: Empty State Actions
        type: staticContent
        layout {
            sequence: 20
            slot: body
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
            region: @empty-state-actions
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
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "8453af8d6b0f96341ae45b8150d8b23fd9166326fbe8082a33e0dd379332d1a2",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
