import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareShipApplyPlan } from '../../packages/mcp/src/job-tools.ts';
import { success } from '../../packages/core/src/result.ts';

test('MCP saved-plan apply preserves exact reviewed path and never forwards it into mode plan', async () => {
  let calls = 0;
  const input = {
    project: '/private/test',
    env: 'test',
    mode: 'apply',
    plan: '.apexrest/plans/reviewed.json',
    confirmation: { planDigest: 'a'.repeat(64), userRequest: 'Approved exact remote plan.' },
    userRequest: 'Apply reviewed application change.',
    waitSeconds: 0,
  };
  const result = await prepareShipApplyPlan(input, async () => {
    calls++;
    throw new Error('Unexpected replanning');
  });
  assert.equal(calls, 0);
  assert.equal(result.ok, true);
  assert.equal((result.data as { planPath: string }).planPath, input.plan);
  assert.equal((result.data as { validation: string }).validation, 'apply-worker-before-grant-and-write');
  assert.equal(input.mode, 'apply');
  assert.equal(input.confirmation.planDigest, 'a'.repeat(64));
});

test('ordinary MCP apply still plans in process with bounded waiting removed', async () => {
  let observed;
  const result = await prepareShipApplyPlan(
    {
      project: '/private/test',
      env: 'test',
      mode: 'apply',
      userRequest: 'Apply application change.',
      waitSeconds: 25,
    },
    async (input) => {
      observed = input;
      return success('ship', { planPath: '.apexrest/plans/new.json' });
    },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(observed, {
    project: '/private/test',
    env: 'test',
    mode: 'plan',
    userRequest: 'Apply application change.',
  });
});
