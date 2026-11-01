# Rich Text Editor

HTML rich text editor item with the full multiline toolbar; synthetic data and no business-table writes.

Status: ready.

Component: component:items/rich-text-editor.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/items/rich-text-editor/rich-text-editor.explicit-defaults.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/items/rich-text-editor/rich-text-editor.explicit-defaults.md",
  "sourceSha256": "bfaf626df5e3b51c3bfb0504a91b43635fadb0f1f50630952de03467ead1aa91",
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
    "P1_BODY"
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
    name: Rich Text Editor
    alias: HOME
    title: Rich Text Editor
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
            htmlCode: <p>An HTML rich text editor with the full toolbar on multiple lines.</p>
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
    pageItem P1_BODY (
        type: richTextEditor
        label {
            label: Message Body
            alignment: left
        }
        layout {
            sequence: 10
            region: @form
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
        }
        settings {
            format: html
            toolbar: full
            toolbarStyle: multiline
            minHeight: 180
        }
        help {
            helpText: Compose the message with basic HTML formatting.
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
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
    "sourceSha256": "f056252051f70dda0dc950775945d4dcf1993cb0b56711e1d3f19b80ee012452",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
