import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { fixture } from '../fixtures/project.ts';
import { projectSchema, parse, loadProject } from '../../packages/core/src/config.ts';
import { hash, writeJson } from '../../packages/core/src/fs.ts';
import { referenceSelect } from '../../packages/core/src/reference-selection.ts';
import { referenceCandidates } from '../../packages/core/src/references.ts';
import { rankSelection } from '../../packages/core/src/selection-index.ts';
import { schemas } from '../../packages/core/src/operations.ts';
import { dispatch } from '../../packages/core/src/service.ts';
import { toolOutput } from '../../packages/mcp/src/output.ts';
import { sanitized } from '../../packages/core/src/result.ts';
import { runProcess } from '../../packages/core/src/process.ts';

const resources = path.resolve('resources');
const keyName = 'APEXREST_DECISION_TEST_KEY';
const secret = 'sk-proj-test-only-0123456789abcdefghijklmnop';
const usage = {
  input_tokens: 100,
  input_tokens_details: { cached_tokens: 20, cache_write_tokens: 0 },
  output_tokens: 0,
  output_tokens_details: { reasoning_tokens: 0 },
  total_tokens: 100,
};

async function setup(t: TestContext, enabled = true) {
  const { ctx } = await fixture();
  const before = { resources: process.env.APEXREST_RESOURCES, key: process.env[keyName] };
  process.env.APEXREST_RESOURCES = resources;
  process.env[keyName] = secret;
  ctx.config.decisionApi = { enabled, apiKeyEnv: keyName, timeoutMs: 250 };
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  t.after(async () => {
    if (before.resources === undefined) delete process.env.APEXREST_RESOURCES;
    else process.env.APEXREST_RESOURCES = before.resources;
    if (before.key === undefined) delete process.env[keyName];
    else process.env[keyName] = before.key;
    await rm(ctx.root, { recursive: true, force: true });
  });
  return ctx;
}
const unavailable: typeof fetch = async () => {
  throw new Error('Network must not be used');
};
type Body = { model: string; input: unknown; questions: { name: string; type: string }[] };
function responder(answer: (body: Body) => unknown): typeof fetch {
  return async (_url, options) => Response.json(answer(JSON.parse(String(options?.body)) as Body));
}
function decision(body: Body, probability = 0.9) {
  return {
    model: 'gpt-6-luna',
    answers: body.questions.map(({ name }) => ({ name, type: 'predicate', probability })),
    usage,
  };
}

test('selection configuration is opt-in, strict and bounded in runtime and operation schemas', async (t) => {
  const ctx = await setup(t);
  const config = parse(projectSchema, { ...ctx.config, decisionApi: {} });
  assert.deepEqual(config.decisionApi, { enabled: false, apiKeyEnv: 'OPENAI_API_KEY', timeoutMs: 3000 });
  for (const change of [
    { timeoutMs: 249 },
    { timeoutMs: 10001 },
    { envFile: '../secret' },
    { apiKeyEnv: 'INVALID-NAME' },
    { apiKey: secret },
    { enabled: 'yes' },
  ]) {
    assert.equal(projectSchema.safeParse({ ...ctx.config, decisionApi: change }).success, false);
  }
  assert.equal(schemas['docs.select'].parse({ request: 'cards' }).limit, 6);
  assert.equal(schemas['docs.select'].safeParse({ request: ' ', limit: 9 }).success, false);
  assert.equal(schemas['docs.select'].safeParse({ request: 'x'.repeat(4001) }).success, false);
  assert.equal(schemas['docs.select'].safeParse({ request: 'cards', version: '27.1' }).success, false);
  assert.equal((await dispatch('reference', { mode: 'select', request: 'cards' })).exitCode, 2);
});

