import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Fault } from '../../packages/core/src/result.ts';
import { snapshotForeignConfig } from '../../packages/installer/src/registration-config.ts';
import {
  discoverAfterOwnedRemoval,
  discoverRegistration,
  foreignRegistrationsUnchanged,
  type CodexInvoke,
} from '../../packages/installer/src/registration.ts';

async function fixture(t: import('node:test').TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-registration-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'profile'),
    source = path.join(root, 'owned-source');
  await mkdir(home);
  await mkdir(source);
  const text = (owned = source, foreign = 'missing foreign source') => `hide_agent_reasoning = true
[marketplaces.foreign]
source_type = "local"
source = ${JSON.stringify(foreign)}
[plugins."foreign@foreign"]
enabled = true
[mcp_servers.foreign.env]
TOKEN = "fixture-secret-must-not-escape"
[marketplaces.apexrest]
source_type = "local"
source = ${JSON.stringify(owned)}
[plugins."apexrest-apex@apexrest"]
enabled = true
`;
  const file = path.join(home, 'config.toml');
  await writeFile(file, text());
  const entry = {
    pluginId: 'apexrest-apex@apexrest',
    name: 'apexrest-apex',
    marketplaceName: 'apexrest',
    source: { source: 'local', path: path.join(source, 'plugins/apexrest-apex') },
    marketplaceSource: { sourceType: 'local', source },
  };
  return { root, home, source, text, file, entry };
}
const failed = () =>
  new Fault('CODEX_REGISTRATION_FAILED', 'Unrelated marketplace manifest is missing.', 3, 'blocked');

test('complete discovery keeps the existing CLI contract without reading profile TOML', async () => {
  const calls: string[][] = [];
  const markets = [{ name: 'other', root: '/fixture/other' }];
  const actual = await discoverRegistration(async (args) => {
    calls.push(args);
    return { marketplaces: markets };
  }, '/missing-profile');
  assert.deepEqual(actual, { scope: 'complete', markets });
  assert.deepEqual(calls, [['plugin', 'marketplace', 'list', '--json']]);
});

test('a definite complete-list failure accepts only positive independently bound targeted state', async (t) => {
  const f = await fixture(t);
  for (const available of [false, true]) {
    const calls: string[][] = [];
    const invoke: CodexInvoke = async (args) => {
      calls.push(args);
      if (args[1] === 'marketplace') throw failed();
      return { installed: available ? [] : [f.entry], available: available ? [f.entry] : [] };
    };
    const state = await discoverRegistration(invoke, f.home);
    assert.equal(state.scope, 'apexrest');
    if (state.scope !== 'apexrest') assert.fail('Expected explicitly scoped discovery');
    assert.equal(state.market.root, f.source);
    assert.equal('markets' in state, false);
    assert.equal(JSON.stringify(state).includes('fixture-secret-must-not-escape'), false);
    assert.deepEqual(calls[1], ['plugin', 'list', '--marketplace', 'apexrest', '--available', '--json']);
  }
});

