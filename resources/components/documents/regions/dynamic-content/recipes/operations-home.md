# PL/SQL Dynamic Content operations home

Custom landing page rendered by one PL/SQL Dynamic Content region: escaped queue cards from synthetic DUAL rows, APEX-built checksummed links into a hidden item, scoped CSS and page-level filter JavaScript; no packages, tables or writes.

Status: ready.

Component: component:regions/dynamic-content.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/denioflavio/apex-plsql-dynamic-content-home/blob/280972ef0a5442aee774dfcb25a6a8cd39ca42c7/database/21_package_body.sql",
  "repository": "https://github.com/denioflavio/apex-plsql-dynamic-content-home",
  "commit": "280972ef0a5442aee774dfcb25a6a8cd39ca42c7",
  "path": "database/21_package_body.sql",
  "sourceSha256": "97689a2757a5127d71244f8f66bc643c82489ea27a3c9f641cb831f62f79a1e2",
  "license": "MIT",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "PL/SQL Dynamic Content CLOB from synthetic DUAL rows",
  "tables": [
    "DUAL"
  ],
  "bindings": [
    "P1_QUEUE"
  ],
  "submittedItems": [],
  "writes": false
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename region, button and DOM identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic rows only with authorized project SQL; escape every value with apex_escape.html or apex_escape.html_attribute and build links with apex_page.get_url.
- Move the rendering into a project package when the HTML grows; keep the page CSS and JavaScript scoped to the region class.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Operations home
    alias: HOME
    title: Operations home
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
    javaScript {
        executeWhenPageLoads:
            ```javascript
            document.querySelectorAll('.recipe-home .recipe-filter').forEach(function (button) {
                button.addEventListener('click', function () {
                    var target = button.getAttribute('data-filter');
                    document.querySelectorAll('.recipe-home .recipe-filter').forEach(function (other) {
                        other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
                    });
                    document.querySelectorAll('.recipe-home .recipe-queue-card').forEach(function (card) {
                        card.toggleAttribute('data-muted', target !== 'ALL' && card.getAttribute('data-status') !== target);
                    });
                });
            });
            ```
    }
    css {
        inline:
            ```css
            .recipe-home { display: grid; gap: 1rem; }
            .recipe-hero { display: grid; gap: .75rem; padding: 1.25rem; border-radius: .5rem; color: #fff; background: linear-gradient(135deg, #101a31, #0a7f8d); }
            .recipe-hero h1 { margin: 0; font-size: 2rem; line-height: 1.1; }
            .recipe-hero p { margin: 0; max-width: 68ch; }
            .recipe-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: .75rem; }
            .recipe-toolbar h2 { margin: 0; font-size: 1.1rem; }
            .recipe-filters { display: flex; flex-wrap: wrap; gap: .4rem; }
            .recipe-filter { border: 1px solid #cbd5e1; border-radius: 1rem; padding: .35rem .7rem; background: #fff; cursor: pointer; }
            .recipe-filter[aria-pressed="true"] { color: #fff; background: #172033; border-color: #172033; }
            .recipe-queue { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .75rem; }
            .recipe-queue-card { display: grid; gap: .3rem; padding: 1rem; border: 1px solid #dce3ee; border-radius: .5rem; color: inherit; text-decoration: none; }
            .recipe-queue-card:hover { text-decoration: none; box-shadow: 0 .5rem 1.5rem rgba(23, 32, 51, .12); }
            .recipe-queue-card[data-muted] { opacity: .35; }
            .recipe-value { font-size: 2rem; font-weight: 700; }
            .recipe-detail { color: #657186; }
            .recipe-status { justify-self: start; border-radius: 1rem; padding: .1rem .5rem; background: #f4f7fb; font-weight: 700; }
            .recipe-status-critical { color: #991b1b; }
            .recipe-status-pending { color: #854d0e; }
            .recipe-status-scheduled { color: #075985; }
            .recipe-status-healthy { color: #166534; }
            ```
    }

    pageItem P1_QUEUE (
        type: hidden
        settings {
            valueProtected: false
        }
        layout {
            sequence: 10
            slot: body
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    region operations-home (
        name: Operations home
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                declare
                    l_html clob;

                    procedure append(p_text in varchar2) is
                    begin
                        dbms_lob.writeappend(l_html, length(p_text), p_text);
                    end append;
                begin
                    dbms_lob.createtemporary(l_html, true);
                    append('<section class="recipe-home" aria-label="Operations home">');
                    append('<div class="recipe-hero"><h1>Operations home</h1>');
                    append('<p>One PL/SQL Dynamic Content region renders a composed landing surface. Every value is escaped and every link is built by APEX.</p></div>');
                    append('<div class="recipe-toolbar"><h2>Operational queues</h2><div class="recipe-filters" role="group" aria-label="Queue filters">');
                    for filter in (
                        select 'ALL' code, 'All' label, 1 seq from dual
                        union all select 'CRITICAL', 'Critical', 2 from dual
                        union all select 'PENDING', 'Pending', 3 from dual
                        union all select 'SCHEDULED', 'Scheduled', 4 from dual
                        order by seq
                    ) loop
                        append('<button type="button" class="recipe-filter" data-filter="' || apex_escape.html_attribute(filter.code)
                            || '" aria-pressed="' || case when filter.code = 'ALL' then 'true' else 'false' end || '">'
                            || apex_escape.html(filter.label) || '</button>');
                    end loop;
                    append('</div></div><div class="recipe-queue">');
                    for card in (
                        select 1 seq, 'Critical incidents' title, '7' value_text, 'Production-impacting work waiting for ownership.' detail_text, 'CRITICAL' status, 'fa-bolt' icon from dual
                        union all select 2, 'Pending approvals', '18', 'Requests paused before the next operational step.', 'PENDING', 'fa-hourglass-half' from dual
                        union all select 3, 'Scheduled changes', '12', 'Changes planned for the next maintenance window.', 'SCHEDULED', 'fa-calendar-check-o' from dual
                        union all select 4, 'Healthy services', '96%', 'Services without alerts in the current monitoring window.', 'HEALTHY', 'fa-check-circle-o' from dual
                        order by seq
                    ) loop
                        append('<a class="recipe-queue-card" data-status="' || apex_escape.html_attribute(card.status) || '" href="'
                            || apex_escape.html_attribute(apex_page.get_url(p_page => 1, p_items => 'P1_QUEUE', p_values => card.status)) || '">');
                        append('<span class="fa ' || apex_escape.html_attribute(card.icon) || '" aria-hidden="true"></span>');
                        append('<strong>' || apex_escape.html(card.title) || '</strong>');
                        append('<span class="recipe-value">' || apex_escape.html(card.value_text) || '</span>');
                        append('<span class="recipe-detail">' || apex_escape.html(card.detail_text) || '</span>');
                        append('<span class="recipe-status recipe-status-' || apex_escape.html_attribute(lower(card.status)) || '">'
                            || apex_escape.html(card.status) || '</span></a>');
                    end loop;
                    append('</div>');
                    if :P1_QUEUE is not null then
                        append('<p>Selected queue: <strong>' || apex_escape.html(:P1_QUEUE) || '</strong></p>');
                    end if;
                    append('</section>');
                    return l_html;
                end;
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
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
    "sourceSha256": "585d8b5f45c2fb629f9df9e0d3fbbfa583284e8be243ffa150155226d166fe93",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
