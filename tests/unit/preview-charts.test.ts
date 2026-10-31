import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import {
  formatTick,
  formatValue,
  niceScale,
} from '../../packages/core/src/preview/extensions/charts/format.ts';
import { initialDate } from '../../packages/core/src/preview/extensions/charts/calendar.ts';
import { workspace } from '../fixtures/preview.ts';

const sql = (query: string) => `
            source {
                type: sqlQuery
                sqlQuery:
                    \`\`\`sql
                    ${query}
                    \`\`\`
            }`;

const chart = (id: string, sequence: number, body: string) => `
    region ${id} (
        name: ${id}
        type: chart
        layout {
            sequence: ${sequence}
            slot: body
        }
${body}
    )`;

const FILES: Record<string, string> = {
  '.apex-local/02-viz.sql': `create table sales (quarter varchar2(5), region varchar2(10), amount number, cost number);
insert into sales values ('Q1', 'North', 100, 60);
insert into sales values ('Q1', 'South', 80, 50);
insert into sales values ('Q2', 'North', 150, 70);
insert into sales values ('Q2', 'South', 90, 40);
create table events (id integer primary key, title varchar2(50), start_date date, end_date date, css varchar2(30));
insert into events (title, start_date, end_date, css) values ('Kickoff', '2026-03-03 09:00:00', '2026-03-03 10:00:00', 'apex-cal-green');
insert into events (title, start_date, end_date, css) values ('Offsite', '2026-03-10', '2026-03-11', null);
insert into events (title, start_date, end_date, css) values ('Retro', '2026-04-20', null, null);
create table offices (id integer primary key, city varchar2(30), lon number, lat number);
insert into offices (city, lon, lat) values ('Austin', -97.7, 30.3);
insert into offices (city, lon, lat) values ('Reading', -0.97, 51.45);
`,
  'pages/p00003-charts.apx': `page 3 (
    name: Charts
    alias: CHARTS
${chart(
  'stacked',
  10,
  `        chartAppearance {
            stack: true
        }
        series s (
            name: Sales
${sql('select quarter, region, amount from sales order by quarter')}
            columnMapping {
                label: QUARTER
                value: AMOUNT
                seriesName: REGION
            }
            label {
                show: true
            }
            link {
                type: redirectThisApp
                target: {
                    page: 1
                    items: {
                        P1_TITLE: &QUARTER.
                    }
                }
            }
        )
        axis y (
            name: y
            title: Revenue
            value {
                max: 300
            }
        )`,
)}
${chart(
  'donut',
  20,
  `        chart {
            type: donut
        }
        overview {
            show: true
        }
        series s (
            name: Regions
${sql('select region, sum(amount) amount from sales group by region')}
            columnMapping {
                label: REGION
                value: AMOUNT
            }
        )`,
)}
${chart(
  'trend',
  30,
  `        chart {
            type: line
        }
        series s (
            name: Amount
${sql('select quarter, sum(amount) amount from sales group by quarter order by 1')}
            columnMapping {
                label: QUARTER
                value: AMOUNT
            }
        )`,
)}
${chart(
  'meter',
  40,
  `        chart {
            type: statusMeterGauge
        }
        series s (
            name: Utilization
${sql('select region, sum(cost) cost, 200 mx from sales group by region')}
            columnMapping {
                label: REGION
                value: COST
                maxValue: MX
            }
        )`,
)}
${chart(
  'spread',
  50,
  `        chart {
            type: bubble
        }
        series s (
            name: Spread
${sql('select region, cost, amount, amount - cost profit from sales')}
            columnMapping {
                label: REGION
                x: COST
                y: AMOUNT
                z: PROFIT
            }
        )`,
)}
)
`,
  'pages/p00004-calendar.apx': `page 4 (
    name: Events
    alias: EVENTS
    region events (
        name: Events
        type: calendar
${sql('select id, title, start_date, end_date, css from events')}
        layout {
            sequence: 10
            slot: body
        }
        settings {
            displayColumn: TITLE
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            pkColumn: ID
            cssClass: CSS
            additionalCalendarViews: list
            viewEditLink: {
                page: 1
                items: {
                    P1_TITLE: &ID.
                }
            }
        }
    )
)
`,
  'pages/p00005-map.apx': `page 5 (
    name: Offices
    alias: OFFICES
    region offices (
        name: Offices
        type: map
        layout {
            sequence: 10
            slot: body
        }
        layer cities (
            name: Cities
            layerType: points
            source {
                tableName: OFFICES
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LON
                latitudeColumn: LAT
            }
            tooltip {
                column: CITY
            }
        )
    )
    region empty-map (
        name: Nowhere
        type: map
        layout {
            sequence: 20
            slot: body
        }
    )
)
`,
};

