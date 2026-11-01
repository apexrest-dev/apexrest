# Confirm, Server Code and Success Notification

Delete button chain of Confirm, Execute Server-side Code (message only, no DML) and Show Success Message; synthetic data.

Status: ready.

Component: component:business-logic/dynamic-actions.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.delete-with-notification.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/business-logic/dynamic-actions/dynamic-actions.delete-with-notification.md",
  "sourceSha256": "b8acdfcb394105db8d9e4a143cbc6ea594f32a426ca8305a2fc1d31c2febba97",
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
    "P1_ROW_ID"
  ]
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
    name: Confirm, server call and success notification
    alias: HOME
    title: Confirm, server call and success notification
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region controls (
        name: Controls
        type: staticContent
        source {
            htmlCode: <p>Delete asks for confirmation, runs server-side code that only builds a result message from session state (no DML), and then shows a success notification.</p>
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
    pageItem P1_ROW_ID (
        type: selectList
        label {
            label: Row
        }
        lov {
            type: staticValues
            staticValues: STATIC:Alpha sample;1,Beta sample;2,Gamma sample;3
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    pageItem P1_RESULT (
        type: displayOnly
        label {
            label: Result
        }
        layout {
            sequence: 20
            region: @controls
            slot: regionBody
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )
    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 10
            region: @controls
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )
    dynamicAction delete-row (
        name: Delete row with notification
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @delete
        }
        action confirm-delete (
            action: confirm
            settings {
                title: Delete row
                message: Delete the selected sample row?
                style: danger
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action run-delete (
            action: executeServerSideCode
            settings {
                itemsToSubmit: P1_ROW_ID
                itemsToReturn: P1_RESULT
                plsqlCode:
                    ```plsql
                    begin
                        -- Synthetic example: no table is changed.
                        :P1_RESULT := 'Row ' || :P1_ROW_ID || ' processed at ' || to_char(sysdate, 'HH24:MI:SS');
                    end;
                    ```
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
        action notify (
            action: showSuccessMessage
            settings {
                message: The sample row request completed.
            }
            execution {
                sequence: 30
                fireOnInit: false
            }
        )
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "0bb1128200f1433d425e5e6a2cd6cbfdc2dcf4ca8b8f4ab63434f5d6976944f3",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
