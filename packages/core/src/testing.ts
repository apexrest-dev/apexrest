import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile, cp, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { environment, isProductionTarget, managedHome, policy, requireTrust } from './config.ts';
import type { Environment, ProjectContext } from './config.ts';
import { contained, exists, inventory, readJson, writeJson, atomicWrite } from './fs.ts';
import { resolveConnection } from './connections.ts';
import { OracleAdapter, SCRIPT_RESTRICT_LEVEL, sqlclToken, sqlLiteral } from './oracle.ts';
import { runProcess } from './process.ts';
import { Fault, redact } from './result.ts';
import { ArtifactService } from './artifacts.ts';
import { resourceRoot } from './project.ts';
import { runtimeState } from '../../installer/src/toolchain.ts';
import { sqlclControlLines, targetDigest } from './deploy.ts';
export type Suite = 'unit' | 'sql' | 'api' | 'e2e';
export interface SuiteResult {
  suite: Suite;
  status: 'passed' | 'failed' | 'blocked' | 'not_configured' | 'dependency_missing' | 'empty' | 'cancelled';
  tests: number;
  failures: number;
  skipped: number;
  artifactId?: string;
  diagnostic?: string;
  /** blocked only: the saved browser session no longer authenticates (for example after a full import). */
  reason?: 'reauth_required';
}
export function qualityGate(results: SuiteResult[], required: Suite[]) {
  return (
    results.every((r) => !['failed', 'cancelled'].includes(r.status)) &&
    required.every((s) =>
      results.some(
        (r) =>
          r.suite === s &&
          r.status === 'passed' &&
          r.tests > r.skipped &&
          r.failures === 0 &&
          r.skipped === 0,
      ),
    )
  );
}
/**
 * The required gate is unchanged; this only classifies why it did not pass.
 * True when every remaining suite would pass and the sole gap is an E2E run
 * blocked by an ended browser session that only an interactive login can renew.
 */
export function reauthRequired(results: SuiteResult[], required: Suite[]) {
  const ended = results.filter((r) => r.status === 'blocked' && r.reason === 'reauth_required');
  return (
    ended.some((r) => required.includes(r.suite)) &&
    qualityGate(
      results.filter((r) => !ended.includes(r)),
      required.filter((s) => !ended.some((r) => r.suite === s)),
    )
  );
}
export const REAUTH_DIAGNOSTIC =
  'The saved browser session no longer authenticates (the application shows its login page). A full application import ends existing APEX sessions. Run test auth interactively, then rerun E2E.';
