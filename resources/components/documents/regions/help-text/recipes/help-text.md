# Help Text Region

Help Text region that renders page-level help with item inline help and help text; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/help-text.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/help-text/help-text.standard.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/help-text/help-text.standard.md",
  "sourceSha256": "ee0cf78c888fe5249bd5bbd4de49b62c3b48177fa469ddf753b7c0d1dfe9136a",
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
    name: Help Text Region
    alias: HOME
    title: Help Text Region
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    help {
        helpText:
            ```html
            <p>This page summarizes synthetic order activity.</p>
            <p>Use the <strong>Status</strong> item to narrow the list. Values are illustrative only.</p>
            ```
    }
    region overview (
        name: Order Activity
        type: staticContent
        source {
            htmlCode: <p>Synthetic content. Open the help region below for page-level guidance.</p>
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
        type: textField
        label {
            label: Status
        }
        layout {
            sequence: 10
            region: @overview
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        help {
            inlineHelpText: Enter Open or Closed.
            helpText: Status filters the synthetic activity list. Leave it empty to show every row.
        }
    )
    region page-help (
        name: Page Help
        type: helpText
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        headerAndFooter {
            headerText: <p>About this page</p>
            footerText: <p>Contact your administrator for more help.</p>
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
    "sourceSha256": "94c233cab4f6c11abadd9a1dff96fc39b6950d0721682324a48ab2d1a59a0ed8",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
