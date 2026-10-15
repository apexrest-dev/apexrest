# SLA monitor dashboard

Read-only service-level dashboard: KPI cards (open, breached, at risk within 24 hours, resolved on time), a bar chart of SLA state by department and a badge report of breached and at-risk tickets, all classified by one shared SQL rule against due and resolution timestamps.

Status: ready.

Component: component:regions/cards.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/akashkataria766/Public-Grievance-Redressal-System/blob/6da600da9134b9495414aa1bf96d3a2f6dcf3c88/pages/p00050-admin-governance-dashboard.apx",
  "repository": "https://github.com/akashkataria766/Public-Grievance-Redressal-System",
  "commit": "6da600da9134b9495414aa1bf96d3a2f6dcf3c88",
  "path": "pages/p00050-admin-governance-dashboard.apx",
  "sourceSha256": "447a3818e3bae0d81508c04942abae6bc7fb4f23a3376f2f619157e5b868fc9b",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "localDatabase/sqlQuery; read-only; optional declared fixture",
  "tables": [
    "APEXREST_EXAMPLE_TICKETS"
  ],
  "columns": [
    {
      "name": "ID",
      "type": "number"
    },
    {
      "name": "TITLE",
      "type": "varchar2"
    },
    {
      "name": "DEPARTMENT",
      "type": "varchar2"
    },
    {
      "name": "PRIORITY",
      "type": "varchar2"
    },
    {
      "name": "CREATED_AT",
      "type": "timestamp"
    },
    {
      "name": "DUE_AT",
      "type": "timestamp"
    },
    {
      "name": "RESOLVED_AT",
      "type": "timestamp"
    }
  ],
  "slaRule": "Resolved on time if RESOLVED_AT <= DUE_AT; Resolved late if later; open tickets are Breached when DUE_AT < now, At risk when due within 24 hours, otherwise On track",
  "bindings": [],
  "submittedItems": [],
  "writes": false,
  "prerequisites": [
    {
      "path": "prerequisites/example-tickets.sql",
      "execution": "Not executed. Creates and seeds APEXREST_EXAMPLE_TICKETS with due dates relative to install time; apply only to an explicitly authorized isolated development schema, or map the queries to the project's ticket table."
    }
  ],
  "authorization": "Preserve application authentication and restrict the dashboard to supervisors or administrators."
}
```

## Adaptation

- Choose a free page number before merging into an existing application.
- Rename region identifiers before merging into an existing application.
- Preserve the target application authentication and add a supervisor or administrator authorization scheme.
- Map the shared classified CTE to the project's ticket table and keep the SLA rule in one place (a view is a good home) so cards, chart and report never disagree.
- Adjust the 24-hour at-risk window and the time zone of SYSTIMESTAMP comparisons to the project's service calendar.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: SLA monitor
    alias: HOME
    title: SLA monitor
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region kpis (
        name: Service levels
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with classified as (
                    select ID,
                           TITLE,
                           DEPARTMENT,
                           PRIORITY,
                           DUE_AT,
                           RESOLVED_AT,
                           case
                               when RESOLVED_AT is not null and RESOLVED_AT <= DUE_AT then 'Resolved on time'
                               when RESOLVED_AT is not null then 'Resolved late'
                               when DUE_AT < systimestamp then 'Breached'
                               when DUE_AT < systimestamp + interval '24' hour then 'At risk'
                               else 'On track'
                           end SLA_STATE
                      from APEXREST_EXAMPLE_TICKETS
                )
                select 1 SEQ, 'Open' METRIC_NAME, to_char(count(case when RESOLVED_AT is null then 1 end)) METRIC_VALUE, 'fa fa-inbox' METRIC_ICON from classified
                union all
                select 2, 'Breached', to_char(count(case when SLA_STATE = 'Breached' then 1 end)), 'fa fa-exclamation-circle' from classified
                union all
                select 3, 'At risk (24 h)', to_char(count(case when SLA_STATE = 'At risk' then 1 end)), 'fa fa-clock-o' from classified
                union all
                select 4, 'Resolved on time',
                       nvl(to_char(round(100 * count(case when SLA_STATE = 'Resolved on time' then 1 end)
                                     / nullif(count(RESOLVED_AT), 0))) || '%', 'n/a'),
                       'fa fa-check-circle' from classified
                order by 1
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        componentAppearance {
            gridColumns: 4
        }
        title {
            column: METRIC_NAME
        }
        subtitle {
            column: METRIC_VALUE
        }
        iconAndBadge {
            iconSource: iconClassColumn
            iconColumn: METRIC_ICON
        }
    )

    region sla-by-department (
        name: SLA state by department
        type: chart
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with classified as (
                    select ID,
                           TITLE,
                           DEPARTMENT,
                           PRIORITY,
                           DUE_AT,
                           RESOLVED_AT,
                           case
                               when RESOLVED_AT is not null and RESOLVED_AT <= DUE_AT then 'Resolved on time'
                               when RESOLVED_AT is not null then 'Resolved late'
                               when DUE_AT < systimestamp then 'Breached'
                               when DUE_AT < systimestamp + interval '24' hour then 'At risk'
                               else 'On track'
                           end SLA_STATE
                      from APEXREST_EXAMPLE_TICKETS
                )
                select DEPARTMENT, SLA_STATE, count(*) TICKET_COUNT
                  from classified
                 group by DEPARTMENT, SLA_STATE
                 order by DEPARTMENT, SLA_STATE
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        chart {
            type: bar
        }
        legend {
            position: bottom
        }
        messages {
            whenNoDataFound: No tickets.
        }

        series sla-state (
            name: SLA state
            execution {
                sequence: 10
            }
            source {
                location: regionSource
            }
            columnMapping {
                seriesName: SLA_STATE
                label: DEPARTMENT
                value: TICKET_COUNT
            }
        )

        axis x (
            name: x
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            value {
                format: decimal
                decimalPlaces: 0
                step: 1
            }
            minorTicks {
                show: false
            }
        )
    )

    region needs-attention (
        name: Needs attention
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with classified as (
                    select ID,
                           TITLE,
                           DEPARTMENT,
                           PRIORITY,
                           DUE_AT,
                           RESOLVED_AT,
                           case
                               when RESOLVED_AT is not null and RESOLVED_AT <= DUE_AT then 'Resolved on time'
                               when RESOLVED_AT is not null then 'Resolved late'
                               when DUE_AT < systimestamp then 'Breached'
                               when DUE_AT < systimestamp + interval '24' hour then 'At risk'
                               else 'On track'
                           end SLA_STATE
                      from APEXREST_EXAMPLE_TICKETS
                )
                select ID,
                       TITLE,
                       DEPARTMENT,
                       PRIORITY,
                       to_char(DUE_AT, 'YYYY-MM-DD HH24:MI') DUE,
                       case
                           when DUE_AT < systimestamp
                           then round((cast(systimestamp as date) - cast(DUE_AT as date)) * 24) || ' h overdue'
                           else round((cast(DUE_AT as date) - cast(systimestamp as date)) * 24) || ' h left'
                       end TIME_TO_DUE,
                       SLA_STATE
                  from classified
                 where SLA_STATE in ('Breached', 'At risk')
                 order by DUE_AT
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }
        messages {
            whenNoDataFound: No open tickets are breached or due within 24 hours.
        }

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column TITLE (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Ticket
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

        column DEPARTMENT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Department
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column PRIORITY (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Priority
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )

        column DUE (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Due
            }
            layout {
                sequence: 50
            }
            sorting {
                sortable: false
            }
        )

        column TIME_TO_DUE (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Time to due
            }
            layout {
                sequence: 60
            }
            sorting {
                sortable: false
            }
        )

        column SLA_STATE (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: SLA
            }
            layout {
                sequence: 70
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {case SLA_STATE/}{when Breached/}<span class="t-Badge u-danger">Breached</span>{otherwise/}<span class="t-Badge u-warning">At risk</span>{endcase/}
                    ```
            }
            sorting {
                sortable: false
            }
        )
    )
)

