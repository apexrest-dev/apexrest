import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApplication, PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const SEARCH_PAGE = `page 3 (
    name: Products
    alias: PRODUCTS

    region search (
        name: Search
        type: facetedSearch
        source {
            filteredRegion: @products
        }
        layout {
            sequence: 10
        }
        settings {
            showCurrentFacets: selector
            currentFacetsSelector: #active_facets
            showTotalRowCount: true
        }

        facet P3_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: NAME
            }
        )

        facet P3_CATEGORY (
            type: checkboxGroup
            label {
                label: Category
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 20
            }
            listEntries {
                maxDisplayedEntries: 7
            }
            source {
                databaseColumn: CATEGORY
            }
        )

        facet P3_PRICE (
            type: range
            label {
                label: Price
            }
            settings {
                selectMultiple: true
            }
            lov {
                type: staticValues
                staticValues: STATIC2:<10;|10,10 - 1#G#000;10|1000,>=1#G#000;1000|
            }
            layout {
                sequence: 30
            }
            source {
                databaseColumn: PRICE
                dataType: number
            }
        )

        facet P3_RATING (
            type: radioGroup
            label {
                label: Rating
            }
            lov {
                type: staticValues
                staticValues: STATIC2:Good;G,Bad;B
            }
            layout {
                sequence: 40
            }
            source {
                databaseColumn: RATING
            }
        )
    )

    region products (
        name: Products
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select product_id, name, category, price, rating
                  from products
                 order by product_id
                \`\`\`
        }
        layout {
            sequence: 20
        }
    )
)
`;

const CARDS_PAGE = `page 4 (
    name: Gallery
    alias: GALLERY

    region gallery (
        name: Gallery
        type: cards
        source {
            location: localDatabase
            tableName: PRODUCTS
        }
        orderBy {
            type: item
            item: {
                itemName: P4_ORDER_BY
                orderBys: {
                    NAME: "NAME" asc
                    PRICE: "PRICE" desc
                }
            }
        }
        layout {
            sequence: 10
        }
        componentAppearance {
            layout: grid
            gridColumns: 3
        }
        title {
            column: NAME
        }
        subtitle {
            advancedFormatting: true
            htmlExpression: <b>#CATEGORY#</b>{if RATING/} rated #RATING#{endif/}
        }
        body {
            column: PRICE
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: NAME
            badgeColumn: RATING
            badgeLabel: Rating
        }
        media {
            source: urlColumn
            urlColumn: IMAGE_URL
            position: first
            appearance: square
        }
        pagination {
            type: page
            cardsPerPage: 4
        }

        action open (
            position: fullCard
            behavior {
                type: redirectThisApp
                target: {
                    page: 3
                    items: {
                        P3_SEARCH: \\#NAME#\\
                    }
                }
            }
        )

        action edit (
            position: primary
            template: button
            label: Edit #NAME#
            appearance {
                displayType: textWithIcon
                icon: fa-pencil
                hot: true
            }
            behavior {
                type: redirectUrl
                targetUrl: https://example.com/edit?id=#PRODUCT_ID#
            }
        )
    )

    pageItem P4_ORDER_BY (
        type: selectList
        label {
            label: Order By
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Name;NAME,Price;PRICE
        }
        layout {
            sequence: 10
            region: @gallery
        }
        default {
            type: static
            staticValue: NAME
        }
    )
)
`;

const MORE_PAGE = `page 5 (
    name: More
    alias: MORE

    region selector (
        name: Selector
        type: regionDisplaySelector
        layout {
            sequence: 5
        }
    )

    region filters (
        name: Filters
        type: smartFilters
        source {
            filteredRegion: @list
        }
        layout {
            sequence: 10
        }

        filter P5_CATEGORY (
            type: checkboxGroup
            label {
                label: Category
            }
            lov {
                type: distinctValues
            }
            source {
                databaseColumn: CATEGORY
            }
            suggestions {
                type: staticValues
                staticValues: [ Tools ]
            }
        )
    )

    region list (
        name: Product List
        type: listView
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select name, category from products order by name
                \`\`\`
        }
        layout {
            sequence: 20
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            features: [ search advancedFormatting ]
            textFormatting: <strong>&NAME.</strong> &CATEGORY!HTML.
        }
    )

    region notes (
        name: Notes
        type: staticContent
        source {
            htmlCode: Notes
        }
        layout {
            sequence: 30
        }
        advanced {
            regionDisplaySelector: true
        }
    )
)
`;

