# Classic Report conditional template directives

Classic Report with escaped CASE status labels, optional IF error details and LOOP tags; complete synthetic DUAL data, no retry actions or business-table dependencies.

Status: ready.

Component: component:reports/classic-report.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/denioflavio/apex-template-directives/blob/f42cfbdc5e0dbccc085af1d1d16980b33dcde3ba/application/apex-template-directives/pages/p00001-home.apx",
  "repository": "https://github.com/denioflavio/apex-template-directives",
  "commit": "f42cfbdc5e0dbccc085af1d1d16980b33dcde3ba",
  "path": "application/apex-template-directives/pages/p00001-home.apx",
  "sourceSha256": "687624e273bc61b4f40e98493e0265702a49eb48b1e2979d1942bb3a3fe9c79b",
  "license": "MIT",
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
- Rename region, button and dynamic-action identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and retain every submitted item and column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Conditional report templates
    alias: HOME
    title: Conditional report templates
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    css {
        inline:
            ```css
            .recipe-state { display: grid; gap: .4rem; }
            .recipe-state p { margin: 0; }
            .recipe-completed { color: #166534; }
            .recipe-processing { color: #075985; }
            .recipe-waiting { color: #854d0e; }
            .recipe-failed { color: #991b1b; }
            .recipe-tags { display: flex; flex-wrap: wrap; gap: .35rem; }
            .recipe-tag { border: 1px solid #cbd5e1; border-radius: 1rem; padding: .1rem .5rem; }
            ```
    }
    region results (
        name: Synthetic job states
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 1 ID, 'INV-001' REFERENCE, 'COMPLETED' STATUS, cast(null as varchar2(100)) ERROR_MESSAGE, 'invoice:priority' TAGS from dual
                union all select 2, 'INV-002', 'FAILED', 'The sample payload requires a reference.', 'invoice:review' from dual
                union all select 3, 'ORD-003', 'PROCESSING', null, 'order' from dual
                union all select 4, 'ORD-004', 'WAITING', null, null from dual
                order by ID
                ```
        }
        layout {
            sequence: 10
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
        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )
        column REFERENCE (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Reference
            }
            layout {
                sequence: 20
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
            columnFormatting {
                htmlExpression:
                    ```html
                    <div class="recipe-state">
                      {case STATUS/}
                        {when COMPLETED/}<strong class="recipe-completed">Completed</strong>
                        {when PROCESSING/}<strong class="recipe-processing">Processing</strong>
                        {when WAITING/}<strong class="recipe-waiting">Waiting</strong>
                        {when FAILED/}<strong class="recipe-failed">Failed</strong>
                        {otherwise/}<strong>#STATUS!HTML#</strong>
                      {endcase/}
                      {if ?ERROR_MESSAGE/}<p class="recipe-failed">#ERROR_MESSAGE!HTML#</p>{endif/}
                      {if ?TAGS/}
                        <div class="recipe-tags" aria-label="Tags">
                          {loop ":" TAGS/}<span class="recipe-tag">&APEX$ITEM!HTML.</span>{endloop/}
                        </div>
                      {endif/}
                    </div>
                    ```
            }
        )
        column ERROR_MESSAGE (
            reportColumnQueryId: 4
            derivedColumn: N
            type: hidden
            layout {
                sequence: 40
            }
        )
        column TAGS (
            reportColumnQueryId: 5
            derivedColumn: N
            type: hidden
            layout {
                sequence: 50
            }
        )
    )
)

```

## LICENSE.txt

```text
MIT License

Copyright (c) 2026 Denio Flavio

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
    "sourceSha256": "8abfca0c3f75ba2c37cedfe606ac57ca658d16f32a2a7aa8b4c38f11fe948538",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
