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
  await assert.rejects(readFile('dist/portable/plugins/apexrest-apex/plugin.json'), { code: 'ENOENT' });
});
test('Codex package is self-contained, same version, bounded skills including Composer and no author paths', async () => {
  for (const profile of ['codex-compat']) {
    const root = `dist/${profile}/plugins/apexrest-apex`;
    const list = await files(root);
    const skills = list.filter((f) => /^skills\/[^/]+\/SKILL.md$/.test(f));
    assert.ok(skills.includes('skills/apexrest-compose/SKILL.md'));
    assert.equal(
      skills.length,
      (await files('plugins/apexrest-apex/skills')).filter((f) => f.endsWith('/SKILL.md')).length,
    );
    assert.ok(skills.includes('skills/apexrest-pattern-catalog/SKILL.md'));
    for (const skill of skills)
      assert.ok(list.includes(skill.replace('SKILL.md', 'agents/openai.yaml')), skill);
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
test('All functions menu covers the operation catalog within the native plugin prompt limits', async () => {
  const root = 'dist/codex-compat/plugins/apexrest-apex';
  const menu = await readFile(root + '/skills/apexrest-menu/SKILL.md', 'utf8');
  const operations = JSON.parse(await readFile(root + '/resources/schemas/operations.schema.json', 'utf8'));
  assert.ok(menu.includes('(references/cli-catalog.md)'));
  const inventory = await readFile(root + '/skills/apexrest-menu/references/cli-catalog.md', 'utf8');
  const indexed = new Set([...inventory.matchAll(/`([a-z]+(?:\.[a-z-]+)?)`/g)].map((match) => match[1]));
  for (const operation of Object.keys(operations)) assert.ok(indexed.has(operation), operation);
  const manifest = JSON.parse(await readFile(root + '/.codex-plugin/plugin.json', 'utf8'));
  const prompts = manifest.interface.defaultPrompt;
  assert.ok(prompts.length > 0 && prompts.length <= 3);
  assert.ok(prompts.every((prompt) => prompt.length <= 128));
  assert.ok(prompts.some((prompt) => prompt.includes('$apexrest-menu')));
});
test('ZIP generation is deterministic and includes dotfiles, licenses and native metadata', async () => {
  const first = await zipTree('dist/codex-compat', zipSync),
    second = await zipTree('dist/codex-compat', zipSync);
  assert.equal(sha256(first), sha256(second));
  const entries = unzipSync(first);
  assert.ok(entries['.agents/plugins/marketplace.json']);
  assert.ok(entries['plugins/apexrest-apex/.mcp.json']);
  assert.ok(entries['plugins/apexrest-apex/LICENSE']);
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
