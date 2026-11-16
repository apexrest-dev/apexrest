import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir, chmod } from 'node:fs/promises';

// The Omarchy shell plugin (integrations/omarchy/apexrest) is QML plus a QML
// `.pragma library` JavaScript model and a bash helper. These checks run the
// model in a plain VM context and the helper against a stub CLI; they are not
// evidence that the widget renders inside a running Omarchy shell.

const pluginDir = path.resolve('integrations/omarchy/apexrest');
const helper = path.join(pluginDir, 'bin/apexrest-omarchy');

async function loadModel() {
  const source = (await readFile(path.join(pluginDir, 'Model.js'), 'utf8')).replace(
    /^\.pragma library\s*$/m,
    '',
  );
  const context = vm.createContext({ JSON, Date, Math, String, Number, Array, Object, isFinite });
  vm.runInContext(source, context);
  return context as Record<string, any>;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const ok = (data: unknown) => ({ ok: true, data });
const snapshotDoc = {
  ok: true,
  cli: '/x/runtime/apexrest.mjs',
  project: '/work/app',
  version: ok({ version: '2.9.0' }),
  doctor: ok({ managedComponents: { node: 'verified', java: 'verified', sqlcl: 'verified' } }),
  settings: ok({
    decisionApi: { enabled: true, apiKeyEnv: 'MY_KEY', keyInEnvironment: false },
    catalog: {
      enabled: false,
      references: { '26.1': 5530, '26.2': 412 },
      components: 617,
      patterns: 406,
      usage: {
        recording: true,
        today: {
          search: 2,
          read: 3,
          select: 1,
          decisions: 1,
          totalTokens: 1240,
          cachedTokens: 800,
          apiMs: 900,
          apiCalls: 1,
        },
        last7Days: { search: 9, read: 9, select: 2, decisions: 1 },
        total: { search: 20, read: -4, select: 'x', decisions: 1 },
        lastUsedAt: '2026-11-16T05:00:00.000Z',
      },
    },
    timings: [
      {
        operation: 'apex.validate',
        count: 2,
        failed: 1,
        averageMs: 4200,
        lastMs: 3900,
        maxMs: 4500,
        averageSqlclMs: 3000,
        lastAt: '2026-11-16T05:00:00.000Z',
        lastOk: false,
      },
      { operation: 'Bad;Name', count: 1 },
    ],
    recentProjects: [
      { path: '/work/app', projectId: 'app', at: '2026-11-16T05:00:00.000Z' },
      { path: 'relative', projectId: 'bad', at: 'x' },
      { path: '/work/other', at: '2026-11-15T05:00:00.000Z' },
    ],
  }),
  sqlcl: ok({ mode: 'mcp', mcpRestrictLevel: '4', databaseTransport: 'ords' }),
  connections: ok({
    'local-dev': { kind: 'sqlcl-store', name: 'apexrest-local-dev' },
    'bad ref': { kind: 'x' },
  }),
  preview: ok({
    assetsInstalled: true,
    running: [
      { url: 'http://127.0.0.1:46405', port: 46405, sourceDir: '/work/app/src/apex/home' },
      { url: 'http://127.0.0.1:5000', port: 5000, sourceDir: '/work/other/src' },
      { url: 'file:///etc/passwd', port: 1, sourceDir: '/work/app/src' },
    ],
  }),
  current: ok({
    configured: true,
    configuration: {
      projectId: 'home-finance',
      application: { alias: 'home-finance-test' },
      toolchain: { profile: '26.2' },
      decisionApi: { enabled: false },
      environments: {
        dev: {
          kind: 'dev',
          readConnectionRef: 'local-dev',
          deployConnectionRef: 'local-dev',
          applicationId: 16250,
        },
        prod: { kind: 'production', readConnectionRef: 'prod', applicationId: 1 },
        'bad name': { kind: 'dev' },
      },
    },
    changes: { status: 'available', files: [' M a.apx', '?? b/'] },
    deployments: [{ status: 'succeeded', at: '2026-11-15T21:53:55.646Z' }],
  }),
};

test('omarchy model reads the global snapshot with bounded, typed values', async () => {
  const model = await loadModel();
  const snap = plain(model.snapshot(JSON.stringify(snapshotDoc)));
  assert.equal(snap.version, '2.9.0');
  assert.equal(snap.runtime.ready, true);
  assert.equal(snap.settingsSupported, true);
  assert.deepEqual(snap.decisions, { enabled: true, apiKeyEnv: 'MY_KEY', keyInEnvironment: false });
  assert.equal(snap.catalog.enabled, false);
  assert.equal(snap.catalog.references, 5942);
  // Usage counts and timings from an older runtime are ignored.
  assert.deepEqual(snap.catalog, {
    enabled: false,
    references: 5942,
    components: 617,
    patterns: 406,
  });
  assert.equal('timings' in snap, false);
  assert.equal(model.duration, undefined);
  assert.deepEqual(snap.sqlcl, { mode: 'mcp', transport: 'ords', restrictLevel: '4' });
  assert.deepEqual(snap.connections, [
    { name: 'local-dev', kind: 'sqlcl-store', target: 'apexrest-local-dev' },
  ]);
  assert.deepEqual(
    snap.recent.map((r: any) => [r.path, r.name]),
    [
      ['/work/app', 'app'],
      ['/work/other', 'other'],
    ],
  );
  assert.equal(snap.previews.length, 2);
  assert.equal(model.previewOf(snap, '/work/app').port, 46405);
  assert.equal(model.previewOf(snap, '/work/none'), null);
});

test('omarchy model reads the current project, its override and environments', async () => {
  const model = await loadModel();
  const project = plain(model.snapshot(JSON.stringify(snapshotDoc)).project);
  assert.equal(project.name, 'home-finance-test');
  assert.equal(project.profile, '26.2');
  assert.equal(project.decisionOverride, 'off');
  // Git changes cover the enclosing repository, not the project, so they are not shown.
  assert.equal('changeCount' in project, false);
  assert.deepEqual(
    project.environments.map((e: any) => [e.name, e.deployable, e.readRef, e.applicationId]),
    [
      ['dev', true, 'local-dev', '16250'],
      ['prod', false, 'prod', '1'],
    ],
  );
  const failed = plain(model.project({ ok: false, diagnostics: [{ message: 'broken\nmore' }] }, '/p'));
  assert.equal(failed.error, 'broken');
  assert.equal(model.project(null, 'relative'), null);
});

test('omarchy model reports a missing runtime, an old runtime and unreadable output', async () => {
  const model = await loadModel();
  const missing = plain(model.snapshot('{"ok":false,"cli":null,"error":"APEXREST runtime not found."}'));
  assert.equal(missing.cliFound, false);
  assert.equal(missing.error, 'APEXREST runtime not found.');
  const old = plain(model.snapshot(JSON.stringify({ ...snapshotDoc, settings: null })));
  assert.equal(old.settingsSupported, false);
  assert.equal(old.decisions.enabled, false);
  assert.equal(plain(model.snapshot('not json')).loaded, false);
});

test('omarchy model strips control characters and refuses unsafe values', async () => {
  const model = await loadModel();
  assert.equal(model.text('a\u0000b\u001b[31mc'), 'a b [31mc');
  assert.equal(model.text('x'.repeat(500)).length, 160);
  assert.equal(model.isHttpUrl('http://h/<img src=x>'), false);
  assert.equal(model.refName('dev;rm -rf'), '');
  assert.equal(model.pinnedProject('~/x'), '');
  assert.equal(model.pinnedProject('/a/b/'), '/a/b');
  assert.deepEqual(
    plain(model.savedConnections('{"ok":true,"data":{"connections":[{"name":"a"},{"x":1}]}}')),
    ['a'],
  );
});

test('omarchy model summarizes validation and builds literal agent prompts', async () => {
  const model = await loadModel();
  const failed = plain(
    model.validation(
      JSON.stringify({
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            message: 'APEXLang Compile Errors:\nType: INVALID_VERSION\nError: Unsupported version.',
          },
        ],
      }),
    ),
  );
  assert.deepEqual(failed, { ok: false, errors: 1, message: 'Unsupported version.' });
  assert.deepEqual(plain(model.validation('{"ok":true,"diagnostics":[]}')), {
    ok: true,
    errors: 0,
    message: '',
  });
  assert.equal(
    model.agentPrompt('ship', 'dev'),
    'Ship the current APEX changes to the dev environment with apexrest, then report the deployment outcome.',
  );
  assert.equal(model.agentPrompt('ship', 'dev && rm'), '');
  assert.equal(model.age('2026-11-16T00:00:00Z', Date.parse('2026-11-16T03:10:00Z')), '3h');
});

