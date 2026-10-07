import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sourceDigest } from './lib/release.mjs';
export async function readiness() {
  const digest = await sourceDigest();
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const publisher = JSON.parse(await readFile('publisher.config.json', 'utf8'));
  const localOnlyNpm =
    publisher.npmReadiness?.version === pkg.version && publisher.npmReadiness?.qualification === 'local';
  const requirements = [];
  for (const [id, file, local] of [
    ['composer-local', 'composer-local.json', true],
    ['composer-runtime', 'composer-runtime.json', false],
    ['composer-native-new-chat', 'composer-native-new-chat.json', false],
    ['local-checks', 'local-checks.json', true],
    ['native-macos', 'native-codex-compat.json', false],
    ['native-linux', 'native-linux-x64.json', false],
    ['native-windows', 'native-win32-x64.json', false],
    ['oracle-local', 'oracle-local.json', true],
    ['oracle-integration', 'oracle-integration.json', false],
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
      local,
      requiredForNpm: local || !localOnlyNpm,
      status: !evidence
        ? 'missing'
        : evidence.status !== 'passed'
          ? 'blocked'
          : evidence.sourceDigest !== digest
            ? 'stale'
            : 'passed',
    });
  }
  const allEvidencePassed = requirements.every((r) => r.status === 'passed');
  const npmEvidencePassed = requirements.filter((r) => r.requiredForNpm).every((r) => r.status === 'passed');
  const localEvidencePassed = requirements.filter((r) => r.local).every((r) => r.status === 'passed');
  const stableVersion = !pkg.version.includes('-');
  const publishingEnabled = publisher.enabled === true;
  const npmPublishingEnabled = publishingEnabled && publisher.npmEnabled === true;
  return {
    schemaVersion: 2,
    version: pkg.version,
    sourceDigest: digest,
    stableReady: allEvidencePassed && stableVersion && publishingEnabled,
    npmReady: npmEvidencePassed && stableVersion && npmPublishingEnabled,
    npmReadinessPolicy: localOnlyNpm ? 'version-bound-local-evidence' : 'full-qualification',
    qualification: allEvidencePassed ? 'passed' : 'incomplete',
    localEvidencePassed,
    npmEvidencePassed,
    allEvidencePassed,
    publishingEnabled,
    npmPublishingEnabled,
    channel: pkg.version.includes('-') ? 'beta' : 'stable',
    requirements,
    limitations: [
      'No automated evidence substitutes for an independently protected trusted CI runner.',
      'Optional sandbox is unsupported; it is not a required client gate.',
      'Only a version-bound npm exception makes external reports advisory; full qualification still requires them.',
      'CI, package integrity, registry ownership and clean-install verification remain separate npm publication checks.',
    ],
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await readiness();
  console.log(JSON.stringify(r, null, 2));
  if (!(process.argv.includes('--npm') ? r.npmReady : r.stableReady)) process.exitCode = 3;
}
