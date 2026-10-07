import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import type { JobService } from '../../packages/core/src/jobs.ts';
import { failure, success, Fault } from '../../packages/core/src/result.ts';
import { jobToolResult, jobWaitSeconds, runJobTool } from '../../packages/mcp/src/job-tools.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';

const receipt = {
  jobId: '12345678-1234-4123-8123-123456789abc',
  status: 'queued',
  runner: 'detached-worker',
  nextAction: 'Wait for this job.',
} as const;
const input = { project: '/fixture', env: 'dev' };
const runtime = '/runtime/apexrest.mjs';

function fixture(
  state: { id: string; status: string; updatedAt: string; result?: unknown; nextAction?: string } = {
    id: receipt.jobId,
    status: 'running',
    updatedAt: 'now',
  },
) {
  const starts: unknown[][] = [],
    reads: unknown[][] = [];
  const jobs: Pick<JobService, 'start' | 'status'> = {
    async start(...args) {
      starts.push(args);
      return receipt;
    },
    async status(...args) {
      reads.push(args);
      return state;
    },
  };
  return { jobs, starts, reads };
}

test('long MCP tools start once and return completed nested outcomes without the polling instruction', async () => {
  for (const status of ['succeeded', 'failed', 'cancelled', 'outcome_unknown']) {
    const state = {
      id: receipt.jobId,
      status: 'completed',
      updatedAt: 'now',
      result: { ok: status === 'succeeded', status, artifacts: ['result-artifact'] },
    };
    const { jobs, starts, reads } = fixture(state);
    assert.deepEqual(await runJobTool(jobs, 'deploy.apply', input, runtime), {
      ...state,
      runner: receipt.runner,
      jobId: receipt.jobId,
    });
    assert.deepEqual(starts, [['deploy.apply', input, runtime]]);
    assert.deepEqual(reads, [[receipt.jobId, 25, undefined]]);
  }
});

test('bounded wait returns the same active job and strips only MCP waitSeconds before execution', async () => {
  const { jobs, starts, reads } = fixture();
  const request = { ...input, waitSeconds: 3 };
  const result = await runJobTool(jobs, 'apex.validate', request, runtime);
  assert.equal(result.status, 'running');
  assert.equal(result.jobId, receipt.jobId);
  assert.equal(result.nextAction, receipt.nextAction);
  assert.deepEqual(starts, [['apex.validate', input, runtime]]);
  assert.deepEqual(reads, [[receipt.jobId, 3, undefined]]);
  assert.equal(request.waitSeconds, 3);
});

test('zero wait retains immediate queue behavior without a status read', async () => {
  const { jobs, starts, reads } = fixture();
  assert.deepEqual(await runJobTool(jobs, 'apex.validate', { ...input, waitSeconds: 0 }, runtime), receipt);
  assert.equal(starts.length, 1);
  assert.deepEqual(reads, []);
});

test('MCP wait defaults remain optional in the input catalog and invalid values never start a job', async () => {
  const schema = z.toJSONSchema(z.strictObject({ waitSeconds: jobWaitSeconds }), { io: 'input' });
  assert.ok(!schema.required?.includes('waitSeconds'));
  for (const waitSeconds of [-1, 31, 0.1, NaN, Infinity, '25']) {
    const { jobs, starts, reads } = fixture();
    await assert.rejects(runJobTool(jobs, 'apex.validate', { ...input, waitSeconds }, runtime), {
      code: 'INVALID_INPUT',
    });
    assert.deepEqual(starts, []);
    assert.deepEqual(reads, []);
  }
});

test('cancellation before execution starts no worker', async () => {
  const { jobs, starts, reads } = fixture();
  await assert.rejects(runJobTool(jobs, 'deploy.apply', input, runtime, AbortSignal.abort()), {
    code: 'CANCELLED',
    status: 'cancelled',
  });
  assert.deepEqual(starts, []);
  assert.deepEqual(reads, []);
});

test('cancellation during observation passes through without cancelling or replaying the worker', async () => {
  const controller = new AbortController();
  const { jobs, starts, reads } = fixture();
  const read = jobs.status;
  jobs.status = async (...args) => {
    controller.abort();
    return read(...args);
  };
  const result = await runJobTool(jobs, 'deploy.apply', input, runtime, controller.signal);
  assert.equal(result.status, 'running');
  assert.equal(result.jobId, receipt.jobId);
  assert.equal(starts.length, 1);
  assert.deepEqual(reads, [[receipt.jobId, 25, controller.signal]]);
});

test('observation errors preserve the started job and unknown outcome without exposing error details', async () => {
  const { jobs, starts } = fixture();
  jobs.status = async () => {
    throw new Error('secret private credentials');
  };
  const result = await runJobTool(jobs, 'deploy.apply', input, runtime);
  assert.equal(starts.length, 1);
  assert.equal(result.jobId, receipt.jobId);
  assert.equal(result.status, 'outcome_unknown');
  assert.match(String(result.nextAction), /do not repeat/);
  assert.doesNotMatch(JSON.stringify(result), /secret|credentials/);
});

test('worker start failures propagate without observing or retrying execution', async () => {
  const { jobs, reads } = fixture();
  let count = 0;
  jobs.start = async () => {
    count++;
    throw new Fault('START_FAILED', 'Worker failed to start.');
  };
  await assert.rejects(runJobTool(jobs, 'deploy.apply', input, runtime), { code: 'START_FAILED' });
  assert.equal(count, 1);
  assert.deepEqual(reads, []);
});

