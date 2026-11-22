import { lstat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sourceDigest } from './lib/release.mjs';
import { validateExternalEvidence } from './lib/release-evidence.mjs';
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
    let status;
    let reasons = [];
    try {
      const info = await lstat('docs/evidence/' + file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024)
        throw new Error('Evidence must be a regular report of at most 2 MiB.');
      evidence = JSON.parse(await readFile('docs/evidence/' + file, 'utf8'));
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
        throw new Error('Evidence must be a JSON object.');
    } catch (error) {
      status = error.code === 'ENOENT' ? 'missing' : 'invalid';
      reasons = [
        status === 'missing' ? 'No evidence report exists.' : 'Report is unreadable, malformed or unsafe.',
      ];
    }
    if (!status) {
      if (evidence.status !== 'passed') {
        status = 'blocked';
        reasons = ['The report has not passed. Retain its findings and complete the unverified scenarios.'];
      } else if (evidence.sourceDigest !== digest) {
        status = 'stale';
        reasons = ['Evidence belongs to another source digest. Qualify the frozen current candidate.'];
      } else if (!local) {
        try {
          const checked = await validateExternalEvidence(evidence, id, digest);
          status = checked.valid ? 'passed' : 'invalid';
          reasons = checked.errors;
        } catch {
          status = 'invalid';
          reasons = ['External evidence could not be safely validated.'];
        }
      } else status = 'passed';
    }
    requirements.push({
      id,
      evidence: 'docs/evidence/' + file,
      local,
      requiredForNpm: local || !localOnlyNpm,
      status,
      ...(reasons.length ? { reasons } : {}),
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
      'External report validation checks declared scope and content-addressed proof bytes; it does not independently establish native or Oracle execution.',
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