test('long prose uses OR aliases, retains later needs and excludes unresolved or incompatible records', () => {
  const base = {
    title: 'Interactive grid',
    kind: 'template',
    family: 'regions',
    version: '26.1@pin',
    readiness: 'ready',
    text: 'interactive grid editable rows',
  };
  const query =
    'Потрібно зробити сторінку для роботи щодня з великою кількістю замовлень різних користувачів та інших довільних потреб. Додай редагування через ig';
  const ranked = rankSelection(
    [
      { ...base, id: 'grid' },
      { ...base, id: 'bad', readiness: 'unresolved' },
      { ...base, id: 'other', version: '26.2' },
    ],
    query,
    '26.1',
  );
  assert.deepEqual(
    ranked.map((r) => r.id),
    ['grid'],
  );
});

test('disabled selection never reads credentials or calls the network and returns bounded local references', async (t) => {
  const ctx = await setup(t, false);
  ctx.config.decisionApi!.envFile = 'missing.env';
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  const result = await referenceSelect(
    { project: ctx.root, request: 'картка показника interactive grid', limit: 8 },
    undefined,
    unavailable,
  );
  assert.equal(result.selection.method, 'local');
  assert.equal(result.selection.fallbackReason, 'disabled');
  assert.ok(result.results.length);
  const recipe = await referenceSelect(
    { project: ctx.root, request: 'metric card', limit: 1 },
    undefined,
    unavailable,
  );
  assert.ok('code' in recipe.results[0]! && recipe.results[0].code);
  assert.ok(Buffer.byteLength(JSON.stringify(sanitized(result))) <= 7000);
  assert.equal(result.selection.usage, undefined);
  const output = await toolOutput(
    { ...(await dispatch('docs.select', { project: ctx.root, request: 'cards' })), data: result },
    ctx.root,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(output)) <= 8192);
});

test('one real-shaped Decisions request selects multiple known IDs, maps names and preserves ties', async (t) => {
  const ctx = await setup(t);
  const request = 'Interactive grid with cards and chart';
  const local = await referenceCandidates(request, '26.1');
  let calls = 0;
  const transport: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/decisions');
    assert.equal(options!.redirect, 'error');
    assert.equal((options!.headers as Record<string, string>).Authorization, `Bearer ${secret}`);
    const body = JSON.parse(String(options!.body)) as Body;
    assert.equal(body.model, 'gpt-6-luna');
    assert.ok(body.questions.length <= 64);
    assert.equal(body.questions.length, local.length);
    const messages = body.input as { content: { type: string; data?: Record<string, unknown>[] }[] }[];
    const sent = messages[0]!.content.find((part) => part.type === 'input_json')!.data!;
    for (const entry of sent) {
      assert.deepEqual(Object.keys(entry).sort(), [
        'family',
        'id',
        'kind',
        'readiness',
        'summary',
        'title',
        'version',
      ]);
      assert.ok(String(entry.summary).length <= 600);
    }
    assert.doesNotMatch(
      String(options!.body),
      /mock-only-fixture|databaseIdentity|parsingSchema|application\.apx/,
    );
    const response = decision(body, 0.1);
    response.answers[0]!.probability = 0.8;
    response.answers[1]!.probability = 0.9;
    response.answers[2]!.probability = 0.9;
    response.answers.reverse();
    return Response.json(response);
  };
  const result = await referenceSelect({ project: ctx.root, request, limit: 3 }, undefined, transport);
  assert.equal(calls, 1);
  assert.equal(result.selection.method, 'openai-decisions');
  assert.deepEqual(
    result.results.map((r) => r.id),
    [local[1]!.id, local[2]!.id, local[0]!.id],
  );
  assert.deepEqual(
    result.results.map((r) => r.probability),
    [0.9, 0.9, 0.8],
  );
  assert.deepEqual(result.selection.usage, usage);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('API failures and unusable answers fall back once without exposing remote content or key', async (t) => {
  const ctx = await setup(t);
  const cases: [typeof fetch, string][] = [
    [async () => new Response(secret, { status: 429 }), 'http_error'],
    [
      async () => {
        throw new Error(secret);
      },
      'network_error',
    ],
    [async () => new Response('{'), 'invalid_response'],
    [async () => new Response('x'.repeat(65537)), 'invalid_response'],
    [responder((b) => ({ ...decision(b), model: 'invented-model' })), 'invalid_response'],
    [
      responder((b) => ({
        ...decision(b),
        answers: [{ name: 'invented', type: 'predicate', probability: 1 }],
      })),
      'invalid_response',
    ],
    [
      responder((b) => ({
        ...decision(b),
        answers: b.questions.map(() => ({ name: 'candidate_0', type: 'predicate', probability: 1 })),
      })),
      'invalid_response',
    ],
    [responder((b) => ({ ...decision(b), answers: [] })), 'invalid_response'],
    [responder((b) => ({ ...decision(b), answers: [{ name: 'candidate_0', type: 'refusal' }] })), 'refusal'],
    [responder((b) => decision(b, 1.1)), 'invalid_response'],
    [responder((b) => decision(b, 0.49)), 'no_confident_match'],
  ];
  for (const [transport, reason] of cases) {
    let calls = 0;
    const result = await referenceSelect(
      { project: ctx.root, request: 'cards chart', limit: 2 },
      undefined,
      async (...args) => {
        calls++;
        return transport(...args);
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.selection.method, 'local');
    assert.equal(result.selection.fallbackReason, reason);
    assert.ok(result.results.length);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  delete process.env[keyName];
  assert.equal(
    (await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, unavailable))
      .selection.fallbackReason,
    'missing_key',
  );
});

test('deadlines include body reads and cancellation stops selection instead of falling back', async (t) => {
  const ctx = await setup(t);
  const hang: typeof fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  const result = await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, hang);
  assert.equal(result.selection.fallbackReason, 'timeout');
  const bodyHang: typeof fetch = async (_url, options) =>
    new Response(
      new ReadableStream({
        start(controller) {
          options!.signal!.addEventListener('abort', () => controller.error(new Error('aborted body')), {
            once: true,
          });
        },
      }),
    );
  assert.equal(
    (await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, bodyHang)).selection
      .fallbackReason,
    'timeout',
  );
  const controller = new AbortController();
  const pending = referenceSelect(
    { project: ctx.root, request: 'cards', limit: 1 },
    controller.signal,
    async (...args) => {
      setTimeout(() => controller.abort(), 10);
      return hang(...args);
    },
  );
  await assert.rejects(pending, { code: 'CANCELLED', exitCode: 6 });
  await assert.rejects(
    referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, controller.signal, unavailable),
    { code: 'CANCELLED' },
  );
});