export function parseJUnit(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Fault('UNSAFE_REPORT', 'DTD/entities are not allowed in test reports.', 1);
  const cases = [...xml.matchAll(/<testcase\b[^>]*?\/>|<testcase\b[^>]*>[\s\S]*?<\/testcase>/g)].map(
    (m) => m[0],
  );
  return {
    tests: cases.length,
    failures: cases.filter((c) => /<(?:failure|error)\b/.test(c)).length,
    skipped: cases.filter((c) => /<skipped\b/.test(c)).length,
  };
}
export function allowedOrigin(url: string, origins: string[]) {
  const u = new URL(url);
  if (
    !['https:', 'http:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.hostname.endsWith('.invalid') ||
    (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) ||
    !origins.includes(u.origin)
  )
    throw new Fault('ORIGIN_DENIED', 'The target origin is outside the configured allowlist.', 4);
  return u;
}
export class TestService {
  constructor(private oracle = new OracleAdapter()) {}
  async authorize(ctx: ProjectContext, name: string) {
    await requireTrust(ctx.root);
    const env = environment(ctx, name);
    if ((await isProductionTarget(env)) || !ctx.config.tests.mutationAllowedEnvironments.includes(name))
      throw new Fault(
        'TEST_MUTATION_DENIED',
        'Remote tests require a non-production environment explicitly allowed for mutations.',
        4,
        'blocked',
      );
    if (
      !(await policy()).grants.some(
        (g) =>
          g.projectRoot === ctx.root &&
          g.targetDigest === targetDigest(env) &&
          g.operations.includes('test') &&
          Date.parse(g.expiresAt) > Date.now(),
      )
    )
      throw new Fault(
        'TEST_APPROVAL_REQUIRED',
        'User-owned policy must authorize tests for this exact target.',
        4,
        'blocked',
      );
    allowedOrigin(env.baseUrl, [new URL(env.baseUrl).origin, ...env.allowedOrigins]);
    return env;
  }
  async run(
    ctx: ProjectContext,
    suite: Suite,
    envName?: string,
    signal?: AbortSignal,
    headed = false,
  ): Promise<SuiteResult> {
    try {
      await requireTrust(ctx.root);
      const dir = await contained(
        ctx.root,
        suite === 'sql' ? ctx.config.database.testsDir : ctx.config.tests[`${suite}Dir`],
      );
      if (!(await exists(dir))) return { suite, status: 'not_configured', tests: 0, failures: 0, skipped: 0 };
      const files = Object.keys(await inventory(dir));
      if (!files.length) return { suite, status: 'empty', tests: 0, failures: 0, skipped: 0 };
      const artifacts = new ArtifactService(ctx);
      if (suite === 'unit') {
        const tests = files.filter((f) => /\.(?:test|spec)\.(?:mjs|js|ts)$/.test(f));
        if (!tests.length) return { suite, status: 'empty', tests: 0, failures: 0, skipped: 0 };
        const result = await runProcess({
          executable: process.execPath,
          args: [
            '--experimental-strip-types',
            '--test',
            '--test-reporter=junit',
            ...tests.map((f) => path.join(dir, f)),
          ],
          cwd: ctx.root,
          ...(signal ? { signal } : {}),
          timeoutMs: 180000,
        });
        const counts = parseJUnit(result.stdout);
        const artifactId = await artifacts.save(result.stdout + result.stderr, 'unit-report');
        return {
          suite,
          status:
            result.timedOut || result.cancelled
              ? 'cancelled'
              : !counts.tests
                ? 'empty'
                : result.code === 0 && !counts.failures
                  ? 'passed'
                  : 'failed',
          ...counts,
          artifactId,
        };
      }
      if (!envName) throw new Fault('ENVIRONMENT_REQUIRED', 'Remote test suites require --env.', 2);
      const env = await this.authorize(ctx, envName);
      if (suite === 'sql') {
        // Reviewed SQL tests run as scripts; reject client commands before any Oracle call.
        const scripts = files.filter((f) => f.endsWith('.sql')).sort();
        for (const file of scripts) {
          const lines = sqlclControlLines(await readFile(await contained(dir, file), 'utf8'));
          if (lines.length)
            throw new Fault(
              'SQL_TEST_SCRIPT_CONTROL',
              `SQL test ${file} uses SQLcl client commands (line ${lines.join(', ')}). Tests may contain SQL and PL/SQL only.`,
              4,
              'blocked',
            );
        }
        await this.oracle.requireMutationSupport();
        const connection = await resolveConnection(env.deployConnectionRef);
        await this.oracle.verifyTarget(env, connection);
        const framework = await this.oracle.jsonQuery(
          "select owner,object_name from all_objects where object_name='UT' and object_type='PACKAGE'",
          connection,
        );
        if (!framework.length)
          return {
            suite,
            status: 'dependency_missing',
            tests: 0,
            failures: 0,
            skipped: 0,
            diagnostic: 'utPLSQL is absent. Review a separate framework installation plan.',
          };
        for (const file of scripts)
          await this.oracle.session(
            `@${sqlclToken(await contained(dir, file))}`,
            connection,
            true,
            signal,
            undefined,
            'text',
            SCRIPT_RESTRICT_LEVEL,
          );
        const result = await this.oracle.session(
          `set serveroutput on size unlimited\nbegin\n ut.run(${sqlLiteral(env.parsingSchema)}, ut_junit_reporter());\nend;\n/`,
          connection,
          true,
          signal,
        );
        const counts = parseJUnit(result.output),
          artifactId = await artifacts.save(result.output, 'utplsql-junit');
        return {
          suite,
          status: !counts.tests ? 'empty' : counts.failures ? 'failed' : 'passed',
          ...counts,
          artifactId,
        };
      }
      const state = await runtimeState();
      if (!state.playwright || !state.node)
        return {
          suite,
          status: 'dependency_missing',
          tests: 0,
          failures: 0,
          skipped: 0,
          diagnostic: 'Run apexrest setup to install pinned Playwright and Chromium.',
        };
      const runId = randomUUID(),
        runnerRoot = path.resolve(state.playwright, '../../../..'),
        run = path.join(runnerRoot, 'runs', runId);
      await mkdir(run, { recursive: true, mode: 0o700 });
      await cp(dir, path.join(run, 'tests'), { recursive: true });
      await cp(path.join(resourceRoot(), 'testkit'), path.join(run, 'testkit'), { recursive: true });
      const auth = path.join(ctx.root, '.apexrest/auth', envName, 'state.json'),
        authMeta = auth + '.meta.json';
      if (
        suite === 'e2e' &&
        (!(await exists(auth)) ||
          !(await exists(authMeta)) ||
          Date.parse(((await readJson(authMeta)) as { expiresAt: string }).expiresAt) < Date.now())
      )
        return {
          suite,
          status: 'blocked',
          tests: 0,
          failures: 0,
          skipped: 0,
          diagnostic: 'Authenticated browser state is missing or expired. Run test auth interactively.',
        };
      if (suite === 'e2e' && (await this.sessionState(ctx, state, auth, env, signal)) === 'login')
        return {
          suite,
          status: 'blocked',
          reason: 'reauth_required',
          tests: 0,
          failures: 0,
          skipped: 0,
          diagnostic: REAUTH_DIAGNOSTIC,
        };
      await atomicWrite(
        path.join(run, 'playwright.config.mjs'),
        `export default ${JSON.stringify({ testDir: './tests', forbidOnly: true, retries: 0, timeout: 30000, workers: 1, reporter: [['json', { outputFile: path.join(run, 'report.json') }]], use: { baseURL: env.baseUrl, browserName: 'chromium', serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off', ...(suite === 'e2e' ? { storageState: auth } : {}) } })};\n`,
      );
      const result = await runProcess({
        executable: state.node,
        args: [
          state.playwright,
          'test',
          '--config',
          path.join(run, 'playwright.config.mjs'),
          ...(headed ? ['--headed'] : []),
        ],
        cwd: run,
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: path.join(managedHome(), 'browsers'),
          APEXREST_ALLOWED_ORIGINS: JSON.stringify([new URL(env.baseUrl).origin, ...env.allowedOrigins]),
          APEXREST_EXPECTED_MARKER: env.expectedMarker ?? '',
        },
        timeoutMs: 300000,
        ...(signal ? { signal } : {}),
      });
      const reportFile = path.join(run, 'report.json');
      if (!(await exists(reportFile)))
        return {
          suite,
          status: result.timedOut || result.cancelled ? 'cancelled' : 'failed',
          tests: 0,
          failures: 1,
          skipped: 0,
          diagnostic: redact(result.stderr).slice(0, 2000),
        };
      const report = (await readJson(reportFile)) as {
        stats: { expected: number; unexpected: number; flaky: number; skipped: number };
        errors?: unknown[];
      };
      const stats = report.stats,
        counts = {
          tests: stats.expected + stats.unexpected + stats.flaky + stats.skipped,
          failures: stats.unexpected + stats.flaky + (report.errors?.length ?? 0),
          skipped: stats.skipped,
        };
      const artifactId = await artifacts.save(await readFile(reportFile, 'utf8'), 'playwright-report');
      return {
        suite,
        status:
          result.timedOut || result.cancelled
            ? 'cancelled'
            : !counts.tests
              ? 'empty'
              : result.code === 0 && !counts.failures
                ? 'passed'
                : 'failed',
        ...counts,
        artifactId,
      };
    } catch (e) {
      return {
        suite,
        status:
          e instanceof Fault && e.exitCode === 3
            ? 'dependency_missing'
            : e instanceof Fault && e.exitCode === 6
              ? 'cancelled'
              : 'blocked',
        tests: 0,
        failures: 0,
        skipped: 0,
        diagnostic: redact(e instanceof Error ? e.message : 'Test runner failed.'),
      };
    }
  }
  /** Read-only probe of the saved state; any probe failure is 'unknown' and the suite runs as before. */
  private async sessionState(
    ctx: ProjectContext,
    state: Awaited<ReturnType<typeof runtimeState>>,
    auth: string,
    env: Environment,
    signal?: AbortSignal,
  ): Promise<'authenticated' | 'login' | 'unknown'> {
    try {
      const helper = path.join(path.resolve(state.playwright!, '../../../..'), 'session-probe.mjs');
      await cp(path.join(resourceRoot(), 'playwright/session-probe.mjs'), helper);
      const result = await runProcess({
        executable: state.node!,
        args: [
          helper,
          auth,
          env.baseUrl,
          JSON.stringify([new URL(env.baseUrl).origin, ...env.allowedOrigins]),
          env.expectedMarker ?? '',
        ],
        cwd: ctx.root,
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(managedHome(), 'browsers') },
        timeoutMs: 60000,
        maxBytes: 4096,
        ...(signal ? { signal } : {}),
      });
      if (result.code !== 0) return 'unknown';
      const session = (JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '{}') as { session?: unknown })
        .session;
      return session === 'authenticated' || session === 'login' ? session : 'unknown';
    } catch {
      return 'unknown';
    }
  }
  async all(ctx: ProjectContext, name: string, signal?: AbortSignal) {
    const results: SuiteResult[] = [];
    for (const suite of ['unit', 'sql', 'api', 'e2e'] as const)
      results.push(await this.run(ctx, suite, name, signal));
    const runId = randomUUID(),
      ok = qualityGate(results, ctx.config.tests.requiredSuites),
      reauth = !ok && reauthRequired(results, ctx.config.tests.requiredSuites);
    const report = {
      runId,
      ok,
      ...(reauth ? { reauthRequired: true } : {}),
      environment: name,
      results,
      required: ctx.config.tests.requiredSuites,
      createdAt: new Date().toISOString(),
    };
    await writeJson(path.join(ctx.root, '.apexrest/test-runs', runId + '.json'), report);
    return { ok, reauthRequired: reauth, data: report };
  }
  async auth(ctx: ProjectContext, name: string) {
    const env = await this.authorize(ctx, name),
      state = await runtimeState();
    if (!state.playwright || !state.node)
      throw new Fault('SETUP_REQUIRED', 'Install Playwright through setup first.', 3);
    if (!process.stdin.isTTY)
      throw new Fault(
        'INTERACTIVE_LOGIN_REQUIRED',
        'Run test auth in a local interactive terminal. Do not send passwords to Codex.',
        4,
      );
    const destination = path.join(ctx.root, '.apexrest/auth', name, 'state.json');
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const helper = path.join(path.resolve(state.playwright, '../../../..'), 'auth.mjs');
    await cp(path.join(resourceRoot(), 'playwright/auth.mjs'), helper);
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(
        state.node!,
        [
          helper,
          destination,
          env.baseUrl,
          JSON.stringify([new URL(env.baseUrl).origin, ...env.allowedOrigins]),
        ],
        {
          cwd: ctx.root,
          env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(managedHome(), 'browsers') },
          stdio: ['inherit', 'ignore', 'inherit'],
        },
      );
      child.once('error', reject);
      child.once('exit', resolve);
    });
    if (code !== 0 || !(await exists(destination)))
      throw new Fault('AUTH_NOT_SAVED', 'Login did not save browser state.', 4);
    await chmod(destination, 0o600);
    await writeJson(destination + '.meta.json', {
      expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      origin: new URL(env.baseUrl).origin,
    });
    return { state: 'stored', expiresInHours: 8, authentication: 'verified-by-required-E2E-marker' };
  }
}
