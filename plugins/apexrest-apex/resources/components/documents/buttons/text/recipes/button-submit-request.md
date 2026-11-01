# Submit Buttons with Request

Two submit buttons whose request values drive a request-conditioned process that only writes session state; synthetic data and no business-table writes.

Status: ready.

Component: component:buttons/text.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.submit.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/buttons/buttons.submit.md",
  "sourceSha256": "c220303803d3dfeb082bd70a67904cd648cdc081011e1fd9369a701fe0b18769",
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
    "P1_NOTE"
  ]
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
    name: Submit Button with Request
    alias: HOME
    title: Submit Button with Request
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region form (
        name: Note
        type: staticContent
        source {
            htmlCode: <p>Each submit button sends its button name as the request; processes run only for their request.</p>
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
    pageItem P1_NOTE (
        type: textField
        label {
            label: Note
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
    pageItem P1_LAST_REQUEST (
        type: displayOnly
        label {
            label: Last Request
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
    button save (
        buttonName: SAVE
        label: Save
        layout {
            sequence: 10
            region: @form
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
            warnOnUnsavedChanges: doNotCheck
        }
    )
    button save-draft (
        buttonName: SAVE_DRAFT
        label: Save as Draft
        layout {
            sequence: 20
            region: @form
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: submitPage
            warnOnUnsavedChanges: doNotCheck
        }
    )
    process record-request (
        name: Record Request
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    :P1_LAST_REQUEST := :REQUEST;
                    apex_debug.message('Submitted with request %s', :REQUEST);
                end;
                ```
        }
        execution {
            sequence: 10
            point: processing
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: SAVE,SAVE_DRAFT
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
    "sourceSha256": "2da9fb306a6523193b0825d0f157caa5fda8971734b03754de1cf407876becbc",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
