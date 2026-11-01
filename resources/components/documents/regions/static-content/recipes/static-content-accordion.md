# Accordion Static Content

Static content parent region with expanded and collapsed collapsible sub regions forming an accordion; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/static-content.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.accordion.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/static-content/static-content.accordion.md",
  "sourceSha256": "e987fe56030ae42da67fbdffa6349e4abb7729e72a679fb4b3c3c303758a9e5b",
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
    name: Accordion Static Content
    alias: HOME
    title: Accordion Static Content
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region faq (
        name: Frequently Asked Questions
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )
    region faq-orders (
        name: How are orders created?
        type: staticContent
        source {
            htmlCode: <p>Synthetic answer: orders are created from the cart page.</p>
        }
        layout {
            sequence: 10
            parentRegion: @faq
            slot: subRegions
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-expanded
                t-Region--scrollBody
            ]
        }
    )
    region faq-returns (
        name: How do returns work?
        type: staticContent
        source {
            htmlCode: <p>Synthetic answer: returns are accepted within 30 days.</p>
        }
        layout {
            sequence: 20
            parentRegion: @faq
            slot: subRegions
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--scrollBody
            ]
        }
    )
    region faq-support (
        name: Who do I contact for support?
        type: staticContent
        source {
            htmlCode: <p>Synthetic answer: contact the help desk from the navigation bar.</p>
        }
        layout {
            sequence: 30
            parentRegion: @faq
            slot: subRegions
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
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
    "sourceSha256": "c9b7ed1e492bf49bf49c5ca2330f0c8abdd5d9f68af6c9aa6a9468b0f844367e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
