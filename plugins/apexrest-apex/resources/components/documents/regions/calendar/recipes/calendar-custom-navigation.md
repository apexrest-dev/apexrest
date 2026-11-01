# Calendar Custom Navigation

Calendar driven by custom previous, today and next buttons, a view-type select list and a go-to-date picker through the FullCalendar API, using synthetic data.

Status: ready.

Component: component:regions/calendar.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.custom-navigation.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/calendar/calendar.custom-navigation.md",
  "sourceSha256": "7e53f19e2b74c769bdf90bb7a7223121f81ae84a644a89bd662eff58462fee31",
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
    name: Calendar Custom Navigation
    alias: HOME
    title: Calendar Custom Navigation
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
            maxEventsDay: 5
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
    )
    pageItem P1_VIEW_TYPE (
        type: selectList
        label {
            label: View Type
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:Month;dayGridMonth,Week;timeGridWeek,Day;timeGridDay,List;listWeek
            displayExtraValues: false
            displayNullValue: false
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
            height: 1
        }
        layout {
            sequence: 10
            region: @controls
            slot: regionBody
        }
    )
    pageItem P1_GOTO_DATE (
        type: datePicker
        label {
            label: Go to Date
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: #DEFAULT#
            formatMask: YYYY-MM-DD
        }
        layout {
            sequence: 20
            region: @controls
            slot: regionBody
        }
    )
    button prev (
        buttonName: PREV
        label: Previous
        layout {
            sequence: 10
            region: @controls
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
    )
    button today (
        buttonName: TODAY
        label: Today
        layout {
            sequence: 10
            region: @controls
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
    )
    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 20
            region: @controls
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
    )
    dynamicAction calendar-prev (
        name: Calendar: Previous Page
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @prev
        }
        action run-js (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    apex.region("project_tasks").widget().data("fullCalendar").prev();
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction calendar-today (
        name: Calendar: Today
        execution {
            sequence: 20
        }
        when {
            event: click
            selectionType: button
            button: @today
        }
        action run-js (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    apex.region("project_tasks").widget().data("fullCalendar").today();
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction calendar-next (
        name: Calendar: Next Page
        execution {
            sequence: 30
        }
        when {
            event: click
            selectionType: button
            button: @next
        }
        action run-js (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    apex.region("project_tasks").widget().data("fullCalendar").next();
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction change-view (
        name: Change View
        execution {
            sequence: 40
        }
        when {
            selectionType: items
            items: P1_VIEW_TYPE
        }
        action change-view-js (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    apex.region("project_tasks").widget().data("fullCalendar").changeView( $v("P1_VIEW_TYPE") );
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
    dynamicAction go-to-date (
        name: Go to Date
        execution {
            sequence: 50
        }
        when {
            selectionType: items
            items: P1_GOTO_DATE
        }
        action go-to-date-js (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    var d = $v("P1_GOTO_DATE");
                    if ( /^\d{4}-\d{2}-\d{2}$/.test( d ) ) {
                        apex.region("project_tasks").widget().data("fullCalendar").gotoDate( d );
                    } else {
                        apex.message.alert( "Please use YYYY-MM-DD." );
                    }
                    ```
            }
            execution {
                sequence: 10
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
    "sourceSha256": "18ff1caa82eabfdc3f4e9446d9803df634389295b01882d59fbce9e707e51d65",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
