# Cards with Actions

Cards region with icon, badge, grid layout, full-card link and primary and secondary button actions; synthetic data and no business-table writes.

Status: ready.

Component: component:regions/cards.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/cards/cards.standard.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/cards/cards.standard.md",
  "sourceSha256": "2a02c8b8ccc8a21188596ee7ea269ee48cc0422755492538fb61aacf8621e172",
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
    name: Cards with Actions
    alias: HOME
    title: Cards with Actions
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    pageItem P1_TASK_ID (
        type: hidden
        layout {
            sequence: 10
            slot: body
        }
    )
    region tasks (
        name: Tasks
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 1 ID, 'Review contract' TITLE, 'Legal' TEAM, 'Due in 2 days' DETAILS, 'Open' STATUS, 'fa-file-text-o' ICON_CLASS from dual union all
                select 2, 'Plan release', 'Engineering', 'Due next week', 'In Progress', 'fa-rocket' from dual union all
                select 3, 'Update pricing', 'Sales', 'Completed yesterday', 'Closed', 'fa-tag' from dual
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: #DEFAULT#
        }
        card {
            primaryKeyColumn1: ID
        }
        title {
            advancedFormatting: false
            column: TITLE
        }
        subtitle {
            advancedFormatting: false
            column: TEAM
        }
        body {
            advancedFormatting: false
            column: DETAILS
        }
        iconAndBadge {
            iconSource: iconClassColumn
            iconColumn: ICON_CLASS
            iconPosition: start
            badgeColumn: STATUS
            badgeLabel: Status
        }
        messages {
            whenNoDataFound: No tasks found
        }
        componentAppearance {
            layout: grid
            gridColumns: 3
        }
        action open-task (
            type: fullCard
            layout {
                sequence: 10
            }
            behavior {
                type: redirectThisApp
                target: {
                    page: 1
                    items: {
                        P1_TASK_ID: &ID.
                    }
                    clearCache: 1
                }
            }
        )
        action view-details (
            type: button
            label: View Details
            layout {
                position: primary
                sequence: 20
            }
            appearance {
                displayType: textWithIcon
                icon: fa-eye
                hot: true
            }
            behavior {
                type: redirectThisApp
                target: {
                    page: 1
                    items: {
                        P1_TASK_ID: &ID.
                    }
                    clearCache: 1
                }
            }
        )
        action share-task (
            type: button
            label: Share
            layout {
                position: secondary
                sequence: 30
            }
            appearance {
                displayType: icon
                icon: fa-share-alt
            }
            behavior {
                type: redirectUrl
                targetUrl: #
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
    "sourceSha256": "2f68ae9bd22109c8d247f4cb4d33d45eb9ece86cd9e2f9e2578ea073ad16abe9",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
