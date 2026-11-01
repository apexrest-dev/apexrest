# Date Picker with Format and Range

Popup date picker with an explicit YYYY-MM-DD format mask and static minimum and maximum dates; synthetic data and no business-table writes.

Status: ready.

Component: component:items/date-picker.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/date-picker/date-picker.date-format.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/date-picker/date-picker.date-format.md",
  "sourceSha256": "c5f28dfb1311cd0172f5514d6a9f73ee1d37ca90c7eb01b4fa396f8493a4e4d0",
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
    "P1_DUE_DATE"
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
    name: Date Picker with Range
    alias: HOME
    title: Date Picker with Range
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
            htmlCode: <p>A date picker with an explicit format mask and minimum and maximum dates.</p>
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
    pageItem P1_DUE_DATE (
        type: datePicker
        label {
            label: Due Date
        }
        layout {
            sequence: 10
            region: @form
            slot: regionBody
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            formatMask: YYYY-MM-DD
        }
        settings {
            displayAs: popup
            minDate: static
            minStatic: +0d
            maxDate: static
            maxStatic: +90d
            showTime: false
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
    "sourceSha256": "a1f13adc6d0d1426abccd74b5e9450adedc30749f0dd2e120b92bbf0711ee055",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