test('unknown outcomes and invalid global JSON do not trigger scoped discovery', async (t) => {
  const f = await fixture(t);
  for (const error of [
    new Fault('CODEX_REGISTRATION_UNKNOWN', 'Incomplete', 6, 'outcome_unknown'),
    new Error('Unqualified failure'),
  ]) {
    let calls = 0;
    await assert.rejects(
      discoverRegistration(async () => {
        calls++;
        throw error;
      }, f.home),
      (actual) => actual === error,
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(
    discoverRegistration(async () => {
      calls++;
      return { marketplaces: null };
    }, f.home),
    { code: 'CODEX_REGISTRATION_UNKNOWN' },
  );
  assert.equal(calls, 1);
});

test('missing, malformed, foreign or mismatched targeted results are never absence evidence', async (t) => {
  const f = await fixture(t);
  const variants = [
    null,
    {},
    { installed: [], available: [] },
    { installed: [null], available: [] },
    { installed: [{ ...f.entry, marketplaceName: 'foreign' }], available: [] },
    {
      installed: [
        { ...f.entry, marketplaceSource: { sourceType: 'local', source: path.join(f.root, 'wrong') } },
      ],
      available: [],
    },
    { installed: [f.entry], available: [{ ...f.entry, name: 'another-plugin' }] },
  ];
  for (const response of variants)
    await assert.rejects(
      discoverRegistration(async (args) => {
        if (args[1] === 'marketplace') throw failed();
        return response;
      }, f.home),
      { code: 'CODEX_REGISTRATION_UNKNOWN' },
    );
  await assert.rejects(
    discoverRegistration(async (args) => {
      if (args[1] === 'marketplace') throw failed();
      throw new Fault('CODEX_REGISTRATION_FAILED', 'Unknown --marketplace option', 3, 'blocked');
    }, f.home),
    { code: 'CODEX_REGISTRATION_FAILED' },
  );
});

test('snapshot guards preserve foreign content and separately fingerprint registry semantics', async (t) => {
  const f = await fixture(t);
  const before = await snapshotForeignConfig(f.home);
  await writeFile(f.file, f.text(path.join(f.root, 'next-source')));
  const ownChange = await snapshotForeignConfig(f.home);
  const state = (config: typeof before) => ({
    scope: 'apexrest' as const,
    market: { name: 'apexrest', root: config.apexrest!.source },
    config,
  });
  assert.equal(foreignRegistrationsUnchanged(state(before), state(ownChange)), true);
  await writeFile(
    f.file,
    f.text().replace('hide_agent_reasoning = true', '# changed comment\nhide_agent_reasoning = true'),
  );
  const comment = await snapshotForeignConfig(f.home);
  assert.equal(comment.foreignRegistrySha256, before.foreignRegistrySha256);
  assert.notEqual(comment.foreignContentSha256, before.foreignContentSha256);
  assert.equal(foreignRegistrationsUnchanged(state(before), state(comment)), false);
  await writeFile(
    f.file,
    f
      .text()
      .replace('[plugins."foreign@foreign"]\nenabled = true', '[plugins."foreign@foreign"]\nenabled = false'),
  );
  const semantic = await snapshotForeignConfig(f.home);
  assert.notEqual(semantic.foreignRegistrySha256, before.foreignRegistrySha256);
  await writeFile(f.file, f.text().replace('fixture-secret-must-not-escape', 'another-fixture-secret'));
  const secret = await snapshotForeignConfig(f.home);
  assert.notEqual(secret.foreignContentSha256, before.foreignContentSha256);
  assert.equal(JSON.stringify(secret).includes('another-fixture-secret'), false);
  assert.equal(foreignRegistrationsUnchanged(state(before), { scope: 'complete', markets: [] }), false);
});

test('configuration drift while targeted CLI reads fails closed', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    discoverRegistration(async (args) => {
      if (args[1] === 'marketplace') throw failed();
      await writeFile(f.file, f.text(f.source, 'externally-changed'));
      return { installed: [f.entry], available: [] };
    }, f.home),
    { code: 'MARKETPLACE_CHANGED' },
  );
});

test('single-line literal Windows paths work, unsupported TOML and linked configs fail closed', async (t) => {
  const f = await fixture(t);
  await writeFile(
    f.file,
    f.text().replace('source = "missing foreign source"', "source = 'C:\\dev\\missing'"),
  );
  await snapshotForeignConfig(f.home);
  const variants = [
    '\uFEFF' + f.text(),
    f.text().replace('source_type = "local"', 'source_type = """local"""'),
    f.text() + '\n[plugins."foreign@foreign".settings]\nextra = true\n',
    f.text().replace('[marketplaces.apexrest]', '[marketplaces.apexrest]\nunknown = true'),
    f.text().replace('source = ' + JSON.stringify(f.source), 'source = "relative-path"'),
    'not TOML',
  ];
  for (const content of variants) {
    await writeFile(f.file, content);
    await assert.rejects(snapshotForeignConfig(f.home), { code: 'CODEX_CONFIG_SNAPSHOT_UNAVAILABLE' });
  }
  if (process.platform !== 'win32') {
    const real = path.join(f.root, 'linked-config.toml');
    await writeFile(real, f.text());
    await rm(f.file);
    await symlink(real, f.file);
    await assert.rejects(snapshotForeignConfig(f.home), { code: 'CODEX_CONFIG_SNAPSHOT_UNAVAILABLE' });
  }
});

