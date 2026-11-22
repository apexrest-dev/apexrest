import test from 'node:test';
import assert from 'node:assert/strict';
import { _forTests } from '../../packages/core/src/edit/insert.ts';
import { parseApexLang } from '../../packages/core/src/edit/apexlang-edit.ts';

const { fragment } = _forTests;
const PAGE = `page 10 (
    name: Customers
    region customers (
        name: Customers
        type: staticContent
        layout {
            sequence: 10
        }
    )
    dynamicAction refresh-1 (
        name: Existing refresh
    )
)
`;
const filter = {
  regions: [{ id: 'filters', type: 'staticContent', name: 'Filters' }],
  items: [
    {
      name: 'P10_STATUS',
      region: 'filters',
      type: 'selectList',
      label: 'Status',
      lov: [{ label: 'Active', value: 'A' }],
    },
  ],
  refreshes: [{ items: ['P10_STATUS'], regions: ['customers'] }],
};

test('new regions, items and refreshes are appended without touching existing components', () => {
  const result = fragment(PAGE, '10', filter);
  assert.ok(
    result.startsWith(PAGE.slice(0, PAGE.lastIndexOf(')'))),
    'everything before the page end is unchanged',
  );
  const [page] = parseApexLang(result);
  assert.deepEqual(
    page!.children.map((c) => `${c.type}:${c.id}`),
    [
      'region:customers',
      'dynamicAction:refresh-1',
      'region:filters',
      'pageItem:P10_STATUS',
      'dynamicAction:refresh-2',
    ],
  );
  // The new region follows the existing ones; the new refresh gets an unused name.
  assert.equal((page!.children[2]!.props.layout as { sequence: string }).sequence, '20');
  assert.equal(page!.children[4]!.props.name, 'Refresh dependent regions 2');
});

test('collisions, missing targets and unprefixed items are refused', () => {
  assert.throws(
    () => fragment(PAGE, '10', { regions: [{ id: 'customers', type: 'staticContent', name: 'x' }] }),
    {
      code: 'TARGET_EXISTS',
    },
  );
  assert.throws(() => fragment(PAGE, '10', { regions: [{ type: 'staticContent', name: 'x' }] }), {
    code: 'INVALID_INPUT',
  });
  assert.throws(
    () => fragment(PAGE, '10', { ...filter, items: [{ ...filter.items[0], name: 'P11_STATUS' }] }),
    { code: 'INVALID_INPUT' },
  );
  assert.throws(
    () => fragment(PAGE, '10', { ...filter, refreshes: [{ items: ['P10_STATUS'], regions: ['missing'] }] }),
    {
      code: 'TARGET_NOT_FOUND',
    },
  );
});