test('ignored literal ENV files provide fallback credentials; tracked files and symlinks do not', async (t) => {
  const ctx = await setup(t);
  delete process.env[keyName];
  await runProcess({ executable: 'git', args: ['init', '-q'], cwd: ctx.root });
  await writeFile(path.join(ctx.root, '.gitignore'), '.env\n');
  await writeFile(path.join(ctx.root, '.env'), `${keyName}='${secret}'\nUNUSED='$(never-execute)'\n`);
  ctx.config.decisionApi!.envFile = '.env';
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  const transport = responder((body) => decision(body));
  assert.equal(
    (await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, transport)).selection
      .method,
    'openai-decisions',
  );
  await runProcess({ executable: 'git', args: ['add', '-f', '.env'], cwd: ctx.root });
  assert.equal(
    (await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, unavailable))
      .selection.fallbackReason,
    'credential_unavailable',
  );
  process.env[keyName] = secret;
  assert.equal(
    (await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, transport)).selection
      .method,
    'openai-decisions',
    'environment wins without reading the tracked file',
  );
  delete process.env[keyName];
  await runProcess({ executable: 'git', args: ['rm', '--cached', '-f', '.env'], cwd: ctx.root });
  await writeFile(path.join(ctx.root, '.private'), `${keyName}=${secret}`);
  await rm(path.join(ctx.root, '.env'));
  await symlink('.private', path.join(ctx.root, '.env'));
  assert.equal(
    (await referenceSelect({ project: ctx.root, request: 'cards', limit: 1 }, undefined, unavailable))
      .selection.fallbackReason,
    'credential_unavailable',
  );
  assert.deepEqual((await loadProject(ctx.root)).config.decisionApi, ctx.config.decisionApi);
});

