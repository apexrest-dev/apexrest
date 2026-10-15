# Page complexity overview

Read-only overview of one application in the current workspace: a pie chart of pages by complexity and a filterable report of per-page component counts, computed inline from APEX dictionary views; no custom views, packages or writes.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/OliverLemm/apex-visualizer/blob/13e51bf9329524f54b03c9abab935977de408fd5/app/av/pages/p00010.apx",
  "repository": "https://github.com/OliverLemm/apex-visualizer",
  "commit": "13e51bf9329524f54b03c9abab935977de408fd5",
  "path": "app/av/pages/p00010.apx",
  "sourceSha256": "fdc33e1f3b528e2dc6f5006dbc5b41e53f3cf3a5672e46af4524b2ad63eae027",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "localDatabase/sqlQuery; read-only APEX dictionary views of the current workspace",
  "tables": [
    "APEX_APPLICATIONS",
    "APEX_APPLICATION_PAGES",
    "APEX_APPLICATION_PAGE_ITEMS",
    "APEX_APPLICATION_PAGE_REGIONS",
    "APEX_APPLICATION_PAGE_BUTTONS",
    "APEX_APPLICATION_PAGE_PROC",
    "APEX_APPLICATION_PAGE_DA_ACTS",
    "APEX_APPLICATION_PAGE_COMP",
    "APEX_APPLICATION_PAGE_BRANCHES"
  ],
  "bindings": [
    "P1_APP_ID",
    "P1_COMPLEXITY",
    "APP_ID"
  ],
  "submittedItems": [
    "P1_APP_ID",
    "P1_COMPLEXITY"
  ],
  "writes": false,
  "authorization": "Exposes application structure of the whole workspace; restrict the page to developers or administrators."
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename region and dynamic-action identifiers before merging into an existing application.
- Preserve the target application authentication and add a developer or administrator authorization scheme.
- Adjust the object-count thresholds (15, 50, 100) to the project's own complexity policy; keep the counted component views in sync with them.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Page complexity
    alias: HOME
    title: Page complexity
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region filters (
        name: Filters
        type: staticContent
        source {
            htmlCode: <p>Counts items, regions, buttons, processes, dynamic action steps, computations and branches per page from the read-only APEX dictionary views of this workspace.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
    )

    region complexity-chart (
        name: Pages by complexity
        type: chart
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with page_objects as (
                    select application_id, page_id, count(*) counts from apex_application_page_items group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_regions group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_buttons group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_proc group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_da_acts group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_comp group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_branches group by application_id, page_id
                ), page_complexity as (
                    select p.page_id,
                           p.page_name,
                           sum(nvl(o.counts, 0)) object_count
                      from apex_application_pages p
                      left join page_objects o
                        on o.application_id = p.application_id
                       and o.page_id = p.page_id
                     where p.application_id = nvl(:P1_APP_ID, :APP_ID)
                     group by p.page_id, p.page_name
                ), classified as (
                    select page_id,
                           page_name,
                           object_count,
                           case
                               when object_count < 15 then 'Simple'
                               when object_count < 50 then 'Normal'
                               when object_count < 100 then 'Complex'
                               else 'Very complex'
                           end complexity,
                           case
                               when object_count < 15 then 1
                               when object_count < 50 then 2
                               when object_count < 100 then 3
                               else 4
                           end complexity_rank
                      from page_complexity
                )
                select complexity, complexity_rank, count(*) page_count
                  from classified
                 group by complexity, complexity_rank
                 order by complexity_rank
                ```
            pageItemsToSubmit: P1_APP_ID
        }
        layout {
            sequence: 20
            slot: body
            columnSpan: 5
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        chart {
            type: pie
        }
        value {
            format: decimal
            decimalPlaces: 0
        }
        messages {
            whenNoDataFound: No pages in the selected application.
        }

        series pages (
            name: Pages
            execution {
                sequence: 10
            }
            source {
                location: regionSource
            }
            columnMapping {
                label: COMPLEXITY
                value: PAGE_COUNT
            }
            label {
                show: true
                position: outsideSlice
                displayAs: value
            }
        )
    )

    region pages (
        name: Pages
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with page_objects as (
                    select application_id, page_id, count(*) counts from apex_application_page_items group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_regions group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_buttons group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_proc group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_da_acts group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_comp group by application_id, page_id
                    union all
                    select application_id, page_id, count(*) from apex_application_page_branches group by application_id, page_id
                ), page_complexity as (
                    select p.page_id,
                           p.page_name,
                           sum(nvl(o.counts, 0)) object_count
                      from apex_application_pages p
                      left join page_objects o
                        on o.application_id = p.application_id
                       and o.page_id = p.page_id
                     where p.application_id = nvl(:P1_APP_ID, :APP_ID)
                     group by p.page_id, p.page_name
                ), classified as (
                    select page_id,
                           page_name,
                           object_count,
                           case
                               when object_count < 15 then 'Simple'
                               when object_count < 50 then 'Normal'
                               when object_count < 100 then 'Complex'
                               else 'Very complex'
                           end complexity,
                           case
                               when object_count < 15 then 1
                               when object_count < 50 then 2
                               when object_count < 100 then 3
                               else 4
                           end complexity_rank
                      from page_complexity
                )
                select page_id, page_name, object_count, complexity
                  from classified
                 where :P1_COMPLEXITY is null or complexity = :P1_COMPLEXITY
                 order by object_count desc, page_id
                ```
            pageItemsToSubmit: [
                P1_APP_ID
                P1_COMPLEXITY
            ]
        }
        layout {
            sequence: 30
            slot: body
            startNewRow: false
            columnSpan: 7
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
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
            whenNoDataFound: No pages match the selected filters.
        }

        column PAGE_ID (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Page
                alignment: end
            }
            layout {
                sequence: 10
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column PAGE_NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Name
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

        column OBJECT_COUNT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Objects
                alignment: end
            }
            layout {
                sequence: 30
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column COMPLEXITY (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Complexity
            }
            layout {
                sequence: 40
            }
            sorting {
                sortable: false
            }
        )
    )

    pageItem P1_APP_ID (
        type: selectList
        label {
            label: Application
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select application_name || ' (' || application_id || ')' d,
                       application_id r
                  from apex_applications
                 order by application_name, application_id
                ```
            displayExtraValues: false
            nullDisplayValue: Current application
        }
        layout {
            sequence: 10
            region: @filters
            slot: regionBody
            alignment: left
            columnSpan: 6
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    pageItem P1_COMPLEXITY (
        type: selectList
        label {
            label: Complexity
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC:Simple;Simple,Normal;Normal,Complex;Complex,Very complex;Very complex
            displayExtraValues: false
            nullDisplayValue: All
        }
        layout {
            sequence: 20
            region: @filters
            slot: regionBody
            startNewRow: false
            alignment: left
            columnSpan: 6
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
        }
    )

    dynamicAction refresh-on-application (
        name: Refresh after the application changes
        execution {
            sequence: 10
        }
        when {
            event: change
            selectionType: items
            items: P1_APP_ID
        }

        action native-refresh-chart (
            action: refresh
            affectedElements {
                selectionType: region
                region: @complexity-chart
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

        action native-refresh-pages (
            action: refresh
            affectedElements {
                selectionType: region
                region: @pages
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
    )

    dynamicAction refresh-on-complexity (
        name: Refresh after the complexity filter changes
        execution {
            sequence: 20
        }
        when {
            event: change
            selectionType: items
            items: P1_COMPLEXITY
        }

        action native-refresh-pages (
            action: refresh
            affectedElements {
                selectionType: region
                region: @pages
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
    )
)

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2022 Oliver Lemm

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
    "sourceSha256": "a5eec517ba6189f2bead39def3e90e220f13ca3857b628a7d99f172372337381",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
