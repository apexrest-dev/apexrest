# Weekly Calendar Drag and Drop

Weekly calendar with drag and drop enabled whose handler only logs the new start and end through apex_debug, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.weekly-drag-drop.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.weekly-drag-drop.md",
  "sourceSha256": "187f24bd8273e52909077607256cfaa96537f349cc3f7f68de794c33f4b61861",
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

- Choose a free page number and rename all P1_ items and region static IDs consistently.
- Preserve the target application authentication and authorization.
- Replace synthetic dual data only with authorized project SQL and keep the settings column aliases.
- Replace the logging-only handlers with reviewed persistence code only when writes are authorized.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Weekly Calendar Drag and Drop
    alias: HOME
    title: Weekly Calendar Drag and Drop
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region sessions (
        name: Sessions
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID, TITLE, START_DATE, END_DATE,
                       case SESSION_TYPE
                          when 'BREAK'     then 'apex-cal-silver'
                          when 'BUSINESS'  then 'apex-cal-orange'
                          when 'GENERAL'   then 'apex-cal-blue'
                          when 'TECHNICAL' then 'apex-cal-green'
                       end CSS_CLASS
                  from (
                    select 1 ID, 'Opening Keynote' TITLE, 'GENERAL' SESSION_TYPE, trunc(sysdate, 'IW') + 9/24 START_DATE, trunc(sysdate, 'IW') + 10/24 END_DATE from dual union all
                    select 2, 'Coffee Break', 'BREAK', trunc(sysdate, 'IW') + 10/24, trunc(sysdate, 'IW') + 10.5/24 from dual union all
                    select 3, 'Roadmap Review', 'BUSINESS', trunc(sysdate, 'IW') + 1 + 11/24, trunc(sysdate, 'IW') + 1 + 12/24 from dual union all
                    select 4, 'SQL Deep Dive', 'TECHNICAL', trunc(sysdate, 'IW') + 2 + 13/24, trunc(sysdate, 'IW') + 2 + 15/24 from dual union all
                    select 5, 'Closing Session', 'GENERAL', trunc(sysdate, 'IW') + 4 + 16/24, trunc(sysdate, 'IW') + 4 + 17/24 from dual
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
            dragAndDrop: true
            dragAndDropPlsqlCode:
                ```plsql
                begin
                    apex_debug.message(
                        'Calendar event %s moved to %s - %s',
                        :APEX$PK_VALUE,
                        :APEX$NEW_START_DATE,
                        :APEX$NEW_END_DATE );
                end;
                ```
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
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
    "sourceSha256": "0d1210b4e6612deedc929e4570e7e1deab9c5303b00e2c47d075eb42e65a5796",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
