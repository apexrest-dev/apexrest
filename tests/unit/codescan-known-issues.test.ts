import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { parseCodeScan } from '../../packages/core/src/upgrade-audit.ts';
import {
  CODESCAN_KNOWN_FALSE_POSITIVE_POLICY,
  KNOWN_FALSE_POSITIVES,
  applicationProves,
  classifyCodeScanFindings,
} from '../../packages/core/src/codescan-known-issues.ts';

const sqlcl263 = 'SQLcl: Release 26.3.0.0 Production Build: 26.3.0.260.1620';
const mmd262 = '26.2.0+3479';

// Shape of a real SQLcl 26.3.0.260.1620 `codescan -extensions apx -format json` run
// against an MMD 26.2.0+3479 application whose application.apx sets every property.
const report = (root: string) =>
  `24 files, 6 total distinct warnings\n` +
  JSON.stringify([
    {
      file: `${root}/application.apx`,
      issues: [
        {
          line: 0,
          col: 0,
          ruleNo: 'APEX-002',
          msg: 'Non-public pages must have an authentication scheme and an authorization scheme at page or application scope.',
          target: 'app:APEXREST-TEST',
        },
        {
          line: 0,
          col: 0,
          ruleNo: 'APEX-009',
          msg: 'Checksum protection is configured, but application session state protection is not enabled',
          target: 'app:APEXREST-TEST',
        },
        {
          line: 0,
          col: 0,
          ruleNo: 'APEX-031',
          msg: 'Applications require exact substitution matching',
          target: 'app:APEXREST-TEST',
        },
      ],
    },
    {
      file: `${root}/pages/p00001-home.apx`,
      issues: [
        {
          line: 35,
          col: 295,
          ruleNo: 'G-1050',
          msg: 'Avoid using literals in your code',
          target: 'app:APEXREST-TEST/page:1/region:r1',
        },
      ],
    },
  ]);

const app = (body: string) => `app APEXREST-TEST (\n    name: Home Finance\n${body})\n`;
const authn = '    authentication {\n        scheme: @oracle-apex-accounts\n    }\n';
const authz = '    authorization {\n        scheme: @authenticated-user\n    }\n';
const ssp = (enabled: string) => `    sessionStateProtection {\n        enabled: ${enabled}\n    }\n`;
const advanced = (extra = '') => `    advanced {\n        modernizeApp: true\n${extra}    }\n`;
const complete = app(authn + authz + ssp('true') + advanced());

const classify = (
  application: string | null,
  overrides: { compilerVersion?: string; mmdVersion?: string | null } = {},
) =>
  classifyCodeScanFindings(parseCodeScan(report('/source'), '/source'), {
    compilerVersion: sqlcl263,
    mmdVersion: mmd262,
    application,
    ...overrides,
  });
const marked = (findings: ReturnType<typeof classify>) =>
  findings.filter((f) => f.knownFalsePositive).map((f) => f.code);

test('known false positives are marked with policy, profile, reason and evidence, never removed', () => {
  const findings = classify(complete);
  assert.equal(findings.length, 4, 'classification keeps every finding');
  assert.deepEqual(marked(findings), ['APEX-002', 'APEX-009', 'APEX-031']);
  const g1050 = findings.find((f) => f.code === 'G-1050')!;
  assert.equal(g1050.knownFalsePositive, undefined);
  assert.equal(g1050.file, 'pages/p00001-home.apx');
  for (const finding of findings.filter((f) => f.knownFalsePositive)) {
    assert.equal(finding.file, 'application.apx');
    assert.equal(finding.knownFalsePositive!.policy, CODESCAN_KNOWN_FALSE_POSITIVE_POLICY);
    assert.equal(finding.knownFalsePositive!.profile, 'apex262-sqlcl263-mmd3479');
    assert.ok(finding.knownFalsePositive!.reason.length > 40);
    assert.equal(
      finding.knownFalsePositive!.evidence,
      KNOWN_FALSE_POSITIVES.find((rule) => rule.code === finding.code)!.evidence,
    );
  }
});

