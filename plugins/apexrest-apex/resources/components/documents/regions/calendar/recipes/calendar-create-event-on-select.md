# Calendar Create Event on Select

Weekly calendar whose Date Selected dynamic action captures the selected range, logs it server-side without DML and shows a message, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.create-event-on-select.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.create-event-on-select.md",
  "sourceSha256": "ba2b6b65937aa3a9ff4426bff4d5aa8e1533c716a62ae8efbd7c412ae75ec2c1",
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
    "P1_NEW_START_DATE",
    "P1_NEW_END_DATE"
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
    name: Calendar Create Event on Select
    alias: HOME
    title: Calendar Create Event on Select
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
    pageItem P1_NEW_START_DATE (
        type: hidden
        settings {
            valueProtected: false
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
        }
    )
    pageItem P1_NEW_END_DATE (
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
    dynamicAction date-range-selected (
        name: Date Range Selected: Create Event
        execution {
            sequence: 10
        }
        when {
            event: region/calendar/apexcalendardateselect
            selectionType: region
            region: @sessions
        }
        action set-start (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.newStartDate
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: P1_NEW_START_DATE
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action set-end (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.newEndDate
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: P1_NEW_END_DATE
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
        action log-new-event (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    apex_debug.message(
                        'Create calendar event requested: %s - %s',
                        :P1_NEW_START_DATE,
                        :P1_NEW_END_DATE );
                    ```
                itemsToSubmit: [
                    P1_NEW_START_DATE
                    P1_NEW_END_DATE
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
                        "New event requested from " + $v("P1_NEW_START_DATE") + " to " + $v("P1_NEW_END_DATE") + "."
                    );
                    ```
            }
            execution {
                sequence: 40
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
    "sourceSha256": "8d1ae8437e55efe10ba2abd2b600992be8363b1267fdf1d9812d421e2f60865a",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