const DATA = `create table products (
  product_id integer primary key,
  name varchar2(100),
  category varchar2(30),
  price number,
  rating varchar2(1),
  image_url varchar2(200)
);
insert into products values (1, 'Hammer', 'Tools', 25, 'G', '/img/1.png');
insert into products values (2, 'Saw', 'Tools', 40, 'B', '/img/2.png');
insert into products values (3, 'Apple', 'Food', 2, 'G', '/img/3.png');
insert into products values (4, 'Bread', 'Food', 4, null, '/img/4.png');
insert into products values (5, 'Laptop', 'Electronics', 1500, 'G', '/img/5.png');
insert into products values (6, 'Phone', 'Electronics', 900, 'B', '/img/6.png');
`;

const FILES = {
  'pages/p00003-products.apx': SEARCH_PAGE,
  'pages/p00004-gallery.apx': CARDS_PAGE,
  'pages/p00005-more.apx': MORE_PAGE,
  '.apex-local/02-products.sql': DATA,
};

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, FILES);
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/home`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  const get = (path: string) =>
    fetch(`${server.url}/r/demo/${path}`, { headers: { cookie } }).then((r) => r.text());
  const facets = (page: string, region: string, body: unknown) =>
    fetch(`${server.url}/r/demo/__apex/x/facets?page=${page}&region=${region}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, json: (await r.json()) as Record<string, unknown> }));
  return { server, get, facets };
}

const reportNames = (html: string) =>
  [
    ...html.matchAll(
      /<tr><td class="t-Report-cell" [^>]*>\d+<\/td><td class="t-Report-cell" [^>]*>([^<]*)<\/td>/gu,
    ),
  ].map((match) => match[1]);

