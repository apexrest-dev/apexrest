# Region Display Selector Icons

Region display selector in single-region mode with region icons, no Show All and session persistence; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/region-display-selector.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/region-display-selector/region-display-selector.permutations.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/region-display-selector/region-display-selector.permutations.md",
  "sourceSha256": "e5a3c30a9e6a9a0c776b6b26134d133571f2d671c72b8f9796da6a8a94e98a5f",
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
    name: Region Display Selector Icons
    alias: HOME
    title: Region Display Selector Icons
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region section-selector (
        name: Section Selector
        type: regionDisplaySelector
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: section-selector
        }
        settings {
            mode: viewSingleRegion
            displayRegionIcons: true
            includeShowAll: false
            rememberSelection: bySession
        }
    )
    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>Synthetic overview content.</p>
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
            icon: fa-home
        }
        advanced {
            htmlDomId: overview
            regionDisplaySelector: true
        }
    )
    region activity (
        name: Activity
        type: staticContent
        source {
            htmlCode: <p>Synthetic activity content.</p>
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
            icon: fa-clock-o
        }
        advanced {
            htmlDomId: activity
            regionDisplaySelector: true
        }
    )
    region settings (
        name: Settings
        type: staticContent
        source {
            htmlCode: <p>Synthetic settings content.</p>
        }
        layout {
            sequence: 40
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
            icon: fa-gear
        }
        advanced {
            htmlDomId: settings
            regionDisplaySelector: true
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
    "sourceSha256": "590b5be2c71de5f2c423b17352fd608e205dcee1831cc1930058c4d7567f5eae",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
