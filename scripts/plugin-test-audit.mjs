import { parseArgs } from 'node:util';
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { sha256 } from './lib/release.mjs';
import { savePrivateJson } from './lib/plugin-test-metrics.mjs';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    baseline: { type: 'string' },
    actual: { type: 'string' },
    output: { type: 'string', default: 'docs/evidence/plugin-server/final-audit.json' },
  },
});
assert.ok(values.project && values.baseline && values.actual);
const project = await realpath(values.project);
async function inventory(relative) {
  const root = await realpath(path.resolve(project, relative));
  assert.ok(root.startsWith(project + path.sep));
  const files = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), 'Audit rejects symlinked source.');
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else {
        assert.ok(entry.isFile());
        files[path.relative(root, file).split(path.sep).join('/')] = sha256(await readFile(file));
      }
    }
  }
  await walk(root);
  return files;
}
const before = await inventory(values.baseline),
  after = await inventory(values.actual);
assert.ok(Object.keys(before).length > 0 && Object.keys(after).length > 0);
assert.ok(
  Object.keys(before).some((f) => f === '.apex' || f.startsWith('.apex/')),
  'Oracle metadata must be included.',
);
const mismatchedFiles = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  .filter((f) => before[f] !== after[f])
  .sort();
const report = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  apexProfile: '26.1',
  comparison:
    'Independent full server export versus initial private baseline; exact bytes, including hidden Oracle metadata. No normalization.',
  status: mismatchedFiles.length ? 'failed' : 'passed',
  beforeFiles: Object.keys(before).length,
  afterFiles: Object.keys(after).length,
  mismatchedFiles,
  before,
  after,
  limitation:
    'Application metadata only; no claim of business-data, browser or backup-restore-command qualification.',
};
await savePrivateJson(values.output, report);
console.log(
  JSON.stringify({
    status: report.status,
    files: report.beforeFiles,
    mismatchedFiles,
    evidence: values.output,
  }),
);
process.exitCode = mismatchedFiles.length ? 1 : 0;
