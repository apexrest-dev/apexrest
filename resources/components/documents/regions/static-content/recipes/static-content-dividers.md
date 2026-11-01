# Stacked Regions with Dividers

Static content parent region with stacked sub regions separated by region dividers; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/static-content.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.dividers.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.dividers.md",
  "sourceSha256": "fd507b1bb24c6893182b58e442016bbb1954e66b667e5ca087117ad09e5f8796",
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
    name: Stacked Regions with Dividers
    alias: HOME
    title: Stacked Regions with Dividers
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region settings (
        name: Account Settings
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
            ]
        }
    )
    region profile (
        name: Profile
        type: staticContent
        source {
            htmlCode: <p>Synthetic profile section.</p>
        }
        layout {
            sequence: 10
            parentRegion: @settings
            slot: subRegions
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--stacked
                t-Region--scrollBody
            ]
        }
    )
    region notifications (
        name: Notifications
        type: staticContent
        source {
            htmlCode: <p>Synthetic notifications section.</p>
        }
        layout {
            sequence: 20
            parentRegion: @settings
            slot: subRegions
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--stacked
                t-Region--scrollBody
            ]
        }
    )
    region privacy (
        name: Privacy
        type: staticContent
        source {
            htmlCode: <p>Synthetic privacy section.</p>
        }
        layout {
            sequence: 30
            parentRegion: @settings
            slot: subRegions
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--stacked
                t-Region--scrollBody
            ]
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
    "sourceSha256": "b3316338f2156a37163db8363a82aa003d92e73303562f5f4e4d5cab9b6426a8",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
