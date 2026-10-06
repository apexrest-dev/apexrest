import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { sourceDigest, sha256 } from './lib/release.mjs';
const commands = [
  ['ci', '--ignore-scripts'],
  ['run', 'lint'],
  ['run', 'typecheck'],
  ['run', 'build'],
  ['run', 'test:unit'],
  ['run', 'plugin:check'],
  ['run', 'test:contracts'],
  ['run', 'test:installers'],
  ['run', 'site:build'],
  ['run', 'test:packaging'],
  ['run', 'release:dry-run'],
];
const report = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  sourceDigest: await sourceDigest(),
  status: 'running',
  oracleIntegration: false,
  checks: [],
};
await mkdir('.apexrest/check-logs', { recursive: true });
for (const args of commands) {
  const command = 'npm ' + args.join(' ');
  console.log('\nChecking ' + command);
  const start = Date.now();
  let stdout = '',
    stderr = '';
  const result = await new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    child.stdout.on('data', (b) => {
      stdout += b;
      process.stdout.write(b);
    });
    child.stderr.on('data', (b) => {
      stderr += b;
      process.stderr.write(b);
    });
    child.on('error', (error) => resolve({ code: 1, error: String(error) }));
    child.on('close', (code) => resolve({ code }));
  });
  const log = stdout + stderr;
  await writeFile('.apexrest/check-logs/' + args.at(-1).replaceAll(':', '-') + '.txt', log);
  report.checks.push({
    command,
    exitCode: result.code,
    durationMs: Date.now() - start,
    logSha256: sha256(log),
    testSummary: log
      .split('\n')
      .filter((line) => /^ℹ (?:tests|pass|fail|skipped)|^# (?:tests|pass|fail|skipped)/.test(line)),
  });
  if (result.code !== 0) {
    report.status = 'failed';
    break;
  }
}
report.status = report.status === 'failed' ? 'failed' : 'passed';
report.sourceDigest = await sourceDigest();
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/local-checks.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, evidence: 'docs/evidence/local-checks.json' }));
if (report.status !== 'passed') process.exitCode = 1;