test('chart value formatting and axis scales follow JET conventions', () => {
  assert.deepEqual(niceScale(0, 87), { min: 0, max: 100, step: 20 });
  assert.equal(formatTick(150_000, {}, 50_000), '150K');
  assert.equal(formatValue(1234.5, { format: 'currency', currency: 'USD', decimalPlaces: 0 }), '$1,235');
  assert.equal(formatValue(0.256, { format: 'percent', decimalPlaces: 0 }), '26%');
  assert.equal(formatValue(2_500_000, { scaling: 'auto' }), '2.5M');
  assert.equal(
    initialDate([{ title: 'x', start: '2026-03-03', allDay: true }], new Date(2026, 0, 15)),
    '2026-03-03',
  );
});

test('chart regions render SVG for stacked bars, donut, line, gauge and bubble', async (t) => {
  const { app, assets } = await workspace(t, FILES);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const html = await (await fetch(`${server.url}/r/demo/charts`)).text();
  const region = (id: string) => {
    const start = html.indexOf(`id="${id}_jet"`);
    assert.ok(start > 0, `chart ${id} rendered`);
    return html.slice(start, html.indexOf('</svg>', start));
  };

  const stacked = region('stacked');
  assert.match(stacked, /data-chart-type="bar"/);
  assert.equal((stacked.match(/class="ajc-bar"/g) ?? []).length, 4);
  assert.match(stacked, /class="ajc-legend-item" data-series="North"/);
  assert.match(stacked, /class="ajc-axis-title"[^>]*>Revenue</);
  assert.match(stacked, />300</, 'axis max honored');
  assert.match(stacked, /href="\/r\/demo\/home\?p1_title=Q1"/);
  assert.match(stacked, /data-tip="Series\tNorth\nGroup\tQ1\nValue\t100"/);
  assert.match(stacked, /class="ajc-value"[^>]*>150</);

  const donut = region('donut');
  assert.equal((donut.match(/class="ajc-slice"/g) ?? []).length, 2);
  assert.match(donut, /class="ajc-center-value"[^>]*>420</);

  const trend = region('trend');
  assert.match(trend, /class="ajc-line" d="M[\d.]+ [\d.]+L/);

  const meter = region('meter');
  assert.match(meter, /class="ajc-gauge-track"/);
  assert.match(meter, /class="ajc-gauge-text"[^>]*>130</);

  const spread = region('spread');
  assert.equal((spread.match(/class="ajc-bubble"/g) ?? []).length, 4);

  // The browser asks for a redraw at its measured width.
  const redraw = await (
    await fetch(`${server.url}/r/demo/__apex/x/chart?page=3&region=stacked&width=900`)
  ).text();
  assert.match(redraw, /^<svg[^>]+viewBox="0 0 900 400"/);
  assert.equal((await fetch(`${server.url}/r/demo/__apex/x/chart?page=3&region=nope`)).status, 404);
});

test('calendar regions feed FullCalendar from SQL and maps draw offline', async (t) => {
  const { app, assets } = await workspace(t, FILES);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());

  const page = await (await fetch(`${server.url}/r/demo/events`)).text();
  const config = JSON.parse(
    /data-calendar="([^"]+)"/.exec(page)![1]!.replaceAll('&quot;', '"').replaceAll('&#x27;', "'"),
  ) as { initialDate: string; list: boolean; navigation: boolean; count: number };
  assert.equal(config.list, true);
  assert.equal(config.navigation, false);
  assert.equal(config.count, 3);
  assert.match(config.initialDate, /^2026-0[34]/);

  const feed = (await (
    await fetch(
      `${server.url}/r/demo/__apex/x/calendar?page=4&region=events&start=2026-03-01T00:00:00&end=2026-04-01T00:00:00`,
    )
  ).json()) as {
    title: string;
    start: string;
    end?: string;
    allDay: boolean;
    className?: string;
    url?: string;
  }[];
  assert.deepEqual(
    feed.map((event) => [event.title, event.start, event.end, event.allDay]),
    [
      ['Kickoff', '2026-03-03T09:00:00', '2026-03-03T10:00:00', false],
      ['Offsite', '2026-03-10', '2026-03-12', true],
    ],
  );
  assert.equal(feed[0]!.className, 'apex-cal-green');
  assert.equal(feed[0]!.url, '/r/demo/home?p1_title=1');

  const map = await (await fetch(`${server.url}/r/demo/offices`)).text();
  assert.match(map, /Offline map preview/);
  assert.equal((map.match(/class="apex-local-map-point"/g) ?? []).length, 2);
  assert.match(map, /data-tip="Cities\tAustin"/);
  assert.match(map, /No mappable rows \(the map has no layers\)/);

  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.filter((entry) => entry.error),
    [],
  );
  assert.ok(
    result.diagnostics.some((entry) =>
      /Chart donut \(donut\) is drawn by the local SVG renderer/.test(entry.message),
    ),
  );
  assert.ok(result.diagnostics.some((entry) => /overview\.show not simulated/.test(entry.message)));
  assert.ok(result.diagnostics.some((entry) => /Map offices is drawn offline/.test(entry.message)));
});
