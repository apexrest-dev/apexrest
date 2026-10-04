import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync, unzipSync } from 'fflate';
import { sha256, zipTree, files } from '../../scripts/lib/release.mjs';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
test('Codex package declares native skills, local MCP and exclusive product routing', async () => {
  const root = 'dist/codex-compat/plugins/apexrest-apex';
  const manifest = JSON.parse(await readFile(root + '/.codex-plugin/plugin.json'));
  const mcp = JSON.parse(await readFile(root + '/.mcp.json'));
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.deepEqual(mcp.mcpServers.apexrest, { command: 'node', args: ['runtime/mcp.mjs'], cwd: '.' });
  const marketplace = JSON.parse(await readFile('dist/codex-compat/.agents/plugins/marketplace.json'));
  assert.deepEqual(marketplace.plugins[0].policy.products, ['codex']);
  const claude = JSON.parse(
    await readFile('dist/codex-compat/plugins/apexrest-apex/.claude-plugin/plugin.json'),
  );
  const claudeMarket = JSON.parse(await readFile('dist/codex-compat/.claude-plugin/marketplace.json'));
  assert.equal(claude.name, 'apexrest');
  assert.equal(claude.skills, './skills/');
  assert.deepEqual(claude.mcpServers.apexrest.args, ['${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs']);
  assert.equal(claudeMarket.plugins[0].name, claude.name);
  assert.equal(claudeMarket.plugins[0].version, claude.version);
  assert.equal(claudeMarket.plugins[0].source, './plugins/apexrest-apex');
  // When the Claude Code CLI is installed, its validator is the authority on both manifests.
  const validator = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (validator.status === 0)
    for (const target of ['dist/codex-compat/plugins/apexrest-apex', 'dist/codex-compat'])
      assert.equal(
        spawnSync('claude', ['plugin', 'validate', '--strict', target], { encoding: 'utf8' }).status,
        0,
        `claude plugin validate --strict ${target}`,
      );
  await assert.rejects(readFile('dist/portable/plugins/apexrest-apex/plugin.json'), { code: 'ENOENT' });
});
// The 2026-10-04 redesign: five skills and eleven MCP tools. Keep these lists in
// step with plugins/apexrest-apex/skills and packages/core/src/operations.ts.
const expectedSkills = [
  'apexrest-apexlang',
  'apexrest-pattern-catalog',
  'apexrest-safety',
  'apexrest-setup',
  'apexrest-work',
];
const expectedTools = [
  'apexrest_project',
  'apexrest_reference',
  'apexrest_metadata_read',
  'apexrest_apex_validate',
  'apexrest_ship',
  'apexrest_apex_sync',
  'apexrest_test_run',
  'apexrest_browser_open',
  'apexrest_job',
  'apexrest_artifact_read',
  'apexrest_status',
];
test('Codex package is self-contained, same version, exactly the five redesigned skills and no author paths', async () => {
  for (const profile of ['codex-compat']) {
    const root = `dist/${profile}/plugins/apexrest-apex`;
    const list = await files(root);
    const skills = list.filter((f) => /^skills\/[^/]+\/SKILL.md$/.test(f));
    assert.deepEqual(
      skills,
      expectedSkills.map((skill) => `skills/${skill}/SKILL.md`),
    );
    assert.equal(
      skills.length,
      (await files('plugins/apexrest-apex/skills')).filter((f) => f.endsWith('/SKILL.md')).length,
    );
    for (const skill of skills)
      assert.ok(list.includes(skill.replace('SKILL.md', 'agents/openai.yaml')), skill);
    assert.ok(list.includes('.claude-plugin/plugin.json'));
    assert.ok(list.includes('.codex-plugin/plugin.json'));
    const manifest = JSON.parse(await readFile(root + '/' + '.codex-plugin/plugin.json'));
    assert.equal(manifest.version, pkg.version);
    assert.ok(list.includes('resources/templates/blank-app/application/.apex/apexlang.json'));
    for (const file of list.filter((f) => /\.(?:json|mjs|md)$/.test(f))) {
      const bytes = await readFile(root + '/' + file, 'utf8');
      assert.ok(!bytes.includes('/Users/oleksii/'), file);
      assert.ok(!/BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/.test(bytes), file);
    }
    const temp = await mkdtemp(path.join(tmpdir(), 'apexrest-package-'));
    await cp(root, temp, { recursive: true });
    const r = spawnSync(
      process.execPath,
      [path.join(temp, 'runtime/apexrest.mjs'), 'plugin', 'validate', '--from', temp, '--json'],
      { cwd: temp, encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
  }
});
test('Skills name only current MCP tools, the work skill covers the ship loop and default prompts resolve to shipped skills', async () => {
  const root = 'dist/codex-compat/plugins/apexrest-apex';
  const mentioned = new Set();
  for (const skill of expectedSkills) {
    const text = await readFile(`${root}/skills/${skill}/SKILL.md`, 'utf8');
    for (const [name] of text.matchAll(/apexrest_[a-z_]+/g)) {
      assert.ok(expectedTools.includes(name), `${skill} names a tool outside the catalog: ${name}`);
      mentioned.add(name);
    }
  }
  const work = await readFile(`${root}/skills/apexrest-work/SKILL.md`, 'utf8');
  for (const name of [
    'apexrest_project',
    'apexrest_reference',
    'apexrest_apex_validate',
    'apexrest_ship',
    'apexrest_job',
    'apexrest_browser_open',
  ])
    assert.ok(work.includes(name), `apexrest-work must describe ${name}`);
  const operations = JSON.parse(await readFile(root + '/resources/schemas/operations.schema.json', 'utf8'));
  for (const operation of ['project', 'reference', 'ship', 'job', 'status'])
    assert.ok(operation in operations, `operation schema ${operation}`);
  for (const operation of Object.keys(operations))
    assert.ok(!/^panel\.(open|action)$/.test(operation), `removed panel operation ${operation}`);
  const manifest = JSON.parse(await readFile(root + '/.codex-plugin/plugin.json', 'utf8'));
  const prompts = manifest.interface.defaultPrompt;
  assert.ok(prompts.length > 0 && prompts.length <= 3);
  assert.ok(prompts.every((prompt) => prompt.length <= 128));
  assert.ok(prompts.some((prompt) => prompt.includes('$apexrest-work')));
  for (const prompt of prompts)
    for (const [, skill] of prompt.matchAll(/\$(apexrest-[a-z-]+)/g))
      assert.ok(expectedSkills.includes(skill), `default prompt references a missing skill: ${skill}`);
});
test('ZIP generation is deterministic and includes dotfiles, licenses and native metadata', async () => {
  const first = await zipTree('dist/codex-compat', zipSync),
    second = await zipTree('dist/codex-compat', zipSync);
  assert.equal(sha256(first), sha256(second));
  const entries = unzipSync(first);
  assert.ok(entries['.agents/plugins/marketplace.json']);
  assert.ok(entries['.claude-plugin/marketplace.json']);
  assert.ok(entries['plugins/apexrest-apex/.claude-plugin/plugin.json']);
  assert.ok(entries['plugins/apexrest-apex/.codex-plugin/plugin.json']);
  assert.ok(entries['plugins/apexrest-apex/.mcp.json']);
  assert.ok(entries['plugins/apexrest-apex/LICENSE']);
  for (const skill of expectedSkills)
    assert.ok(entries[`plugins/apexrest-apex/skills/${skill}/SKILL.md`], skill);
});
test('npm tarball inventory ships both host manifests, the runtime and no removed surfaces', async () => {
  assert.ok(pkg.files.includes('dist/codex-compat/'));
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(packed.status, 0, packed.stderr);
  const inventory = JSON.parse(packed.stdout)[0].files.map((entry) => entry.path);
  for (const file of [
    'dist/codex-compat/.agents/plugins/marketplace.json',
    'dist/codex-compat/.claude-plugin/marketplace.json',
    'dist/codex-compat/plugins/apexrest-apex/.claude-plugin/plugin.json',
    'dist/codex-compat/plugins/apexrest-apex/.codex-plugin/plugin.json',
    'dist/codex-compat/plugins/apexrest-apex/.mcp.json',
    'dist/codex-compat/plugins/apexrest-apex/runtime/mcp.mjs',
    'dist/runtime/mcp.mjs',
    'dist/runtime/apexrest.mjs',
    ...expectedSkills.map((skill) => `dist/codex-compat/plugins/apexrest-apex/skills/${skill}/SKILL.md`),
  ])
    assert.ok(inventory.includes(file), file);
  const shippedSkills = new Set(
    inventory
      .map(
        (file) => file.match(/^dist\/codex-compat\/plugins\/apexrest-apex\/skills\/([^/]+)\/SKILL\.md$/)?.[1],
      )
      .filter(Boolean),
  );
  assert.deepEqual([...shippedSkills].sort(), expectedSkills);
  assert.ok(
    !inventory.some((file) => /\.uk\.md$/.test(file)),
    'Ukrainian documentation is no longer shipped',
  );
});
test('bootstrap refuses tampered ZIP before any installation code', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'apexrest-integrity-'));
  const archive = path.join(temp, 'bad.zip');
  await writeFile(archive, 'not-a-release');
  const r = spawnSync(
    process.execPath,
    ['scripts/bootstrap-runtime.mjs', '--bundle', archive, '--sha256', '0'.repeat(64), '--yes'],
    { encoding: 'utf8' },
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /integrity failure/);
});
test('site has all required routes, working internal links and accessible structure', async () => {
  const all = await files('site-dist');
  assert.ok(all.includes('llms.txt'));
  for (const file of all.filter((f) => f.endsWith('.html'))) {
    const html = await readFile('site-dist/' + file, 'utf8');
    assert.match(html, new RegExp(`<html lang="${file.startsWith('uk/') ? 'uk' : 'en'}"`));
    assert.match(html, /id="main"/);
    assert.match(html, /for="search"/);
    for (const link of [...html.matchAll(/(?:href|src)="(\/codex\/[^"#]*)"/g)].map((m) => m[1])) {
      let target = link.slice('/codex/'.length);
      if (!target || target.endsWith('/')) target += 'index.html';
      assert.ok(all.includes(target), `${file}: broken ${link}`);
    }
  }
});
