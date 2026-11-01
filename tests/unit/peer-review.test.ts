import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chmod, mkdtemp, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { ProjectConfig, ProjectContext } from '../../packages/core/src/config.ts';
import type { DeployPlan } from '../../packages/core/src/deploy.ts';
import { schemas } from '../../packages/core/src/operations.ts';
import {
  hostAgent,
  peerReview,
  peerReviewGate,
  resolvePeer,
  type PeerReviewRecord,
} from '../../packages/core/src/peer-review.ts';
import { hostFromClient } from '../../packages/mcp/src/server.ts';

const digest = (c: string) => c.repeat(64);

function plan(): DeployPlan {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: randomUUID(),
    projectId: 'peer-fixture',
    projectRoot: '/fixture',
    environment: 'dev',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 60000).toISOString(),
    sourceDigest: digest('1'),
    sources: {},
    configurationDigest: digest('2'),
    toolchainDigest: digest('3'),
    compiler: 'fixture',
    targetDigest: digest('4'),
    target: {},
    fingerprint: digest('5'),
    migrationHistory: [],
    coordination: { backend: 'local', scope: 'managed-home-schema', storeDigest: digest('6') },
    scope: 'full-application-import',
    operations: [
      { kind: 'migration', file: 'database/migrations/001.sql', sha256: digest('7') },
      { kind: 'import' },
    ],
    risks: [],
    approval: 'task-authorized',
    backupRequired: true,
    digest: digest('a'),
  } as DeployPlan;
}

async function project(peerReview?: ProjectConfig['peerReview']): Promise<ProjectContext> {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-peer-'));
  return {
    root,
    config: {
      schemaVersion: 1,
      projectId: 'peer-fixture',
      application: { sourceDir: 'apex', alias: 'peer' },
      database: { migrationsDir: 'database/migrations', packagesDir: 'database/packages' },
      toolchain: { lockFile: 'toolchain.lock.json' },
      environments: {},
      artifacts: { directory: '.apexrest/artifacts', retentionDays: 7 },
      ...(peerReview ? { peerReview } : {}),
    } as ProjectConfig,
  };
}

async function savePlan(ctx: ProjectContext, value: DeployPlan) {
  const relative = '.apexrest/plans/ship-' + value.id + '.json';
  await mkdir(path.join(ctx.root, '.apexrest/plans'), { recursive: true });
  await writeFile(path.join(ctx.root, relative), JSON.stringify(value));
  return relative;
}

async function fakeCli(ctx: ProjectContext, name: string, body: string) {
  const file = path.join(ctx.root, '..', path.basename(ctx.root) + '-' + name + '.mjs');
  await writeFile(file, '#!/usr/bin/env node\n' + body);
  await chmod(file, 0o755);
  return file;
}

const verdict = {
  verdict: 'approve',
  summary: 'The change is consistent.',
  findings: [
    { severity: 'minor', title: 'Label', detail: 'Use a clearer label.', file: 'apex/p1.apx', line: 4 },
  ],
};

function withEnv<T>(values: Record<string, string | undefined>, run: () => Promise<T>) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values))
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  return run().finally(() => {
    for (const [k, v] of Object.entries(saved))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  });
}

test('host detection prefers the explicit override and the peer is the other vendor', async () => {
  assert.equal(hostAgent({ APEXREST_HOST: 'codex', CLAUDECODE: '1' }), 'codex');
  assert.equal(hostAgent({ CLAUDECODE: '1' }), 'claude');
  assert.equal(hostAgent({ CODEX_THREAD_ID: 'x' }), 'codex');
  assert.equal(hostAgent({ CODEX_HOME: '/h' }), undefined);
  assert.equal(hostFromClient('claude-code'), 'claude');
  assert.equal(hostFromClient('codex-mcp-client'), 'codex');
  assert.equal(hostFromClient('inspector'), undefined);
  const ctx = await project({ mode: 'off', vendor: 'claude', timeoutSeconds: 600 });
  assert.equal(resolvePeer(ctx, 'codex'), 'codex');
  assert.equal(resolvePeer(ctx), 'claude');
  await withEnv({ APEXREST_HOST: 'claude' }, async () => {
    assert.equal(resolvePeer(await project()), 'codex');
  });
});

test('codex peer runs read-only and records a digest-bound verdict', async () => {
  const ctx = await project();
  const saved = await savePlan(ctx, plan());
  const log = path.join(ctx.root, 'codex-args.json');
  const bin = await fakeCli(
    ctx,
    'codex',
    `import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('codex-cli 9.9.9'); process.exit(0); }
const prompt = readFileSync(0, 'utf8');
writeFileSync(${JSON.stringify(log)}, JSON.stringify({ args, prompt }));
writeFileSync(args[args.indexOf('-o') + 1], ${JSON.stringify(JSON.stringify(verdict))});
`,
  );
  const result = await withEnv({ APEXREST_CODEX_BIN: bin }, () =>
    peerReview(ctx, { plan: saved, vendor: 'codex', focus: 'authorization' }),
  );
  const call = JSON.parse(await readFile(log, 'utf8')) as { args: string[]; prompt: string };
  assert.deepEqual(call.args.slice(0, 3), ['exec', '--sandbox', 'read-only']);
  assert.ok(call.args.includes('--ephemeral'));
  assert.ok(call.prompt.includes(digest('a')));
  assert.ok(call.prompt.includes('migration: database/migrations/001.sql'));
  assert.ok(call.prompt.includes('Requested focus: authorization'));
  assert.equal(result.verdict, 'approve');
  assert.equal(result.cliVersion, 'codex-cli 9.9.9');
  const record = JSON.parse(
    await readFile(path.join(ctx.root, '.apexrest/reviews', digest('a') + '.json'), 'utf8'),
  ) as PeerReviewRecord;
  assert.equal(record.planDigest, digest('a'));
  assert.equal(record.vendor, 'codex');
  // Scratch schema/output files are removed after the run.
  assert.deepEqual((await readdir(path.join(ctx.root, '.apexrest/reviews'))).sort(), [digest('a') + '.json']);
});

