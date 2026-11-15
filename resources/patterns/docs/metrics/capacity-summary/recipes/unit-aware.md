# Capacity gauges with exact usage table / Індикатори місткості з таблицею точного використання

A compact comparison keeps each resource unit and maximum explicit.

Status: ready.

Source: ux-pattern-catalog; pages 1120.

## Data contract

```json
{
  "source": "Original synthetic SQL selected from DUAL; no application tables or external resources.",
  "tables": [],
  "columns": {
    "LABEL": "varchar2 resource",
    "VALUE": "number nonnegative used amount",
    "MAX_VALUE": "number positive maximum",
    "UNIT": "varchar2 common unit per row"
  },
  "bindings": [],
  "submittedItems": [],
  "writeContract": "Read-only."
}
```

## Adaptation

- Choose unused page numbers and rename page items, region keys and target URLs together.
- Replace synthetic queries with authorized application sources; preserve keys, types, ordering, item bindings and required row authorization.
- Preserve the destination authentication and shared configuration.
- Compile the adapted application; SQL execution, import and browser behavior require separate checks.

Overlay these files on pattern:scaffold for offline compilation. Merge the selected composition into an existing project; never replace its authentication or application settings with the compiler scaffold.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Capacity consumption summary
    alias: HOME
    title: Capacity consumption summary
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region review-seats (
        name: Assigned seats
        type: chart
        layout {
            sequence: 10
            slot: body
            columnSpan: 4
            startNewRow: true
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        chart {
            type: statusMeterGauge
        }
        gauge {
            orientation: horizontal
        }
        series series-1 (
            name: Assigned seats
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Assigned seats' LABEL, 7 VALUE, 12 MAX_VALUE from dual
                    ```
            }
            columnMapping {
                label: LABEL
                value: VALUE
                maxValue: MAX_VALUE
            }
        )
    )
    region queue-capacity (
        name: Queue utilization
        type: chart
        layout {
            sequence: 20
            slot: body
            columnSpan: 4
            startNewRow: false
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        chart {
            type: statusMeterGauge
        }
        gauge {
            orientation: horizontal
        }
        series series-1 (
            name: Queue utilization
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Queue utilization' LABEL, 65 VALUE, 100 MAX_VALUE from dual
                    ```
            }
            columnMapping {
                label: LABEL
                value: VALUE
                maxValue: MAX_VALUE
            }
        )
    )
    region budget (
        name: Allocated budget
        type: chart
        layout {
            sequence: 30
            slot: body
            columnSpan: 4
            startNewRow: false
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        chart {
            type: statusMeterGauge
        }
        gauge {
            orientation: horizontal
        }
        series series-1 (
            name: Allocated budget
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 'Allocated budget' LABEL, 720 VALUE, 1000 MAX_VALUE from dual
                    ```
            }
            columnMapping {
                label: LABEL
                value: VALUE
                maxValue: MAX_VALUE
            }
        )
    )
    region usage (
        name: Exact usage
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'Assigned seats' RESOURCE_NAME, 7 USED, 12 CAPACITY, 'Seats' UNIT from dual union all select 'Queue utilization' RESOURCE_NAME, 65 USED, 100 CAPACITY, 'Percent' UNIT from dual union all select 'Allocated budget' RESOURCE_NAME, 720 USED, 1000 CAPACITY, 'Currency units' UNIT from dual
                ```
        }
        layout {
            sequence: 50
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        column RESOURCE_NAME (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: RESOURCE
            }
            layout {
                sequence: 10
            }
        )
        column USED (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: USED
            }
            layout {
                sequence: 20
            }
        )
        column CAPACITY (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: CAPACITY
            }
            layout {
                sequence: 30
            }
        )
        column UNIT (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: UNIT
            }
            layout {
                sequence: 40
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
    "sourceSha256": "83420dfe94e725db3a443d3f466bf3f97839543685a2ffb03eb7afb1d1fe1006",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile after adaptation. SQL execution, import and browser checks are separate evidence.
