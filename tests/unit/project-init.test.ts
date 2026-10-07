import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { projectInit } from '../../packages/core/src/project.ts';
import { loadProject } from '../../packages/core/src/config.ts';
import { inventory } from '../../packages/core/src/fs.ts';
import { Fault } from '../../packages/core/src/result.ts';

async function temporary(t: TestContext) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'apexrest-project-init-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const conflict = (error: unknown) => error instanceof Fault && error.code === 'LOCAL_EDITS_CONFLICT';

test('existing-app scaffolding accepts an existing empty directory and preserves its mode', async (t) => {
  const root = await temporary(t);
  const directory = path.join(root, 'current-folder');
  await mkdir(directory);
  if (process.platform !== 'win32') await chmod(directory, 0o750);
  const before = await lstat(directory);
  const result = await projectInit(directory, 'existing-app', 'current-folder');
  const after = await lstat(directory);
  assert.equal(after.mode & 0o777, before.mode & 0o777);
  assert.equal(after.ino, before.ino);
  assert.equal(result.root, directory);
  assert.equal(result.template, 'existing-app');
  assert.deepEqual((await loadProject(directory)).config, result.configuration);
  assert.equal('tests' in result.configuration, false);
  assert.equal((await readdir(directory)).includes('tests'), false);
  assert.ok((await lstat(path.join(directory, 'src/database/migrations'))).isDirectory());
  assert.ok((await readFile(path.join(directory, 'apexrest.toolchain.lock.json'))).length > 0);
});

test('project initialization preserves a nonempty folder containing only a hidden file', async (t) => {
  const root = await temporary(t);
  const directory = path.join(root, 'current-folder');
  await mkdir(directory);
  await writeFile(path.join(directory, '.keep'), 'Existing hidden file must remain unchanged.\n');
  const before = await inventory(directory);
  await assert.rejects(projectInit(directory, 'existing-app', 'current-folder'), conflict);
  assert.deepEqual(await inventory(directory), before);
  assert.deepEqual(await readdir(directory), ['.keep']);
});

test('project initialization rejects a regular file without changing its bytes', async (t) => {
  const root = await temporary(t);
  const file = path.join(root, 'current-folder');
  const original = Buffer.from('A file, not a project directory.\n');
  await writeFile(file, original);
  await assert.rejects(projectInit(file, 'existing-app', 'current-folder'), conflict);
  assert.deepEqual(await readFile(file), original);
  assert.ok((await lstat(file)).isFile());
  assert.deepEqual(await readdir(root), ['current-folder']);
});

test('project initialization rejects a leaf symlink and leaves its empty target untouched', async (t) => {
  const root = await temporary(t);
  const target = path.join(root, 'empty-target');
  const directory = path.join(root, 'linked-folder');
  await mkdir(target);
  await symlink(target, directory, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(projectInit(directory, 'existing-app', 'current-folder'), conflict);
  assert.deepEqual(await readdir(target), []);
  assert.ok((await lstat(directory)).isSymbolicLink());
});

test('existing-app scaffolding still creates a new nested project directory', async (t) => {
  const root = await temporary(t);
  const directory = path.join(root, 'new-parent', 'new-project');
  const result = await projectInit(directory, 'existing-app', 'new-project');
  assert.equal(result.root, directory);
  assert.equal((await loadProject(directory)).config.projectId, 'new-project');
  assert.equal((await readdir(directory)).includes('tests'), false);
  assert.deepEqual(await readdir(root), ['new-parent']);
});

test('existing projects ignore retired test paths without creating or running suites', async (t) => {
  const root = await temporary(t);
  const directory = path.join(root, 'legacy');
  const initialized = await projectInit(directory, 'existing-app', 'legacy');
  const legacy = {
    ...initialized.configuration,
    database: { ...initialized.configuration.database, testsDir: 'tests/sql' },
    tests: { unitDir: 'tests/unit', e2eDir: 'tests/e2e', requiredSuites: ['sql', 'e2e'] },
  };
  await writeFile(path.join(directory, 'apexrest.json'), JSON.stringify(legacy));
  assert.deepEqual((await loadProject(directory)).config, initialized.configuration);
  assert.equal((await readdir(directory)).includes('tests'), false);
});

test('concurrent initialization of one empty directory creates exactly one complete project', async (t) => {
  const root = await temporary(t);
  const directory = path.join(root, 'shared-empty-folder');
  await mkdir(directory);
  const results = await Promise.allSettled([
    projectInit(directory, 'existing-app', 'first-project'),
    projectInit(directory, 'existing-app', 'second-project'),
  ]);
  const succeeded = results.filter((result) => result.status === 'fulfilled');
  const failed = results.filter((result) => result.status === 'rejected');
  assert.equal(succeeded.length, 1);
  assert.equal(failed.length, 1);
  assert.ok(conflict(failed[0]!.reason));
  const configuration = (await loadProject(directory)).config;
  assert.deepEqual(configuration, succeeded[0]!.value.configuration);
  assert.equal(configuration.application.alias, configuration.projectId);
  assert.ok((await readFile(path.join(directory, '.gitignore'), 'utf8')).includes('.apexrest/\n'));
  assert.ok((await readFile(path.join(directory, configuration.toolchain.lockFile))).length > 0);
});
