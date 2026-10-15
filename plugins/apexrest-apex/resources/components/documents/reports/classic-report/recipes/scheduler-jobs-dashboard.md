# Scheduler jobs health dashboard

Read-only monitoring page over the parsing schema's USER_SCHEDULER_* views: badge-list status counts, the last 20 failed runs in 72 hours and jobs due within 60 minutes; no application tables, packages or writes.

Status: ready.

Component: component:reports/classic-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/Aftorres02/OracleAPEX-ErrorShield/blob/71232a717ce6679d6fb843ed2647e194c8f3a54c/apex/apex_lang/app_10400/pages/p01000-jobs-dashboard.apx",
  "repository": "https://github.com/Aftorres02/OracleAPEX-ErrorShield",
  "commit": "71232a717ce6679d6fb843ed2647e194c8f3a54c",
  "path": "apex/apex_lang/app_10400/pages/p01000-jobs-dashboard.apx",
  "sourceSha256": "850eba9a9bcf923dd756ef795177a56536d15da5fe89ab7fa5994c9f69aeb4db",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "localDatabase/sqlQuery; read-only Oracle Scheduler dictionary views of the parsing schema",
  "tables": [
    "USER_SCHEDULER_JOBS",
    "USER_SCHEDULER_RUNNING_JOBS",
    "USER_SCHEDULER_JOB_RUN_DETAILS",
    "DUAL"
  ],
  "bindings": [],
  "submittedItems": [],
  "writes": false
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename region, button and DOM identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Keep USER_SCHEDULER_* unless an authorized administrator page needs ALL_ or DBA_ views; those expose other schemas' job names and error details.
- Restrict the page with an administrator authorization scheme in the target application.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Scheduler jobs dashboard
    alias: HOME
    title: Scheduler jobs dashboard
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: doNotFocusCursor
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
        formAutoComplete: false
    }

    region status (
        name: Status
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select (select count(*) from user_scheduler_jobs) VISIBLE_JOBS
                     , (select count(*) from user_scheduler_jobs where enabled = 'TRUE') ENABLED
                     , (select count(*) from user_scheduler_jobs where state in ('BROKEN', 'FAILED')) BROKEN_OR_FAILED
                     , (select count(*) from user_scheduler_running_jobs) RUNNING_NOW
                     , (select count(*)
                          from user_scheduler_job_run_details
                         where log_date >= systimestamp - interval '1' day
                           and nvl(status, 'UNKNOWN') <> 'SUCCEEDED') FAILED_RUNS_24H
                  from dual
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
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
        }
        reportLayout {
            numberOfRows: 1
        }
        componentAppearance {
            template: @/badge-list
            templateOptions: [
                #DEFAULT#
                u-colors
                t-BadgeList--medium
                t-BadgeList--dash
                t-BadgeList--fixed
                t-Report--hideNoPagination
            ]
        }

        column VISIBLE_JOBS (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Jobs
            }
            layout {
                sequence: 10
            }
        )

        column ENABLED (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Enabled
            }
            layout {
                sequence: 20
            }
        )

        column BROKEN_OR_FAILED (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Broken or failed
            }
            layout {
                sequence: 30
            }
        )

        column RUNNING_NOW (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Running now
            }
            layout {
                sequence: 40
            }
        )

        column FAILED_RUNS_24H (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Failed runs 24h
            }
            layout {
                sequence: 50
            }
        )
    )

    region recent-failures (
        name: Recent failures - 72 h
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select LOG_ID, JOB_NAME, STATUS, ERROR_CODE, STARTED_AT, RUN_SECONDS
                  from (select d.log_id LOG_ID
                             , d.job_name JOB_NAME
                             , d.status STATUS
                             , d.error# ERROR_CODE
                             , to_char(d.actual_start_date, 'YYYY-MM-DD HH24:MI') STARTED_AT
                             , round(extract(day from d.run_duration) * 86400
                                   + extract(hour from d.run_duration) * 3600
                                   + extract(minute from d.run_duration) * 60
                                   + extract(second from d.run_duration), 1) RUN_SECONDS
                          from user_scheduler_job_run_details d
                         where d.log_date >= systimestamp - interval '3' day
                           and nvl(d.status, 'UNKNOWN') <> 'SUCCEEDED'
                         order by d.log_date desc
                         fetch first 20 rows only)
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
                t-Region--scrollBody
            ]
        }
        pagination {
            type: nextAndPreviousLinks
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
            whenNoDataFound: No failed runs in the last 72 hours.
        }

        column LOG_ID (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Log ID
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
        )

        column JOB_NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Job
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

        column STATUS (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Status
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column ERROR_CODE (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Error
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )

        column STARTED_AT (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Started
            }
            layout {
                sequence: 50
            }
            sorting {
                sortable: false
            }
        )

        column RUN_SECONDS (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Seconds
            }
            layout {
                sequence: 60
            }
            sorting {
                sortable: false
            }
        )
    )

    region next-runs (
        name: Next runs - 60 min
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select JOB_NAME, NEXT_RUN_AT, SCHEDULE_TYPE, REPEAT_INTERVAL
                  from (select j.job_name JOB_NAME
                             , to_char(j.next_run_date, 'HH24:MI') NEXT_RUN_AT
                             , j.schedule_type SCHEDULE_TYPE
                             , j.repeat_interval REPEAT_INTERVAL
                             , j.next_run_date NEXT_RUN_DATE
                          from user_scheduler_jobs j
                         where j.enabled = 'TRUE'
                           and j.next_run_date is not null
                           and j.next_run_date <= systimestamp + interval '60' minute)
                 order by NEXT_RUN_DATE
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
                t-Region--scrollBody
            ]
        }
        pagination {
            type: nextAndPreviousLinks
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
            whenNoDataFound: No enabled jobs are due in the next 60 minutes.
        }

        column JOB_NAME (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Job
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
        )

        column NEXT_RUN_AT (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Next run
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

        column SCHEDULE_TYPE (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Schedule type
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column REPEAT_INTERVAL (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Repeat interval
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )
    )
)

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2026 Angel Flores

Copyright (c) 2015 OraOpenSource

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
    "sourceSha256": "d9e30ea547eabc8fff36053bd30241125c82c2b48b86d20845adc4bed0d18805",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