test('rollback absence requires confirmed owned removal, stable actual config and an empty targeted response', async (t) => {
  const f = await fixture(t);
  const before = await discoverRegistration(async (args) => {
    if (args[1] === 'marketplace') throw failed();
    return { installed: [f.entry], available: [] };
  }, f.home);
  await writeFile(
    f.file,
    f.text().replace(/\[marketplaces\.apexrest\]\nsource_type = "local"\nsource = [^\n]+\n/u, ''),
  );
  const empty: CodexInvoke = async () => ({ installed: [], available: [] });
  await assert.rejects(
    discoverRegistration(async (args) => {
      if (args[1] === 'marketplace') throw failed();
      return { installed: [], available: [] };
    }, f.home),
    { code: 'CODEX_CONFIG_SNAPSHOT_UNAVAILABLE' },
  );
  await assert.rejects(discoverAfterOwnedRemoval(empty, f.home, before, { marketplaceName: 'foreign' }), {
    code: 'CODEX_REGISTRATION_UNKNOWN',
  });
  const removed = await discoverAfterOwnedRemoval(empty, f.home, before, { marketplaceName: 'apexrest' });
  assert.equal(removed.scope, 'apexrest-removed');
  assert.equal(foreignRegistrationsUnchanged(before, removed), true);
  await assert.rejects(
    discoverAfterOwnedRemoval(async () => ({ installed: [f.entry], available: [] }), f.home, before, {
      marketplaceName: 'apexrest',
    }),
    { code: 'CODEX_REGISTRATION_UNKNOWN' },
  );
  await writeFile(
    f.file,
    f
      .text()
      .replace(/\[marketplaces\.apexrest\]\nsource_type = "local"\nsource = [^\n]+\n/u, '')
      .replace('hide_agent_reasoning = true', 'hide_agent_reasoning = false'),
  );
  await assert.rejects(discoverAfterOwnedRemoval(empty, f.home, before, { marketplaceName: 'apexrest' }), {
    code: 'MARKETPLACE_CHANGED',
  });
});

test('owned-first removal tolerates only leading blank separators, preserving leading comments and values', async (t) => {
  const f = await fixture(t);
  const own = `[marketplaces.apexrest]\nsource_type = "local"\nsource = ${JSON.stringify(f.source)}\n[plugins."apexrest-apex@apexrest"]\nenabled = true\n\n`;
  const foreign = '[marketplaces.foreign]\nsource_type = "local"\nsource = "unchanged"\n\n';
  await writeFile(f.file, own + foreign);
  const before = await snapshotForeignConfig(f.home);
  await writeFile(f.file, '\n' + foreign + own);
  const after = await snapshotForeignConfig(f.home);
  assert.equal(after.foreignContentSha256, before.foreignContentSha256);
  assert.equal(after.foreignRegistrySha256, before.foreignRegistrySha256);
  assert.notEqual(after.wholeSha256, before.wholeSha256);
  await writeFile(f.file, '# externally added comment\n' + foreign + own);
  assert.notEqual((await snapshotForeignConfig(f.home)).foreignContentSha256, before.foreignContentSha256);
  await writeFile(f.file, '\n' + foreign.replace('unchanged', 'externally edited') + own);
  const changed = await snapshotForeignConfig(f.home);
  assert.notEqual(changed.foreignContentSha256, before.foreignContentSha256);
  assert.notEqual(changed.foreignRegistrySha256, before.foreignRegistrySha256);
});