test('APEX-002 needs both application authentication and authorization schemes in source', () => {
  assert.ok(marked(classify(app(authn + authz))).includes('APEX-002'));
  // The built-in enum is an authorization scheme too.
  assert.ok(
    marked(
      classify(app(authn + '    authorization {\n        scheme: mustNotBePublicUser\n    }\n')),
    ).includes('APEX-002'),
  );
  for (const application of [
    app(''),
    app(authn),
    app(authz),
    app(authn + '    authorization {\n        runOnPublicPages: false\n    }\n'),
    app('    authentication {\n        scheme: \n    }\n' + authz),
    app(authn + authn + authz),
  ])
    assert.ok(!marked(classify(application)).includes('APEX-002'), application);
});

test('APEX-009 respects the enabled default and stays real when protection is disabled', () => {
  for (const body of ['', ssp('true'), '    sessionStateProtection {\n        checksumSalt: abc\n    }\n'])
    assert.ok(marked(classify(app(body))).includes('APEX-009'), body);
  for (const body of [
    ssp('false'),
    ssp('bogusValue'),
    '    sessionStateProtection {\n        enabled: true\n        enabled: false\n    }\n',
    ssp('true') + ssp('true'),
  ])
    assert.ok(!marked(classify(app(body))).includes('APEX-009'), body);
});

test('APEX-031 is a known false positive only while exactSubstitutions keeps its 26.2 default', () => {
  assert.ok(marked(classify(app(''))).includes('APEX-031'));
  assert.ok(marked(classify(app(advanced()))).includes('APEX-031'));
  // SQLcl 26.3 accepts `false` with a deprecation warning: a real ambiguity setting.
  assert.ok(!marked(classify(app(advanced('        exactSubstitutions: false\n')))).includes('APEX-031'));
  assert.ok(!marked(classify(app(advanced() + advanced()))).includes('APEX-031'));
});

test('classification fails closed outside the profile or without provable source', () => {
  for (const overrides of [
    { compilerVersion: 'SQLcl: Release 26.1.2.0 Production' },
    { mmdVersion: '26.1.0+3102' },
    { mmdVersion: null },
  ])
    assert.deepEqual(marked(classify(complete, overrides)), [], JSON.stringify(overrides));
  assert.deepEqual(marked(classify(null)), []);
  assert.deepEqual(marked(classify(complete.replace('    }\n', '    \n'))), [], 'unbalanced source');
  assert.deepEqual(marked(classify(complete + complete)), [], 'two app components');
  assert.equal(applicationProves('page 1 (\n)\n', 'app.sessionStateProtection.enabled:not-false'), false);
  // The same rule number reported for another file is not covered.
  const moved = classifyCodeScanFindings(
    [{ code: 'APEX-002', file: 'pages/p00001.apx', line: 0, column: 0, message: 'x', severity: 'warning' }],
    { compilerVersion: sqlcl263, mmdVersion: mmd262, application: complete },
  );
  assert.equal(moved[0]!.knownFalsePositive, undefined);
});

test('the adapter classifies the scanned copy and reports the policy and count', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'apexrest-codescan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  await mkdir(path.join(source, '.apex'), { recursive: true });
  await writeFile(path.join(source, '.apex/apexlang.json'), JSON.stringify({ mmdVersion: mmd262 }));
  await writeFile(path.join(source, 'application.apx'), app(authn + ssp('true')));
  const oracle = new OracleAdapter();
  oracle.capabilities = async () =>
    ({ version: sqlcl263 }) as Awaited<ReturnType<OracleAdapter['capabilities']>>;
  const stage = path.join(root, 'stage');
  oracle.stage = async () => (await mkdir(stage, { recursive: true }), stage);
  oracle.discardStage = async () => {};
  oracle.session = async (input) => {
    const output =
      input === 'help codescan' ? '-extensions <ext> ... .apx' : report(path.join(stage, 'application'));
    return {
      code: 0,
      stdout: output,
      stderr: '',
      output,
      timedOut: false,
      cancelled: false,
      truncated: false,
      work: stage,
    };
  };
  const result = await oracle.codeScan(source);
  assert.equal(result.status, 'advisory');
  assert.equal(result.knownFalsePositivePolicy, CODESCAN_KNOWN_FALSE_POSITIVE_POLICY);
  // No application authorization scheme: APEX-002 remains a real finding.
  assert.deepEqual(marked(result.findings), ['APEX-009', 'APEX-031']);
  assert.equal(result.knownFalsePositives, 2);
  assert.equal(result.findings.length, 4);
  assert.equal(await readFile(path.join(source, 'application.apx'), 'utf8'), app(authn + ssp('true')));
});
