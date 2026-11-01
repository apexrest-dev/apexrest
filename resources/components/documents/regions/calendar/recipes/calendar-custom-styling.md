# Calendar Custom Styling

Weekly calendar styled through a CSS class column with page-level classes, escaped HTML icons in titles and a custom time grid, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.custom-styling.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.custom-styling.md",
  "sourceSha256": "40aaaa032c92796644f77cfd804604a3021c9e9858cbecacb152459977bf3258",
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
    name: Calendar Custom Styling
    alias: HOME
    title: Calendar Custom Styling
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            .fc-event.cal-priority-high { background-color: #b42318; border-color: #b42318; color: #ffffff; }
            .fc-event.cal-priority-medium { background-color: #c66a00; border-color: #c66a00; color: #ffffff; }
            .fc-event.cal-priority-low { background-color: #117733; border-color: #117733; color: #ffffff; }
            ```
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region styled-sessions (
        name: Styled Sessions
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       '<span class="fa ' || ICON || '" aria-hidden="true"></span>&nbsp;' || apex_escape.html(TITLE) TITLE,
                       apex_escape.html(SPEAKER) SPEAKER,
                       START_DATE, END_DATE,
                       case PRIORITY
                          when 'HIGH'   then 'cal-priority-high'
                          when 'MEDIUM' then 'cal-priority-medium'
                          else 'cal-priority-low'
                       end CSS_CLASS
                  from (
                    select 1 ID, 'Release Planning' TITLE, 'A. Rivera' SPEAKER, 'HIGH' PRIORITY, 'fa-flag' ICON, trunc(sysdate, 'IW') + 9/24 START_DATE, trunc(sysdate, 'IW') + 10.5/24 END_DATE from dual union all
                    select 2, 'Design Sync', 'J. Chen', 'MEDIUM', 'fa-users', trunc(sysdate, 'IW') + 1 + 11/24, trunc(sysdate, 'IW') + 1 + 12/24 from dual union all
                    select 3, 'Lunch and Learn', 'M. Novak', 'LOW', 'fa-coffee', trunc(sysdate, 'IW') + 2 + 12/24, trunc(sysdate, 'IW') + 2 + 13/24 from dual union all
                    select 4, 'Incident Review', 'A. Rivera', 'HIGH', 'fa-warning', trunc(sysdate, 'IW') + 3 + 14/24, trunc(sysdate, 'IW') + 3 + 15/24 from dual
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
        security {
            escapeSpecialChars: false
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
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( pOptions ) {
                    pOptions.slotMinTime  = "07:00:00";
                    pOptions.slotMaxTime  = "18:00:00";
                    pOptions.slotDuration = "00:15:00";
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
    "sourceSha256": "6d4781410119bb314c4f068d1b31c42a6a3309726cad9e0106678b6934bd1478",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
