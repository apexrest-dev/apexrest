# Gantt Chart

Native JET Gantt chart with task rows, progress, baseline dates, a fixed timeline and month/week time scales; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00003-gantt.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00003-gantt.apx",
  "sourceSha256": "e90eb772fd56b18cf77a28c6d99362895668e5b41afff10b10556fb5cfbb0989",
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
- Rename region, series and axis identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and keep every column alias used by the series column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Gantt Chart
    alias: HOME
    title: Gantt Chart
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region project-schedule (
        name: Project Schedule
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                js-showMaximizeButton
                t-Region--scrollBody
            ]
        }
        chart {
            type: gantt
        }
        chartLayout {
            height: 400
        }
        settings {
            showHorizontalGrid: true
            showVerticalGrid: true
        }
        animation {
            onDataChange: none
        }
        tooltip {
            showRow: false
            showBaseline: false
        }
        messages {
            whenNoDataFound: No tasks are scheduled.
        }

        series tasks (
            name: Tasks
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select t.task_id,
                           t.task_name,
                           t.task_start_date,
                           t.task_end_date,
                           t.progress,
                           t.task_start_date - 2 as baseline_start,
                           t.task_end_date + 3   as baseline_end,
                           trunc(sysdate) - 45   as gantt_start,
                           trunc(sysdate) + 60   as gantt_end
                      from (select 1 as task_id, 'Requirements workshop' as task_name, trunc(sysdate) - 40 as task_start_date, trunc(sysdate) - 30 as task_end_date, 1 as progress from dual union all
                            select 2, 'Data model design',   trunc(sysdate) - 28, trunc(sysdate) - 14, 1    from dual union all
                            select 3, 'Page development',    trunc(sysdate) - 12, trunc(sysdate) + 10, 0.6  from dual union all
                            select 4, 'User acceptance test', trunc(sysdate) + 12, trunc(sysdate) + 25, 0.1 from dual union all
                            select 5, 'Production cutover',  trunc(sysdate) + 28, trunc(sysdate) + 32, 0    from dual) t
                     order by t.task_start_date
                    ```
            }
            timeline {
                startDateSourceType: databaseColumn
                startDateColumn: GANTT_START
                endDateSourceType: databaseColumn
                endDateColumn: GANTT_END
            }
            columnMapping {
                rowId: TASK_ID
                rowName: TASK_NAME
                taskId: TASK_ID
                taskName: TASK_NAME
                taskStartDate: TASK_START_DATE
                taskEndDate: TASK_END_DATE
                progress: PROGRESS
                baselineStartDate: BASELINE_START
                baselineEndDate: BASELINE_END
            }
            appearance {
                taskCssClasses: u-color-22
                progressCssClasses: u-color-11
                baselineCssClasses: u-color-43
            }
            label {
                show: true
                taskLabelPosition: innerStart
            }
        )

        axis major (
            name: major
            timeScale {
                scale: months
            }
        )

        axis minor (
            name: minor
            timeScale {
                scale: weeks
            }
            value {
                format: dateMedium
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
    "sourceSha256": "3b80b5570ebc6f9dd354d5cd3ced7f7dd4e9757aed15b05fc2ff3bfad759028f",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