test('omarchy plugin manifest and English catalog are consistent', async () => {
  const manifest = JSON.parse(await readFile(path.join(pluginDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, 'apexrest');
  assert.deepEqual(manifest.kinds, ['bar-widget']);
  assert.equal(manifest.entryPoints.barWidget, 'Panel.qml');
  const qml = await readFile(path.join(pluginDir, 'Panel.qml'), 'utf8');
  const en = JSON.parse(await readFile(path.join(pluginDir, 'i18n/en.json'), 'utf8'));
  const keys = [...qml.matchAll(/strings\.tn?\("([A-Za-z.]+)"/g)].map((m) => m[1]!);
  assert.ok(keys.length > 40);
  for (const key of keys) assert.ok(key in en, `missing translation ${key}`);
  // Every Text sink renders plain text; untrusted CLI output must never be rich text.
  assert.doesNotMatch(qml, /^\s*Text\s*\{/m);
  for (const component of qml.matchAll(/component \w+: Text \{([^}]*)/g))
    assert.match(component[1]!, /textFormat: Text\.PlainText/);
});

async function stubCli(t: import('node:test').TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'apexrest-omarchy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  await mkdir(project);
  await writeFile(path.join(project, 'apexrest.json'), '{}');
  const log = path.join(root, 'calls.log');
  const cli = path.join(root, 'apexrest');
  await writeFile(
    cli,
    `#!/bin/bash
printf '%s\\n' "$*" >> ${JSON.stringify(log)}
echo "diagnostic noise" >&2
case "$1 $2" in
  "settings status") printf '{"ok":true,"operation":"settings.status","data":{"recentProjects":[{"path":%s}]}}\\n' ${JSON.stringify(JSON.stringify(project))} ;;
  "settings configure") echo '{"ok":true,"operation":"settings.configure","data":{}}' ;;
  "sqlcl status") echo '{"ok":true,"operation":"sqlcl.status","data":{"mode":"mcp"}}' ;;
  "sqlcl configure") echo '{"ok":true,"operation":"sqlcl.configure","data":{}}' ;;
  "panel status") echo '{"ok":true,"operation":"panel.status","data":{"configured":true}}' ;;
  "version --json") echo '{"ok":true,"operation":"version","data":{"version":"9"}}' ;;
  *) echo 'not json' ;;
esac
`,
  );
  await chmod(cli, 0o755);
  return { root, project, cli, log };
}

function runHelper(args: string[], env: Record<string, string>) {
  return spawnSync('bash', [helper, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env, PATH: `/usr/bin:/bin` },
  });
}

const hasJq = spawnSync('jq', ['--version']).status === 0;
// The helper is a bash script for the Omarchy (Arch Linux) desktop and never runs on Windows.
const helperSkip =
  process.platform === 'win32' ? 'Omarchy helper is Linux-only' : !hasJq && 'jq not installed';

test(
  'omarchy helper composes one snapshot and follows the current project',
  { skip: helperSkip },
  async (t) => {
    const { project, cli, log } = await stubCli(t);
    const result = runHelper(['snapshot'], { APEXREST_CLI: cli });
    assert.equal(result.status, 0, result.stderr);
    const doc = JSON.parse(result.stdout);
    assert.equal(doc.cli, cli);
    assert.equal(doc.project, project);
    assert.equal(doc.version.data.version, '9');
    assert.equal(doc.current.operation, 'panel.status');
    assert.equal(doc.preview, null); // unreadable output becomes null, never raw text
    const calls = await readFile(log, 'utf8');
    assert.ok(calls.includes(`panel status --project ${project} --json`));
  },
);

test(
  'omarchy helper maps settings toggles to the CLI and refuses anything else',
  { skip: helperSkip },
  async (t) => {
    const { root, project, cli, log } = await stubCli(t);
    for (const args of [
      ['decisions', 'on'],
      ['catalog', 'off'],
      ['sqlcl-mode', 'cli'],
      ['sqlcl-transport', 'ords'],
      ['sqlcl-transport', 'direct'],
    ])
      assert.equal(runHelper(args, { APEXREST_CLI: cli }).status, 0, args.join(' '));
    const calls = await readFile(log, 'utf8');
    assert.ok(calls.includes('settings configure --decision-api on --json'));
    assert.ok(calls.includes('settings configure --catalog off --json'));
    assert.ok(calls.includes('sqlcl configure --mode cli --database-transport ords --json'));
    // Switching back to direct keeps the current backend.
    assert.ok(calls.includes('sqlcl configure --mode mcp --database-transport direct --json'));

    for (const args of [
      ['decisions', 'yes'],
      ['sqlcl-mode', 'cli;id'],
      ['preview-stop', '70000'],
      ['connection-test', project, 'a b'],
      ['open-url', 'file:///etc/passwd'],
      ['use-project', root],
      ['use-project', 'project'],
    ]) {
      const refused = runHelper(args, { APEXREST_CLI: cli });
      assert.equal(refused.status, 2, args.join(' '));
      assert.equal(JSON.parse(refused.stdout).ok, false);
    }
    const missing = runHelper(['snapshot'], { APEXREST_CLI: path.join(root, 'nope'), HOME: root });
    assert.equal(missing.status, 3);
    assert.match(JSON.parse(missing.stdout).error, /runtime not found/);
  },
);
