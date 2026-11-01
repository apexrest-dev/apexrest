# Calendar Status Tracking

Calendar whose view-change dynamic action writes the current view type and date range into display items, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.status-tracking.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.status-tracking.md",
  "sourceSha256": "574267321895faa40d59c0b6af5d9cc429c7320b2fcb434af74f97289bf6555b",
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
    name: Calendar Status Tracking
    alias: HOME
    title: Calendar Status Tracking
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
    region tasks (
        name: Tasks
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID, PROJECT, TASK_NAME, STATUS, START_DATE, END_DATE,
                       case STATUS
                          when 'Pending' then 'apex-cal-blue'
                          when 'Open'    then 'apex-cal-green'
                          when 'Closed'  then 'apex-cal-gray'
                          when 'On-Hold' then 'apex-cal-orange'
                       end CSS_CLASS
                  from (
                    select 1 ID, 'Website' PROJECT, 'Gather requirements' TASK_NAME, 'Closed' STATUS, trunc(sysdate, 'MM') + 1 START_DATE, trunc(sysdate, 'MM') + 3 END_DATE from dual union all
                    select 2, 'Website', 'Design mockups', 'Open', trunc(sysdate, 'MM') + 4, trunc(sysdate, 'MM') + 8 from dual union all
                    select 3, 'Mobile App', 'Plan sprint', 'Pending', trunc(sysdate, 'MM') + 9, trunc(sysdate, 'MM') + 9 from dual union all
                    select 4, 'Mobile App', 'Security review', 'On-Hold', trunc(sysdate, 'MM') + 12, trunc(sysdate, 'MM') + 14 from dual union all
                    select 5, 'Data Migration', 'Load test data', 'Open', trunc(sysdate, 'MM') + 18, trunc(sysdate, 'MM') + 20 from dual
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
            htmlDomId: project_tasks
        }
        settings {
            displayColumn: TASK_NAME
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            showTime: true
            calendarViewsAndNavigation: [
                month
                week
                day
                list
                navigation
            ]
            maxEventsDay: 5
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
    )
    pageItem P1_VIEW_TYPE (
        type: displayOnly
        label {
            label: View Type
            alignment: left
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
    pageItem P1_VIEW_START (
        type: displayOnly
        label {
            label: View Start
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
        }
        layout {
            sequence: 20
            region: @controls
            slot: regionBody
        }
    )
    pageItem P1_VIEW_END (
        type: displayOnly
        label {
            label: View End
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
        }
        layout {
            sequence: 30
            region: @controls
            slot: regionBody
        }
    )
    dynamicAction get-calendar-status (
        name: Get Calendar Status
        execution {
            sequence: 10
        }
        when {
            event: region/calendar/apexcalendarviewchange
            selectionType: region
            region: @tasks
        }
        action set-view-type (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.viewType
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: P1_VIEW_TYPE
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action set-view-start (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.dates.startDate.toDateString()
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: P1_VIEW_START
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
        action set-view-end (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.dates.endDate.toDateString()
                suppressChangeEvent: true
            }
            affectedElements {
                selectionType: items
                items: P1_VIEW_END
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
    "sourceSha256": "62fa4a54998d4a687004c1f9fefa7e81e0625d061bdf67853e465b557b87c65f",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
