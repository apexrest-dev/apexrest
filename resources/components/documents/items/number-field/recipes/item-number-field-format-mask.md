# Number Field with Format Mask

Required number field with a currency format mask, min/max range and end alignment; synthetic data and no business-table writes.

Status: ready.

Component: component:items/number-field.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/number-field/number-field.format-mask.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/number-field/number-field.format-mask.md",
  "sourceSha256": "1989e906cc4d7c9d8e1b393ac7b3abb96753ccaf109ff2cb26d319d3e152c443",
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
    "P1_AMOUNT"
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
    name: Number Field with Format Mask
    alias: HOME
    title: Number Field with Format Mask
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
            htmlCode: <p>A required currency amount with a format mask and range.</p>
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
    pageItem P1_AMOUNT (
        type: numberField
        label {
            label: Amount
            alignment: left
        }
        layout {
            sequence: 10
            region: @form
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            formatMask: FML999G999G990D00
        }
        settings {
            minValue: 0
            maxValue: 1000000
            numberAlignment: end
        }
        validation {
            valueRequired: true
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
    "sourceSha256": "22ca8b60675fa49165085dfbdc57446f5f523e3df6c1d547f33d0106515a9d46",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
