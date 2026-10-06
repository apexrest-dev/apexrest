import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import { sourceMmdVersion } from '../../packages/core/src/compatibility.ts';
import { closeSqlclSessions, sqlclSessionStats } from '../../packages/core/src/sqlcl-session.ts';

test('SQLcl 26.3 generation requests isolation while the 26.1 path retains its existing pool policy', async () => {
  for (const [version, isolated] of [
    ['26.3.0.0', true],
    ['26.1.2.0', false],
  ] as const) {
    const oracle = new OracleAdapter();
    oracle.requireCapability = async () => ({
      version: `SQLcl: Release ${version} Production`,
      helpHash: 'help',
    });
    const stage = await mkdtemp(path.join(tmpdir(), 'apexrest-generation-policy-'));
    try {
      oracle.stage = async () => stage;
      oracle.findApplication = async () => stage;
      oracle.session = async (input, connection, mutation, _signal, cwd, _format, _restriction, fresh) => {
        assert.match(input, /^apex generate /);
        assert.equal(connection, undefined);
        assert.equal(mutation, false, 'Generation is offline, not a database mutation');
        assert.equal(cwd, stage);
        assert.equal(fresh, isolated);
        return {
          code: 0,
          stdout: '',
          stderr: '',
          output: '',
          work: stage,
          timedOut: false,
          cancelled: false,
          truncated: false,
        };
      };
      await oracle.generate('Fixture', 'fixture');
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }
});

const sqlcl = process.env.APEXREST_TEST_SQLCL_263;
const javaHome = process.env.APEXREST_TEST_JAVA_HOME;
test(
  'real SQLcl 26.3 generates then repeatedly validates in one process without poisoning its reusable JVM',
  { skip: !sqlcl || !javaHome },
  async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'apexrest-sqlcl263-real-'));
    const priorHome = process.env.APEXREST_HOME;
    process.env.APEXREST_HOME = root;
    await closeSqlclSessions();
    t.after(async () => {
      await closeSqlclSessions();
      if (priorHome === undefined) delete process.env.APEXREST_HOME;
      else process.env.APEXREST_HOME = priorHome;
      await rm(root, { recursive: true, force: true });
    });
    const oracle = new OracleAdapter();
    oracle.settings = async () => ({
      schemaVersion: 1,
      mode: 'cli',
      mcpRestrictLevel: '4',
      executable: sqlcl!,
      javaHome,
    });
    const generated = await oracle.generate('Generation isolation fixture', 'generation_isolation_fixture');
    assert.match(generated.compiler.version, /Release 26\.3\./);
    assert.equal(await sourceMmdVersion(generated.directory), '26.2.0+3479');
    for (let i = 0; i < 3; i++) assert.equal((await oracle.validate(generated.directory)).status, 'passed');
    assert.equal(
      sqlclSessionStats().reduce((n, p) => n + p.sessions, 0),
      1,
      'Repeated validation still reuses its offline JVM',
    );
  },
);
