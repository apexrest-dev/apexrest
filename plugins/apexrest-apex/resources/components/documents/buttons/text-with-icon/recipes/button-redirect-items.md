# Redirect Button with Item Values

Redirect-this-app button with a declarative target that sets item values, clears cache and resets pagination; synthetic data and no business-table writes.

Status: ready.

Component: component:buttons/text-with-icon.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.redirect-this-app.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.redirect-this-app.md",
  "sourceSha256": "3d4502bf50263dc0e2f44a4fb6aecb23ad6955bcb2f72d59196ed8ca59f5e248",
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
- Rename region, button and process identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace the synthetic behavior only with authorized project logic and keep the button action type unchanged.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Redirect Button with Item Values
    alias: HOME
    title: Redirect Button with Item Values
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region form (
        name: Filter
        type: staticContent
        source {
            htmlCode: <p>The button reloads the page and sets item values through the declarative target.</p>
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
        type: displayOnly
        label {
            label: Status
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
    pageItem P1_SOURCE (
        type: displayOnly
        label {
            label: Source
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
    )
    button show-open (
        buttonName: SHOW_OPEN
        label: Show Open Items
        layout {
            sequence: 10
            region: @form
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-filter
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
                items: {
                    P1_STATUS: OPEN
                    P1_SOURCE: BUTTON
                }
                clearCache: 1
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
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
    "sourceSha256": "2b3a38b1b7dc5611d4acda039997c41fca5fe2ed130c76f352b85ac776449910",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
