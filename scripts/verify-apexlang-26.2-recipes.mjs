// Real Oracle compiler verification only. No login, imports, provider calls or database writes.
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const executable = process.argv.includes('--sqlcl') ? option('--sqlcl') : 'sql';
const output = process.argv.includes('--out') ? option('--out') : '.apexrest/apexlang-26.2-recipes.json';
const root = path.resolve('resources/references/26.2/recipes');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const run = (args, input) => {
  const result = spawnSync(executable, args, {
    input,
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const text = (result.stdout ?? '') + (result.stderr ?? '');
  if (result.error || result.status !== 0) throw new Error(`SQLcl failed: ${result.error?.message ?? text}`);
  return text;
};
const version = run(['-version']).trim();
if (!/Release 26\.3\./.test(version))
  throw new Error('This receipt requires the reviewed SQLcl 26.3 toolchain.');
const scratch = await mkdtemp(path.join(tmpdir(), 'apexrest-recipe26-2-'));
const app = path.join(scratch, 'apexrestrecipe');
try {
  const generate = run(
    ['-S', '/nolog'],
    `apex generate -name "APEXREST compiler recipes" -alias APEXRESTRECIPE -dir "${scratch}"\nexit\n`,
  );
  const compilerMetadata = JSON.parse(await readFile(path.join(app, '.apex/apexlang.json'), 'utf8'));
  if (compilerMetadata.mmdVersion !== manifest.mmdVersion)
    throw new Error('Generated compiler metadata does not match reviewed recipes.');
  const baseline = run(['-S', '/nolog'], `apex validate -input "${app}"\nexit\n`);
  if (!/Validation successful\./.test(baseline) || /Compile Errors|Error:|ORA-\d/.test(baseline))
    throw new Error(`Generated baseline did not compile: ${baseline}`);
  const hashes = {};
  for (const entry of manifest.files) {
    if (
      !/^[a-z0-9-]+\.apx$/.test(entry.file) ||
      !/^(?:pages|shared-components|workspace-components)\/[a-z0-9/.-]+\.apx$/.test(entry.target) ||
      entry.target.split('/').includes('..')
    )
      throw new Error('Unsafe recipe path.');
    const source = await readFile(path.join(root, entry.file), 'utf8');
    const destination = path.join(app, entry.target);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source);
    hashes[entry.file] = hash(source);
  }
  const validation = run(['-S', '/nolog'], `apex validate -input "${app}"\nexit\n`);
  if (!/Validation successful\./.test(validation) || /Compile Errors|Error:|ORA-\d/.test(validation))
    throw new Error(`Recipe compilation failed: ${validation}`);
  const receipt = {
    schemaVersion: 1,
    status: 'passed',
    evidenceKind: 'oracle-offline-compiler',
    sqlclVersion: version,
    mmdVersion: compilerMetadata.mmdVersion,
    scope:
      'Generated baseline and six recipe files compiled together using SQLcl /nolog; no Oracle database, provider, import, browser, credentials or workflow execution verified.',
    baseline: 'passed',
    files: hashes,
    generationOutputSha256: hash(generate.replaceAll(scratch, '<scratch>')),
    validationOutput: validation.trim(),
    validationOutputSha256: hash(validation),
  };
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
  console.log(
    `Oracle ${compilerMetadata.mmdVersion}: ${manifest.files.length} recipe files compiled; receipt ${output}`,
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
