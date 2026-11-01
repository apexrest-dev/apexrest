# Calendar Delete or Copy on Click

Calendar whose Event Selected dynamic action confirms a delete or copy choice, logs it through apex_debug without DML and shows a message, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.delete-or-copy-on-click.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.delete-or-copy-on-click.md",
  "sourceSha256": "20723b5c0bcdc67df046a55b29c96395de8b7953bacef9c32758e686f3c3772c",
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
    "P1_EVENT_ID",
    "P1_EVENT_ACTION"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items and region static IDs consistently.
- Preserve the target application authentication and authorization.
- Replace synthetic dual data only with authorized project SQL and keep the settings column aliases.
- Replace the logging-only handlers with reviewed persistence code only when writes are authorized.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Calendar Delete or Copy on Click
    alias: HOME
    title: Calendar Delete or Copy on Click
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
        layout {
            sequence: 5
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )
    region sessions (
        name: Sessions
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       case when SPEAKER is not null then TITLE || ' (' || SPEAKER || ')' else TITLE end TITLE,
                       SPEAKER, START_DATE, END_DATE,
                       case SESSION_TYPE
                          when 'BREAK'     then 'apex-cal-silver'
                          when 'BUSINESS'  then 'apex-cal-orange'
                          when 'GENERAL'   then 'apex-cal-blue'
                          when 'TECHNICAL' then 'apex-cal-green'
                       end CSS_CLASS
                  from (
                    select 1 ID, 'Opening Keynote' TITLE, 'A. Rivera' SPEAKER, 'GENERAL' SESSION_TYPE, trunc(sysdate, 'IW') + 9/24 START_DATE, trunc(sysdate, 'IW') + 10/24 END_DATE from dual union all
                    select 2, 'Coffee Break', null, 'BREAK', trunc(sysdate, 'IW') + 10/24, trunc(sysdate, 'IW') + 10.5/24 from dual union all
                    select 3, 'Roadmap Review', 'J. Chen', 'BUSINESS', trunc(sysdate, 'IW') + 1 + 11/24, trunc(sysdate, 'IW') + 1 + 12/24 from dual union all
                    select 4, 'SQL Deep Dive', 'M. Novak', 'TECHNICAL', trunc(sysdate, 'IW') + 2 + 13/24, trunc(sysdate, 'IW') + 2 + 15/24 from dual union all
                    select 5, 'Closing Session', 'A. Rivera', 'GENERAL', trunc(sysdate, 'IW') + 4 + 16/24, trunc(sysdate, 'IW') + 4 + 17/24 from dual
                  )
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--hiddenOverflow
            ]
        }
        settings {
            displayColumn: TITLE
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            calendarViewsAndNavigation: [
                week
                day
                list
                navigation
            ]
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
    )
    pageItem P1_EVENT_ACTION (
        type: radioGroup
        label {
            label: On Event Click
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:Delete;DELETE,Copy;COPY
        }
        default {
            type: static
            staticValue: DELETE
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
        }
    )
    pageItem P1_EVENT_ID (
        type: hidden
        settings {
            valueProtected: false
        }
        layout {
            sequence: 20
            region: @controls
            slot: regionBody
        }
    )
    dynamicAction event-clicked (
        name: Event Clicked: Confirm Action
        execution {
            sequence: 10
        }
        when {
            event: region/calendar/apexcalendareventselect
            selectionType: region
            region: @sessions
        }
        action set-event-id (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.event.id
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: P1_EVENT_ID
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action confirm-action (
            action: confirm
            settings {
                message: Apply the selected action to this event?
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
        action log-action (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    apex_debug.message(
                        'Calendar event %s action %s (no data change)',
                        :P1_EVENT_ID,
                        :P1_EVENT_ACTION );
                    ```
                itemsToSubmit: [
                    P1_EVENT_ID
                    P1_EVENT_ACTION
                ]
            }
            execution {
                sequence: 30
                fireOnInit: false
            }
        )
        action show-message (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    apex.message.showPageSuccess(
                        ( $v("P1_EVENT_ACTION") === "COPY" ? "Copy" : "Delete" ) +
                        " requested for event " + $v("P1_EVENT_ID") + "."
                    );
                    ```
            }
            execution {
                sequence: 40
                fireOnInit: false
            }
        )
        action refresh-calendar (
            action: refresh
            affectedElements {
                selectionType: region
                region: @sessions
            }
            execution {
                sequence: 50
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
    "sourceSha256": "ef57e99f6c8915326756a5db01ee0ae2bbde907bfd92d94b9a0ba5cf94eecc3c",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