test('faceted search, cards, smart filters, list view and RDS render every page without errors', async (t) => {
  const { app, assets } = await workspace(t, FILES);
  const result = checkApplication({ sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    result.pages.filter((page) => page.error),
    [],
  );
  assert.equal(result.diagnostics.filter((entry) => entry.level === 'error').length, 0);
  assert.ok(
    !result.diagnostics.some((entry) =>
      /facetedSearch|smartFilters|listView|regionDisplaySelector/u.test(entry.message),
    ),
  );
});

test('faceted search drives the genuine facets widget and filters the bound report on the server', async (t) => {
  const { get, facets } = await start(t);
  const page = await get('products');
  const init = /apex\.jQuery\('#search_FS'\)\.facets\((\{.*?\})\);/u.exec(page);
  assert.ok(init, 'facets widget is initialized');
  const options = JSON.parse(init[1]!) as {
    searchItem: string;
    currentFacets: string;
    uiMode: string;
    controls: { name: string; type: string; multiple?: boolean; values?: { d: string; r: string }[] }[];
  };
  assert.equal(options.uiMode, 'F');
  assert.equal(options.searchItem, 'P3_SEARCH');
  assert.equal(options.currentFacets, '#active_facets');
  assert.deepEqual(
    options.controls.map((control) => [control.name, control.type, control.multiple]),
    [
      ['P3_CATEGORY', 'list', true],
      ['P3_PRICE', 'rangeList', true],
      ['P3_RATING', 'list', false],
    ],
  );
  assert.deepEqual(
    options.controls[0]!.values!.map((value) => value.r),
    ['Electronics', 'Food', 'Tools'],
  );
  assert.deepEqual(options.controls[1]!.values, [
    { d: '<10', r: '|10' },
    { d: '10 - 1,000', r: '10|1000' },
    { d: '>=1,000', r: '1000|' },
  ]);
  for (const item of ['P3_SEARCH', 'P3_CATEGORY', 'P3_PRICE', 'P3_RATING'])
    assert.match(page, new RegExp(`<input type="hidden" name="${item}" id="${item}" value="">`, 'u'));
  assert.deepEqual(reportNames(page), ['Hammer', 'Saw', 'Apple', 'Bread', 'Laptop', 'Phone']);

  // Counts: a facet's own options ignore its own selection; other facets are filtered by it.
  const counts = await facets('3', 'search', {
    items: { P3_CATEGORY: 'Tools:Food', P3_SEARCH: '', P3_PRICE: '', P3_RATING: '' },
    x01: 'FETCH_COUNTS',
    x02: '',
  });
  assert.equal(counts.status, 200);
  assert.deepEqual(counts.json, {
    counts: {
      P3_CATEGORY: { Electronics: 2, Food: 2, Tools: 2 },
      P3_PRICE: { '|10': 2, '10|1000': 2, '1000|': 0 },
      P3_RATING: { G: 2, B: 1, '': 1 },
    },
    totalCount: 4,
  });
  assert.deepEqual(reportNames(await get('__apex/region?page=3&region=products')), [
    'Hammer',
    'Saw',
    'Apple',
    'Bread',
  ]);

  // Ranges (LOV ranges exclude the upper bound), radio values and search terms combine with AND.
  await facets('3', 'search', { items: { P3_PRICE: '10|1000', P3_RATING: 'G' }, x01: 'STATE' });
  assert.deepEqual(reportNames(await get('__apex/region?page=3&region=products')), ['Hammer']);
  await facets('3', 'search', {
    items: { P3_CATEGORY: '', P3_PRICE: '', P3_RATING: '', P3_SEARCH: 'ap' },
    x01: 'STATE',
  });
  assert.deepEqual(reportNames(await get('__apex/region?page=3&region=products')), ['Apple', 'Laptop']);
  const searchCounts = await facets('3', 'search', { items: { P3_SEARCH: 'ap' }, x01: 'FETCH_COUNTS' });
  assert.equal(searchCounts.json.totalCount, 2);

  // Manual ranges include the upper bound; facets in the URL and clear-cache work like page items.
  await facets('3', 'search', { items: { P3_SEARCH: '', P3_PRICE: '25|900' }, x01: 'STATE' });
  assert.deepEqual(reportNames(await get('__apex/region?page=3&region=products')), [
    'Hammer',
    'Saw',
    'Phone',
  ]);
  assert.deepEqual(reportNames(await get('products?clear=3')), [
    'Hammer',
    'Saw',
    'Apple',
    'Bread',
    'Laptop',
    'Phone',
  ]);
  assert.deepEqual(reportNames(await get('products?p3_category=Electronics')), ['Laptop', 'Phone']);
  assert.match(await get('products'), /id="P3_CATEGORY" value="Electronics"/u);

  // Unknown items are not stored; unknown regions are reported.
  await facets('3', 'search', { items: { APP_USER: 'MALLORY' }, x01: 'STATE' });
  assert.equal((await facets('3', 'nope', { x01: 'FETCH_COUNTS' })).status, 404);
});

test('cards render a-CardView markup with media, icon, badge, actions, ordering and pagination', async (t) => {
  const { get, facets } = await start(t);
  const html = await get('gallery');
  const cards = [...html.matchAll(/<li class="a-CardView-item"/gu)];
  assert.equal(cards.length, 4);
  assert.match(
    html,
    /<ul class="a-CardView-items a-CardView-items--grid a-CardView-items--grid3col" role="list">/u,
  );
  assert.match(html, /<span class="a-CardView-initials u-color" aria-hidden="true">AP<\/span>/u);
  assert.match(html, /<h3 class="a-CardView-title">Apple<\/h3>/u);
  assert.match(html, /<h4 class="a-CardView-subTitle"><b>Food<\/b> rated G<\/h4>/u);
  assert.match(html, /<h4 class="a-CardView-subTitle"><b>Food<\/b><\/h4>/u);
  assert.match(
    html,
    /<span class="a-CardView-badgeLabel">Rating<\/span><span class="a-CardView-badgeValue">G<\/span>/u,
  );
  assert.match(
    html,
    /<div class="a-CardView-media a-CardView-media--first a-CardView-media--square a-CardView-media--cover"><img class="a-CardView-mediaImg" src="\/img\/3\.png"/u,
  );
  assert.match(
    html,
    /<a class="a-CardView-button a-CardView-button--hot" href="https:\/\/example\.com\/edit\?id=3"><span class="a-CardView-buttonIcon fa fa-pencil" aria-hidden="true"><\/span><span class="a-CardView-buttonLabel">Edit Apple<\/span><\/a>/u,
  );
  assert.match(
    html,
    /<a class="a-CardView-fullLink" href="\/r\/demo\/products\?p3_search=Apple" aria-label="Apple"><\/a>/u,
  );
  assert.match(html, /has-actions--full/u);
  assert.match(html, /<span class="a-TMV-pageRange">1 - 4 of 6<\/span>/u);
  assert.match(html, /apexLocalFacets\.cardsRegion\("gallery"\);/u);
  const titles = (fragment: string) =>
    [...fragment.matchAll(/<h3 class="a-CardView-title">([^<]*)<\/h3>/gu)].map((match) => match[1]);
  assert.deepEqual(titles(html), ['Apple', 'Bread', 'Hammer', 'Laptop']);

  // The order-by item is stored through the route and resets pagination.
  const stored = await facets('4', 'gallery', { items: { P4_ORDER_BY: 'PRICE' }, x01: 'ITEM' });
  assert.equal(stored.status, 200);
  assert.deepEqual(titles(await get('__apex/region?page=4&region=gallery')), [
    'Laptop',
    'Phone',
    'Saw',
    'Hammer',
  ]);
  assert.deepEqual(titles(await get('__apex/region?page=4&region=gallery&pg=2')), ['Bread', 'Apple']);
});

test('smart filters use the facets widget in smart mode; list view and region display selector render', async (t) => {
  const { get, facets } = await start(t);
  const html = await get('more');
  const init = /apex\.jQuery\('#filters_FS'\)\.facets\((\{.*?\})\);/u.exec(html);
  assert.ok(init);
  const options = JSON.parse(init[1]!) as {
    uiMode: string;
    searchItem: string;
    controls: { suggestedValues: unknown }[];
  };
  assert.equal(options.uiMode, 'S');
  assert.equal(options.searchItem, 'FILTERS_SEARCH');
  assert.deepEqual(options.controls[0]!.suggestedValues, ['Tools']);
  assert.match(html, /<input type="hidden" name="FILTERS_SEARCH" id="FILTERS_SEARCH" value="">/u);
  assert.match(html, /<li class="a-ListView-item"><strong>Apple<\/strong> Food<\/li>/u);
  assert.match(html, /data-apex-local-listview="list"/u);
  assert.match(html, /<ul class="apex-rds is-disabled" id="selector_RDS" role="tablist">/u);
  assert.match(html, /<li class="apex-rds-item" role="presentation" id="list_tab"><a href="#list"/u);
  assert.match(html, /<a href="#notes" role="tab" aria-controls="notes"><span>Notes<\/span><\/a>/u);
  assert.match(html, /apex\.widget\.regionDisplaySelector\('selector'/u);

  await facets('5', 'filters', { items: { FILTERS_SEARCH: 'top\nlap', P5_CATEGORY: '' }, x01: 'STATE' });
  const list = await get('__apex/region?page=5&region=list');
  assert.deepEqual(
    [...list.matchAll(/<strong>([^<]*)<\/strong>/gu)].map((match) => match[1]),
    ['Laptop'],
  );
  const counts = await facets('5', 'filters', { items: {}, x01: 'FETCH_COUNTS' });
  assert.deepEqual(counts.json, { counts: { P5_CATEGORY: { Electronics: 1 } }, totalCount: 1 });
});

test('runtime script routes apexlocal plug-in calls and ships the facet messages', async (t) => {
  const { server } = await start(t);
  const runtime = await (await fetch(`${server.url}/__apex/runtime.js`)).text();
  assert.match(runtime, /apexlocal:facets:/u);
  assert.match(runtime, /"APEX\.FS\.SHOW_MORE":"Show All"/u);
  assert.match(runtime, /facetschange/u);
});
