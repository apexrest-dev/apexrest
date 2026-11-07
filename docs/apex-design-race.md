# Developing with the APEXREST plugin is 2 times faster than classic skill-based development, and here is why

_A field report from 6–7 November 2026. Every figure comes from recorded runs on a local Oracle database. Each setup ran once; the limits are listed at the end._

## The task

A Claude Code agent (model claude-opus-5-5, effort high) received the same task twice: build an [Oracle APEX](https://apex.oracle.com/) application called **Bitcoin Price Monitor** on tables that already held a month of hourly prices. The application had five parts:

- a dashboard with the latest price, the 24-hour change and a 7-day price chart;
- a price history report;
- an alerts page with a modal form to create, edit and delete alerts;
- an alert events page with a filter and an "acknowledge all" button;
- a navigation menu.

A separate requirement covered design: open the dashboard in Chrome, review it as a designer and keep fixing it until it looks professional (a clear price hierarchy, a colored change, even spacing, a readable chart), then import the application again and check once more.

Both runs started from the same empty application, with the same database (Oracle AI Database 26ai Free, APEX 26.2, ORDS and SQLcl 26.3), the same model and the same browser. Only the toolset differed.

## Two toolsets

**The classic run** had Oracle's official APEXlang skill (a description of the text format an APEX application can be written in) and SQLcl (Oracle's tool for compiling and importing). To see any change, the agent has to compile the application, import it into APEX on the database server, reload the page in the browser and look.

**The APEXREST run** had the plugin with these tools:

1. **`apexrest_reference`**: the component library. Its `select` mode returns, for every named component in one request, a working APEXlang block from Oracle's sample applications, whole-page examples and entry skeletons.
2. **`apexrest_apex_validate`**: the Oracle compiler, whose diagnostics carry a `Fix:` hint taken from the property contract.
3. **`apexrest_preview`**: a local APEX renderer on Node.js. It reproduces the Universal Theme and, with `env`, runs the pages' SQL and PL/SQL on a DEV/QA/TEST database, rolling the transaction back after every request. When an `.apx` file is saved, the open page reloads automatically.
4. **`apexrest_ship`**: delivery in one call: compile, plan, back up, import into the development application and verify that the import reached the right target.

## Results

![Where the time went in the two runs. Without the plugin: about 8 minutes of building, then about 14 minutes in the edit, compile, import and reload loop, with 8 imports. With APEXREST: about 3 minutes of building, design polishing in the local preview, 2 imports, finishing at 10.1 minutes.](assets/apex-design-race-timeline.svg)

|                                 |                  Without the plugin | With APEXREST |       Difference |
| ------------------------------- | ----------------------------------: | ------------: | ---------------: |
| Total time                      |                         22 min 11 s |    10 min 4 s | 2.2 times faster |
| Agent turns                     |                                 192 |           121 |             −37% |
| Imports into APEX               | 8 (+1 attempt without confirmation) |             2 |    4 times fewer |
| Browser actions                 |                                 124 |            63 |             −49% |
| Model cost (API price estimate) |                               $8.04 |         $5.01 |             −38% |

Both applications compile without errors and were imported into the development database. The dashboards look comparably professional: the plugin does not make the agent a better designer, but each design iteration costs less.

![The finished dashboard built without the plugin: a price card, a green 24-hour change, an amber events count and a 7-day line chart scaled from $100,000 to $110,000.](assets/apex-design-race-without-plugin.png)

![The finished dashboard built with APEXREST: a large price card, a green 24-hour change badge, an amber open-events count with a "Review events" link, and a 7-day chart scaled from $100,000 to $110,000.](assets/apex-design-race-with-plugin.png)

## Why the plugin run is faster

### 1. References in one request instead of reading files

The classic agent studied the APEXlang skill with dozens of shell commands that read its reference files, and built, compiled and first imported the application after a little over **8 minutes**.

The plugin agent asked for everything it needed in one `apexrest_reference mode:select` call: a chart, cards, an interactive report, a modal form, a switch and buttons. It received working blocks from Oracle samples to adapt instead of reconstructing syntax from a description. Its first page was written after about **1.5 minutes**, and at about the **3-minute** mark it was already viewing it in the browser.

Fewer files read means fewer tokens in the context of every later turn, which reduces both time and cost.

### 2. A design loop without imports

This is the main source of the difference. In the classic run every design change went through the full loop:

```
edit .apx → compile with SQLcl → import on the APEX server → reload the page → check
```

After the first import this loop ran **7 more times**, and one more import attempt never reported success. Design polishing took about **14** of the 22 minutes, nearly 2 minutes per iteration on average.

With the plugin the loop shrinks to:

```
edit .apx → automatic apexrest_preview reload → check
```

`apexrest_preview` renders pages locally with the Universal Theme and real data from the DEV database, so an iteration takes seconds. The APEX server takes no part in the loop, and rolling back the transaction after every request ensures the preview changes no data.

In that time the agent fixed what a designer usually fixes: a generic banner, four identical cards, a chart whose Y axis started at zero, raw timestamps on the axis and an unneeded legend. Walking through the other pages, it noticed that the alert filter rendered _below_ its report instead of above it and moved it. All of this happened before the first import, at about **6.5 minutes**.

![The same dashboard in the local preview with live data. The developer toolbar at the bottom shows diagnostics, session state and the live-reload status.](assets/apex-design-race-local-preview.png)

### 3. Delivery in one call

`apexrest_ship mode:apply` combines compilation, plan, backup, import and verification in one call. The agent does not have to write and run SQLcl import scripts and then check the result separately. The plugin run therefore had 2 imports, both with an unambiguous result.

### 4. Fewer turns and browser actions

Each iteration of the classic loop costs several agent turns (compile, import, check the result) and several browser actions (reload, sign in, navigate to the page). Moving the iterations into the local preview cut agent turns by 37%, browser actions by 49% and cost by 38%.

## Limits of the local preview

The local preview is for design, not for final acceptance. Its charts are drawn by its own renderer, not by the Oracle JET library that APEX uses. Therefore:

- chart initialization JavaScript functions that APEX runs are not applied locally. `apexrest_preview` lists them under `notAppliedLocally` and shows a visible note under the chart reminding the agent to check it in the imported application;
- the tooltip format can differ locally from Oracle JET.

![The local preview with a red-bordered note under the chart: the chart's initialization JavaScript function is not applied locally; check its axes, formats and tooltips on the imported application.](assets/apex-design-race-preview-note.png)

The tooltip is exactly why the plugin run needed a second import: in real APEX the agent saw that the tooltip showed only the date and a rounded price, added the hour and the exact price and imported again. That is why the plugin's workflow ends with a final check of charts in real APEX.

## Limits of the experiment

- **One run per setup.** Run-to-run variation is large: another plugin run on the same task took 13 min 36 s (1.6 times faster than the classic run) and cost $4.15.
- **Different instructions.** The plugin agent's instructions named its tools and required checks in the local preview; the classic agent was pointed at Oracle's skill.
- **Synthetic data and a local target.** The test used Oracle Database Free on the same machine. Neither agent clicked buttons that change data (delete, "acknowledge all") in the browser.
- **Model cost** is an estimate at API prices for the Claude model only.

## Conclusion

When design is finished in a browser, most of the time goes into the loop of edit, import, reload and check. APEXREST removes the server import and the syntax lookup in reference files from that loop. In this test the agent imported the application 2 times instead of 8, finished 2.2 times faster and spent 38% less. The final check in real APEX stays, because that is where the application runs.

To try it: [Getting started](getting-started.md), more on the [local preview](local-preview.md), and how imports stay safe in [deployment safety](deployment-safety.md).