test('26.2 candidates include inventory contracts and public pages, never 26.1 recipes; overrides stay exact', async (t) => {
  const ctx = await setup(t, false);
  ctx.config.toolchain.profile = '26.2';
  await writeJson(path.join(ctx.root, 'apexrest.json'), ctx.config);
  const candidates = await referenceCandidates('interactive grid', '26.2');
  assert.ok(candidates.some((c) => c.id.startsWith('oracle:26.2:inventory/')));
  assert.ok(candidates.some((c) => c.id.startsWith('oracle:26.2:public-template/')));
  const result = await referenceSelect(
    { project: ctx.root, request: 'interactive grid', limit: 8 },
    undefined,
    unavailable,
  );
  assert.ok(result.results.every((r) => r.id.startsWith('oracle:26.2:')));
  assert.ok(result.results.length);
  const override = await referenceSelect(
    { project: ctx.root, request: 'cards', version: '26.1', limit: 2 },
    undefined,
    unavailable,
  );
  assert.ok(override.results.every((r) => r.version.startsWith('26.1')));
  assert.deepEqual(await referenceCandidates('cards', '26.2@unreviewed'), []);
});

test('eight 26.2 selections retain the grid contract after compacting metadata to the response budget', async (t) => {
  const ctx = await setup(t);
  const request =
    'Таблична частина документа: редагована інтерактивна сітка з кількістю, ціною та сумою рядка; додавання і видалення рядків.';
  const candidates = await referenceCandidates(request, '26.2');
  const contract = 'oracle:26.2:inventory/app/page/region/plugin-variants/interactive-grid/interactive-grid';
  assert.ok(candidates.some((entry) => entry.id === contract));
  const pages = candidates.filter((entry) => entry.id.startsWith('oracle:26.2:public-template/'));
  const ids = [...pages.slice(0, 6).map((entry) => entry.id), contract, pages[6]!.id];
  const result = await referenceSelect(
    { project: ctx.root, request, version: '26.2', limit: 8 },
    undefined,
    responder((body) => {
      const answer = decision(body, 0.1);
      for (const [i, id] of ids.entries())
        answer.answers[candidates.findIndex((entry) => entry.id === id)]!.probability = 0.99 - i * 0.01;
      return answer;
    }),
  );
  assert.deepEqual(
    result.results.map((entry) => entry.id),
    ids,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(sanitized(result))) <= 7000);
  const output = await toolOutput(
    { ...(await dispatch('docs.select', { project: ctx.root, request: 'cards' })), data: result },
    ctx.root,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(output)) <= 8192);
});

test('catalog and selected document integrity failures cannot become successful fallback results', async (t) => {
  const ctx = await setup(t, false);
  const privateResources = path.join(ctx.root, 'resources');
  await mkdir(privateResources);
  await Promise.all(
    ['components', 'patterns'].map((dir) =>
      cp(path.join(resources, dir), path.join(privateResources, dir), { recursive: true }),
    ),
  );
  process.env.APEXREST_RESOURCES = privateResources;
  const entry = (await referenceCandidates('metric card', '26.1'))[0]!;
  const folder = entry.id.startsWith('pattern:') ? 'patterns' : 'components';
  const index = JSON.parse(await readFile(path.join(privateResources, folder, 'index.json'), 'utf8'));
  const metadata = index.find((item: { id: string }) => item.id === entry.id);
  const document = path.join(privateResources, folder, metadata.document);
  await writeFile(document, 'tampered');
  await assert.rejects(
    referenceSelect({ project: ctx.root, request: 'metric card', limit: 1 }, undefined, unavailable),
    /checksum/,
  );
  const manifestFile = path.join(privateResources, folder, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  manifest.indexSha256 = hash('tampered');
  await writeJson(manifestFile, manifest);
  await assert.rejects(
    referenceSelect({ project: ctx.root, request: 'metric card', limit: 1 }, undefined, unavailable),
    /hashes disagree/,
  );
});
