# Weekly Conference Calendar

Weekly conference agenda calendar with track colors, speaker supplemental info and a FullCalendar time-grid initialization, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.weekly-conference.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.weekly-conference.md",
  "sourceSha256": "e8739451957fe98073c4074280698e131d881cb7d00f9121ed41e1d6c0487b38",
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
    name: Weekly Conference Calendar
    alias: HOME
    title: Weekly Conference Calendar
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region agenda (
        name: Conference Agenda
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       TITLE || ' (' || ROOM || ')' TITLE,
                       SPEAKER, ROOM, START_DATE, END_DATE,
                       case TRACK
                          when 'KEYNOTE'   then 'apex-cal-blue'
                          when 'TECHNICAL' then 'apex-cal-green'
                          when 'BUSINESS'  then 'apex-cal-orange'
                          else 'apex-cal-silver'
                       end CSS_CLASS
                  from (
                    select 1 ID, 'Welcome Keynote' TITLE, 'A. Rivera' SPEAKER, 'Hall A' ROOM, 'KEYNOTE' TRACK, trunc(sysdate, 'IW') + 9/24 START_DATE, trunc(sysdate, 'IW') + 10/24 END_DATE from dual union all
                    select 2, 'APEX Performance', 'M. Novak', 'Room 1', 'TECHNICAL', trunc(sysdate, 'IW') + 10.5/24, trunc(sysdate, 'IW') + 11.5/24 from dual union all
                    select 3, 'Customer Journeys', 'J. Chen', 'Room 2', 'BUSINESS', trunc(sysdate, 'IW') + 10.5/24, trunc(sysdate, 'IW') + 11.5/24 from dual union all
                    select 4, 'Lunch', null, 'Foyer', 'BREAK', trunc(sysdate, 'IW') + 12/24, trunc(sysdate, 'IW') + 13/24 from dual union all
                    select 5, 'Hands-on Lab', 'M. Novak', 'Lab', 'TECHNICAL', trunc(sysdate, 'IW') + 1 + 9/24, trunc(sysdate, 'IW') + 1 + 12/24 from dual union all
                    select 6, 'Closing Panel', 'A. Rivera', 'Hall A', 'KEYNOTE', trunc(sysdate, 'IW') + 1 + 15/24, trunc(sysdate, 'IW') + 1 + 16/24 from dual
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
        advanced {
            htmlDomId: conference_agenda
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
            supplementalInfo: &SPEAKER.
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( pOptions ) {
                    pOptions.initialView = "timeGridWeek";
                    pOptions.slotMinTime = "08:00:00";
                    pOptions.slotMaxTime = "18:00:00";
                    return pOptions;
                }
                ```
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
    "sourceSha256": "272247a25e729f7a80ed43463f471ffe5146d98d9407540b143a130fd807a08b",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