```

## prerequisites/example-tickets.sql

```sql
-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply only to an explicitly authorized project schema; adapt an existing ticket model instead of replacing it.
-- Due dates are seeded relative to the install time, so SLA states change as time passes.
create table APEXREST_EXAMPLE_TICKETS (
    ID number generated by default on null as identity primary key,
    TITLE varchar2(200 char) not null,
    DEPARTMENT varchar2(60 char) not null,
    PRIORITY varchar2(10 char) default 'Normal' not null,
    CREATED_AT timestamp default systimestamp not null,
    DUE_AT timestamp not null,
    RESOLVED_AT timestamp,
    constraint APEXREST_EXAMPLE_TICKETS_PRIORITY check (PRIORITY in ('Low', 'Normal', 'High')),
    constraint APEXREST_EXAMPLE_TICKETS_DUE check (DUE_AT >= CREATED_AT)
);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT)
values ('Streetlight out on Main St', 'Electrical', 'High', systimestamp - interval '5' day, systimestamp - interval '2' day);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT)
values ('Overflowing bins at the market', 'Sanitation', 'Normal', systimestamp - interval '3' day, systimestamp - interval '6' hour);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT)
values ('Pothole near school gate', 'Roads', 'High', systimestamp - interval '2' day, systimestamp + interval '5' hour);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT)
values ('Water leak in park', 'Water', 'Normal', systimestamp - interval '1' day, systimestamp + interval '20' hour);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT)
values ('Faded crossing markings', 'Roads', 'Low', systimestamp - interval '1' day, systimestamp + interval '6' day);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT)
values ('Missed collection on 4th Ave', 'Sanitation', 'Normal', systimestamp - interval '2' hour, systimestamp + interval '3' day);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT, RESOLVED_AT)
values ('Broken bench', 'Parks', 'Low', systimestamp - interval '6' day, systimestamp - interval '3' day, systimestamp - interval '4' day);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT, RESOLVED_AT)
values ('Low water pressure', 'Water', 'High', systimestamp - interval '4' day, systimestamp - interval '3' day, systimestamp - interval '1' day);
insert into APEXREST_EXAMPLE_TICKETS (TITLE, DEPARTMENT, PRIORITY, CREATED_AT, DUE_AT, RESOLVED_AT)
values ('Tree branch on road', 'Roads', 'Normal', systimestamp - interval '3' day, systimestamp - interval '1' day, systimestamp - interval '2' day);
commit;

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2026 Aakash

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "7eb73a0cdf03a67dba43b31fdfcfeadb858476be5e20f6d69c764826951b22af",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
