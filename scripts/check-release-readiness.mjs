import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sourceDigest } from './lib/release.mjs';
export async function readiness() {
  const digest = await sourceDigest();
  const requirements = [];
  for (const [id, file] of [
    ['composer-local', 'composer-local.json'],
    ['composer-runtime', 'composer-runtime.json'],
    ['composer-native-new-chat', 'composer-native-new-chat.json'],
    ['local-checks', 'local-checks.json'],
    ['native-macos', 'native-codex-compat.json'],
    ['native-linux', 'native-linux-x64.json'],
    ['native-windows', 'native-win32-x64.json'],
    ['oracle-local', 'oracle-local.json'],
    ['oracle-integration', 'oracle-integration.json'],
  ]) {
    let evidence;
    try {
      evidence = JSON.parse(await readFile('docs/evidence/' + file, 'utf8'));
    } catch {
      /* missing is a blocker */
    }
    requirements.push({
      id,
      evidence: 'docs/evidence/' + file,
      status: !evidence
        ? 'missing'
        : evidence.status !== 'passed'
          ? 'blocked'
          : evidence.sourceDigest !== digest
            ? 'stale'
            : 'passed',
    });
  }
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const publisher = JSON.parse(await readFile('publisher.config.json', 'utf8'));
  const allEvidencePassed = requirements.every((r) => r.status === 'passed');
  return {
    schemaVersion: 1,
    version: pkg.version,
    sourceDigest: digest,
    stableReady: allEvidencePassed && !pkg.version.includes('-') && publisher.enabled,
    allEvidencePassed,
    publishingEnabled: publisher.enabled,
    channel: pkg.version.includes('-') ? 'beta' : 'stable',
    requirements,
    limitations: [
      'No automated evidence substitutes for an independently protected trusted CI runner.',
      'Optional sandbox is unsupported; it is not a required client gate.',
    ],
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await readiness();
  console.log(JSON.stringify(r, null, 2));
  if (!r.stableReady) process.exitCode = 3;
}