test('expired worker outcomes preserve their reconciliation instruction', async () => {
  const state = {
    id: receipt.jobId,
    status: 'outcome_unknown',
    updatedAt: 'before',
    nextAction: 'Worker heartbeat expired. Reconcile target before retrying.',
  };
  const { jobs } = fixture(state);
  assert.deepEqual(await runJobTool(jobs, 'deploy.apply', input, runtime), {
    ...state,
    runner: receipt.runner,
    jobId: receipt.jobId,
  });
});

test('completed MCP jobs expose their actual outcome through the outer envelope without replay', async () => {
  for (const status of ['succeeded', 'failed', 'cancelled', 'outcome_unknown']) {
    const nested =
      status === 'succeeded'
        ? success('deploy.apply', { applied: true }, 'Application imported and verified.')
        : failure(
            'deploy.apply',
            new Fault('FIXTURE_FAILURE', 'Existing deployment requires review.', 6, status),
          );
    nested.artifacts = ['deployment-evidence'];
    nested.nextActions = ['Inspect existing deployment evidence before any retry.'];
    const { jobs, starts } = fixture({
      id: receipt.jobId,
      status: 'completed',
      updatedAt: 'now',
      result: nested,
    });
    const job = await runJobTool(jobs, 'deploy.apply', input, runtime);
    const response = await toolOutput(jobToolResult('deploy.apply', job));
    const result = JSON.parse(response.content[0]!.text);
    assert.equal(response.isError, !nested.ok);
    assert.equal(result.ok, nested.ok);
    assert.equal(result.status, status);
    assert.equal(result.exitCode, nested.exitCode);
    assert.equal(result.runId, nested.runId);
    assert.equal(result.summary, nested.summary);
    assert.deepEqual(result.diagnostics, nested.diagnostics);
    assert.deepEqual(result.artifacts, nested.artifacts);
    assert.deepEqual(result.nextActions, nested.nextActions);
    assert.equal(result.data.jobId, receipt.jobId);
    assert.deepEqual(result.data.result, nested);
    assert.equal(starts.length, 1);
  }
});

test('terminal observations without nested outcomes retain failure and reconciliation at MCP boundary', async () => {
  for (const status of ['failed', 'cancelled', 'outcome_unknown']) {
    const { jobs, starts } = fixture({
      id: receipt.jobId,
      status,
      updatedAt: 'now',
      nextAction: 'Inspect this jobId; do not repeat the operation.',
    });
    const job = await runJobTool(jobs, 'deploy.apply', input, runtime);
    const response = await toolOutput(jobToolResult('deploy.apply', job));
    const result = JSON.parse(response.content[0]!.text);
    assert.equal(response.isError, true);
    assert.equal(result.ok, false);
    assert.equal(result.status, status);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.nextActions[0], /do not repeat/);
    assert.equal(result.data.jobId, receipt.jobId);
    assert.equal(starts.length, 1);
  }
});

test('active job envelopes describe queued or running work without claiming completion', async () => {
  for (const status of ['queued', 'running']) {
    const { jobs, starts } = fixture({ id: receipt.jobId, status, updatedAt: 'now' });
    const job = await runJobTool(jobs, 'apex.validate', input, runtime);
    const response = await toolOutput(jobToolResult('apex.validate', job));
    const result = JSON.parse(response.content[0]!.text);
    assert.equal(response.isError, false);
    assert.equal(result.ok, true);
    assert.equal(result.status, status);
    assert.match(result.summary, new RegExp(`Job ${status}`));
    assert.doesNotMatch(result.summary, /completed|succeeded/i);
    assert.deepEqual(result.nextActions, [receipt.nextAction]);
    assert.equal(result.data.jobId, receipt.jobId);
    assert.equal(starts.length, 1);
  }
});

test('completed jobs with missing or mismatched results are unreadable, never fabricated success', async () => {
  for (const result of [undefined, { ok: true }, success('apex.validate', {})]) {
    const envelope = jobToolResult('deploy.apply', {
      jobId: receipt.jobId,
      status: 'completed',
      result,
    });
    const response = await toolOutput(envelope);
    const transported = JSON.parse(response.content[0]!.text);
    assert.equal(response.isError, true);
    assert.equal(transported.ok, false);
    assert.equal(transported.status, 'completed_unreadable');
    assert.equal(transported.exitCode, 1);
    assert.equal(transported.diagnostics[0].code, 'JOB_RESULT_UNREADABLE');
    assert.equal(transported.data.jobId, receipt.jobId);
    assert.match(transported.summary, /do not repeat/);
  }
});

test('failed and unknown job records expose their recorded nested outcome', () => {
  for (const status of ['failed', 'outcome_unknown']) {
    const nested = failure(
      'deploy.apply',
      new Fault(
        'FIXTURE_FAILURE',
        'Existing deployment requires review.',
        status === 'failed' ? 1 : 6,
        status,
      ),
    );
    const result = jobToolResult('deploy.apply', { jobId: receipt.jobId, status, result: nested });
    assert.equal(result.status, status);
    assert.equal(result.runId, nested.runId);
    assert.deepEqual(result.diagnostics, nested.diagnostics);
    assert.equal((result.data as { jobId: string }).jobId, receipt.jobId);
  }
  const unreadable = jobToolResult('deploy.apply', {
    jobId: receipt.jobId,
    status: 'failed',
    result: { ok: false },
  });
  assert.equal(unreadable.status, 'failed');
  assert.equal(unreadable.exitCode, 1);
});
