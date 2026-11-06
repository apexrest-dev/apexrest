import test from 'node:test';
import assert from 'node:assert/strict';
import { contractSkeleton, propertyFix } from '../../packages/core/src/contract-hints.ts';

test('invalid properties get a repair hint from the 26.2 inventory contract', async () => {
  const fix = (message: string, hint: string) => propertyFix('INVALID_PROPERTY', message, hint);
  assert.equal(
    await fix(
      'Invalid property: onValue',
      'inside settings of pageItem P4_IS_ACTIVE (type: switch) of page 4',
    ),
    'onValue applies to pageItem (type: switch) only when settings.useDefaults = N',
  );
  assert.equal(
    await fix('Invalid property: parentEntry', 'inside entry alerts of breadcrumb breadcrumb'),
    'parentEntry belongs in group appearance of entry',
  );
  assert.match(
    (await fix(
      'Invalid property: minimumValue',
      'inside settings of pageItem P4_THRESHOLD (type: numberField) of page 4',
    ))!,
    /^pageItem \(type: numberField\) has no minimumValue; settings: .*\bminValue\b/u,
  );
  assert.match(
    (await fix('Invalid property: format', 'inside value of region prices (type: chart) of page 1'))!,
    /^format applies to region \(type: chart\) only when .*chart\.type = pie/u,
  );
  assert.match(
    (await fix(
      'Invalid property: type',
      'inside action refresh (type: refresh) of dynamicAction refresh-alerts of page 3',
    ))!,
    /^type is not valid in the component itself of action \(type: refresh\); valid there: .*\baction\b/u,
  );
  assert.match(
    (await propertyFix(
      'DUPLICATED_COMPONENT',
      'Duplicated component within parent scope. For properties: advanced.executionMappingIdentifier: null',
      undefined,
    ))!,
    /executionMappingIdentifier: <unique 20-digit number>/u,
  );
  assert.equal(await propertyFix('LOV_NOT_FOUND', 'Invalid property: x', 'inside page 1'), undefined);
  assert.equal(await fix('Invalid property: x', 'inside nothing'), undefined);
});

test('shared-component contracts without sample code get an outline with properties in their groups', async () => {
  const breadcrumb = (await contractSkeleton('oracle:26.2:inventory/app/breadcrumb/entry/entry'))!;
  assert.match(
    breadcrumb,
    /^entry <name> \(\n {4}name: <STRING>\n {4}pageNumber: <INTEGER>\n {4}appearance \{\n {8}parentEntry: <@entry> {2}\(optional\)/u,
  );
  assert.doesNotMatch(breadcrumb, /serverSideCondition|authorizationScheme/u);
  const list = (await contractSkeleton('oracle:26.2:inventory/app/list/entry/entry'))!;
  assert.match(list, /^ {4}isCurrent \{\n {8}type: targetPage \| pages/mu);
  assert.equal(await contractSkeleton('oracle:26.2:inventory/app/no-such/thing/thing'), undefined);
});
