# Weekly Calendar Time Format Toggle

Weekly calendar with a select list that switches between default, 12-hour and 24-hour calendar regions by server-side condition, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.weekly-time-format-toggle.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.weekly-time-format-toggle.md",
  "sourceSha256": "a8a607c741953eaf24ca37b8d46ee069966da1193e1afaafd64294eb61451bad",
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
    "P1_TIME_FORMAT"
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
    name: Weekly Calendar Time Format Toggle
    alias: HOME
    title: Weekly Calendar Time Format Toggle
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
    region sessions-default (
        name: Sessions (default)
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
        serverSideCondition {
            type: item=value
            item: P1_TIME_FORMAT
            value: default
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
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( pOptions ) {
                    pOptions.displayEventTime = true;
                    return pOptions;
                }
                ```
        }
    )
    region sessions-12h (
        name: Sessions (12h)
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
            sequence: 20
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
        serverSideCondition {
            type: item=value
            item: P1_TIME_FORMAT
            value: 12
        }
        settings {
            displayColumn: TITLE
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            timeFormat: 12Hour
            calendarViewsAndNavigation: [
                week
                day
                list
                navigation
            ]
            cssClass: CSS_CLASS
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( pOptions ) {
                    pOptions.displayEventTime = true;
                    return pOptions;
                }
                ```
        }
    )
    region sessions-24h (
        name: Sessions (24h)
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
            sequence: 30
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
        serverSideCondition {
            type: item=value
            item: P1_TIME_FORMAT
            value: 24
        }
        settings {
            displayColumn: TITLE
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            timeFormat: 24Hour
            calendarViewsAndNavigation: [
                week
                day
                list
                navigation
            ]
            cssClass: CSS_CLASS
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( pOptions ) {
                    pOptions.displayEventTime = true;
                    return pOptions;
                }
                ```
        }
    )
    pageItem P1_TIME_FORMAT (
        type: selectList
        label {
            label: Time Format
            alignment: left
        }
        settings {
            pageActionOnSelection: redirectSetValue
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Default (based on NLS);default,12 hour;12,24 hour;24
            displayExtraValues: false
            displayNullValue: false
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
            height: 1
        }
        default {
            type: static
            staticValue: default
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
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
    "sourceSha256": "864f3bf2895c4db8231fbb8913ee6b132b5d978c15b116a47233a1f8f6fd9348",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
