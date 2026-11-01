# Geocoded Address

Geocoded address item that resolves an unstructured address text field automatically; synthetic data, though the item calls the Oracle geocoding service at runtime.

Status: ready.

Component: component:items/geocoded-address.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-inventory/assets/app/page/page-item/plugin-variants/geocoded-address/geocoded-address.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-inventory/assets/app/page/page-item/plugin-variants/geocoded-address/geocoded-address.md",
  "sourceSha256": "b5a3564b2bebdae37789c48f7366c1f59ee36b7a80fce64e79ebdfec19f34dce",
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
    "P1_ADDRESS",
    "P1_LOCATION"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename the region and item identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Confirm that browser access to the Oracle geocoding service is acceptable before using this item.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Geocoded Address
    alias: HOME
    title: Geocoded Address
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
            htmlCode: <p>Type an unstructured address; the geocoded address item resolves it to coordinates automatically.</p>
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
    pageItem P1_ADDRESS (
        type: textField
        label {
            label: Address
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
    pageItem P1_LOCATION (
        type: geocodedAddress
        label {
            label: Location
        }
        layout {
            sequence: 20
            region: @form
            slot: regionBody
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
        settings {
            structuredAddress: false
            triggerGeocoding: automatic
        }
        geocodingInput {
            addressItem: P1_ADDRESS
            countryType: static
            country: us
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
    "sourceSha256": "c85892801ea5d21d3823728c1047d97d7e816447ff8bb59454a1560191758e42",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