test('claude peer runs restricted without the host session identity', async () => {
  const ctx = await project();
  const saved = await savePlan(ctx, plan());
  const bin = await fakeCli(
    ctx,
    'claude',
    `const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('2.0.0 (Claude Code)'); process.exit(0); }
if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_SESSION_ID) { console.error('nested session'); process.exit(7); }
for (const flag of ['-p', '--restricted', '--strict-mcp-config', '--no-session-persistence'])
  if (!args.includes(flag)) { console.error('missing ' + flag); process.exit(8); }
if (args[args.indexOf('--tools') + 1] !== 'Read,Grep,Glob') process.exit(9);
console.log(JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: ${JSON.stringify(
      { ...verdict, verdict: 'changes_requested' },
    )} }));
`,
  );
  const result = await withEnv(
    { APEXREST_CLAUDE_BIN: bin, CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'host' },
    () => peerReview(ctx, { plan: saved, vendor: 'claude' }),
  );
  assert.equal(result.verdict, 'changes_requested');
  assert.equal(result.vendor, 'claude');
});

test('peer failures and invalid output are reported, not recorded', async () => {
  const ctx = await project();
  const saved = await savePlan(ctx, plan());
  const bin = await fakeCli(
    ctx,
    'codex-bad',
    `import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') process.exit(0);
writeFileSync(args[args.indexOf('-o') + 1], '{"verdict":"maybe"}');
`,
  );
  await withEnv({ APEXREST_CODEX_BIN: bin }, () =>
    assert.rejects(peerReview(ctx, { plan: saved, vendor: 'codex' }), { code: 'PEER_OUTPUT_INVALID' }),
  );
  await withEnv({ APEXREST_CODEX_BIN: path.join(ctx.root, 'missing-codex') }, () =>
    assert.rejects(peerReview(ctx, { plan: saved, vendor: 'codex' }), { code: 'PEER_UNAVAILABLE' }),
  );
  const expired = { ...plan(), expiresAt: new Date(Date.now() - 1000).toISOString() } as DeployPlan;
  await assert.rejects(peerReview(ctx, { plan: await savePlan(ctx, expired), vendor: 'codex' }), {
    code: 'PLAN_EXPIRED',
  });
});

async function record(ctx: ProjectContext, value: Partial<PeerReviewRecord>) {
  await mkdir(path.join(ctx.root, '.apexrest/reviews'), { recursive: true });
  const full: PeerReviewRecord = {
    schemaVersion: 1,
    planDigest: digest('a'),
    planId: randomUUID(),
    environment: 'dev',
    vendor: 'codex',
    cliVersion: 'codex-cli 9.9.9',
    reviewedAt: new Date().toISOString(),
    durationMs: 10,
    ...(verdict as Pick<PeerReviewRecord, 'verdict' | 'summary' | 'findings'>),
    ...value,
  };
  await writeFile(path.join(ctx.root, '.apexrest/reviews', digest('a') + '.json'), JSON.stringify(full));
}

test('apply gate: off ignores, advisory reports, required blocks without an approving exact-plan review', async () => {
  assert.equal(await peerReviewGate(await project(), plan()), undefined);
  const advisory = await project({ mode: 'advisory', vendor: 'auto', timeoutSeconds: 600 });
  assert.deepEqual(await peerReviewGate(advisory, plan()), { mode: 'advisory', status: 'missing' });
  await record(advisory, { verdict: 'changes_requested' });
  assert.equal((await peerReviewGate(advisory, plan()))?.status, 'changes_requested');

  const required = await project({ mode: 'required', vendor: 'auto', timeoutSeconds: 600 });
  await assert.rejects(peerReviewGate(required, plan()), { code: 'PEER_REVIEW_REQUIRED' });
  // A review stored under this digest but naming another plan digest is ignored.
  await record(required, { planDigest: digest('b') });
  await assert.rejects(peerReviewGate(required, plan()), { code: 'PEER_REVIEW_REQUIRED' });
  await record(required, { verdict: 'changes_requested' });
  await assert.rejects(peerReviewGate(required, plan()), { code: 'PEER_REVIEW_CHANGES_REQUESTED' });
  await record(required, {});
  assert.deepEqual(await peerReviewGate(required, plan()), {
    mode: 'required',
    status: 'approve',
    vendor: 'codex',
    reviewedAt: (await peerReviewGate(required, plan()))!.reviewedAt,
    findings: 1,
    blocking: 0,
  });
});

test('peer tool input binds review to a saved plan', () => {
  assert.equal(schemas.peer.safeParse({ action: 'review' }).success, false);
  assert.equal(schemas.peer.safeParse({ action: 'status' }).success, true);
  assert.equal(schemas.peer.safeParse({ plan: '.apexrest/plans/x.json', vendor: 'codex' }).success, true);
  assert.equal(schemas.peer.safeParse({ plan: '../x.json' }).success, false);
});
