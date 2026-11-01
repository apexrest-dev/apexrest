# Form Initialization by Primary Key

Form Initialization process that fetches a row by primary-key item from a synthetic dual query region, conditioned on the key being set; synthetic data.

Status: ready.

Component: component:business-logic/processes.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/processes/processes.form-initialization.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/processes/processes.form-initialization.md",
  "sourceSha256": "2e8af1edb0983de8f6d031a9edcc532f26e7d9b16e8ddc7fa82a1f240d1d1574",
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
- Rename region, button, process and dynamic-action identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic logic only with authorized project code and keep server code free of business-table DML unless explicitly authorized.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Form initialization by primary key
    alias: HOME
    title: Form initialization by primary key
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region chooser (
        name: Choose a record
        type: staticContent
        source {
            htmlCode: <p>Each button sets P1_ID; the form initialization process fetches that row from a synthetic query before the header renders.</p>
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
    button load-first (
        buttonName: LOAD_FIRST
        label: Load record 1
        layout {
            sequence: 10
            region: @chooser
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
                items: {
                    P1_ID: 1
                }
                clearCache: 1
            }
        }
    )
    button load-second (
        buttonName: LOAD_SECOND
        label: Load record 2
        layout {
            sequence: 20
            region: @chooser
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
                items: {
                    P1_ID: 2
                }
                clearCache: 1
            }
        }
    )
    region record (
        name: Record
        type: form
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 1 ID, 'Alpha sample' TITLE, 'Open' STATUS from dual
                union all
                select 2, 'Beta sample', 'Closed' from dual
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        edit {
            enabled: false
        }
    )
    pageItem P1_ID (
        type: hidden
        layout {
            sequence: 10
            region: @record
            slot: regionBody
        }
        source {
            formRegion: @record
            column: ID
            dataType: number
            queryOnly: true
            primaryKey: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )
    pageItem P1_TITLE (
        type: displayOnly
        label {
            label: Title
        }
        layout {
            sequence: 20
            region: @record
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @record
            column: TITLE
            dataType: varchar2
            queryOnly: true
        }
    )
    pageItem P1_STATUS (
        type: displayOnly
        label {
            label: Status
        }
        layout {
            sequence: 30
            region: @record
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        source {
            formRegion: @record
            column: STATUS
            dataType: varchar2
            queryOnly: true
        }
    )
    process initialize-record (
        name: Initialize record form
        type: formInitialization
        formRegion: @record
        execution {
            sequence: 10
            point: beforeHeader
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P1_ID
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
    "sourceSha256": "814ca6efd6e28061fb2814cb874b76f9ba8f74ab2fa0f78fe9f2b2dd84ce2eeb",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
