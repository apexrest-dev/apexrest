import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { buildWebapp } from '../../packages/core/src/webapp/build.ts';
import { hashPassword, verifyPassword } from '../../packages/core/src/webapp/server.ts';
import { workspace } from '../fixtures/preview.ts';

const FILES: Record<string, string> = {
  'shared-components/acl-roles.apx': `role ADMINISTRATOR (
    name: Administrator
)
`,
  'shared-components/authorizations.apx': `authorization administration-rights (
    name: Administration Rights
    type: isInRoleOrGroup
    settings {
        names: Administrator
    }
    error {
        errorMessage: Administrators only
    }
)
`,
  'pages/p00004-admin.apx': `page 4 (
    name: Admin
    alias: ADMIN
    security {
        authorizationScheme: @administration-rights
    }

    region secret (
        name: Admin Only
        type: staticContent
        source {
            htmlCode: <p id="admin-body">secret</p>
        }
        layout {
            sequence: 10
        }
    )
)
`,
  'pages/p00005-welcome.apx': `page 5 (
    name: Welcome
    alias: WELCOME
    security {
        authentication: publicPage
    }

    region hello (
        name: Hello
        type: staticContent
        source {
            htmlCode: <p id="welcome-body">hello</p>
        }
        layout {
            sequence: 10
        }
    )
)
`,
};

/** A fake runtime folder: the build copies an entry and the chunks it references. */
async function fakeRuntime(root: string): Promise<string> {
  const dir = path.join(root, 'runtime');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'webapp.mjs'),
    'import "./chunk-A.mjs";\nexport const runWebapp = () => {};\n',
  );
  await writeFile(path.join(dir, 'webapp-driver-worker.mjs'), 'await import("./chunk-B.mjs");\n');
  await writeFile(path.join(dir, 'chunk-A.mjs'), 'import "./chunk-B.mjs";\n');
  await writeFile(path.join(dir, 'chunk-B.mjs'), '\n');
  await writeFile(path.join(dir, 'chunk-UNUSED.mjs'), '\n');
  return dir;
}

test('build webapp writes a runnable project and keeps its configuration on a rebuild', async (t) => {
  const { app, root } = await workspace(t, FILES);
  const runtimeDir = await fakeRuntime(root);
  const out = path.join(root, 'built');
  const first = buildWebapp({ sourceDir: app, out, runtimeDir });
  assert.equal(first.application.alias, 'demo');
  assert.equal(first.auth, 'users');
  assert.equal(first.assetsIncluded, false);
  for (const file of [
    'package.json',
    'server.mjs',
    'Dockerfile',
    'README.md',
    '.env.example',
    'config/default.json',
    'config/users.json',
    'build-manifest.json',
    'app/application.apx',
    'app/pages/p00004-admin.apx',
    'runtime/webapp.mjs',
    'runtime/webapp-driver-worker.mjs',
    'runtime/chunk-A.mjs',
    'runtime/chunk-B.mjs',
  ])
    assert.ok(existsSync(path.join(out, file)), `${file} is written`);
  // Only what the runtime entries reach is copied; local seed data and preview state are not.
  assert.equal(existsSync(path.join(out, 'runtime/chunk-UNUSED.mjs')), false);
  assert.equal(existsSync(path.join(out, 'app/.apex-local')), false);
  const pkg = JSON.parse(await readFile(path.join(out, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  assert.deepEqual(Object.keys(pkg.dependencies), ['oracledb']);
  assert.equal(pkg.scripts.start, 'node server.mjs');
  const manifest = await readFile(path.join(out, 'build-manifest.json'), 'utf8');
  assert.doesNotMatch(await readFile(path.join(out, '.env.example'), 'utf8'), /PASSWORD=\S/u);

  // A rebuild replaces the generated parts, keeps configuration, and is byte-identical for the same input.
  await writeFile(path.join(out, 'config/users.json'), '[{"username":"kept"}]\n');
  await writeFile(path.join(out, 'app/stale.apx'), 'stale');
  buildWebapp({ sourceDir: app, out, runtimeDir });
  assert.equal(await readFile(path.join(out, 'config/users.json'), 'utf8'), '[{"username":"kept"}]\n');
  assert.equal(existsSync(path.join(out, 'app/stale.apx')), false);
  assert.equal(await readFile(path.join(out, 'build-manifest.json'), 'utf8'), manifest);

  // Refusals: a foreign non-empty folder, an output inside the sources, PL/SQL sign-in without a function.
  const foreign = await mkdtemp(path.join(tmpdir(), 'apexrest-foreign-'));
  t.after(() => rm(foreign, { recursive: true, force: true }));
  await writeFile(path.join(foreign, 'notes.txt'), 'mine');
  assert.throws(() => buildWebapp({ sourceDir: app, out: foreign, runtimeDir }), {
    code: 'WEBAPP_OUTPUT_NOT_EMPTY',
  });
  assert.throws(() => buildWebapp({ sourceDir: app, out: path.join(app, 'out'), runtimeDir }), {
    code: 'WEBAPP_OUTPUT_INVALID',
  });
  assert.throws(() => buildWebapp({ sourceDir: app, out: path.join(root, 'x'), runtimeDir, auth: 'plsql' }), {
    code: 'INVALID_INPUT',
  });
  assert.throws(() => buildWebapp({ sourceDir: app, out: path.join(root, 'y'), runtimeDir: root }), {
    code: 'WEBAPP_RUNTIME_MISSING',
  });
});

test('password hashes verify only the right password', () => {
  const hash = hashPassword('correct horse');
  assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/u);
  assert.equal(verifyPassword('correct horse', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
  assert.equal(verifyPassword('correct horse', 'plain'), false);
  assert.notEqual(hashPassword('correct horse'), hash, 'every hash has its own salt');
});

test('application mode requires sign-in, enforces authorization and serves no developer tools', async (t) => {
  const { app, assets } = await workspace(t, FILES);
  const users: Record<string, { password: string; roles: string[] }> = {
    ADA: { password: 'pw-admin', roles: ['ADMINISTRATOR'] },
    BOB: { password: 'pw-user', roles: [] },
  };
  const server = new PreviewServer({
    sourceDir: app,
    assetsDir: assets,
    database: ':memory:',
    toolbar: false,
    application: {
      authenticate: (username, password) => {
        const user = users[username.toUpperCase()];
        return user && user.password === password ? { roles: user.roles } : undefined;
      },
      publicHosts: ['apps.example.com'],
    },
  });
  await server.start();
  t.after(() => server.stop());
  let cookie = '';
  const call = async (target: string, init: RequestInit = {}) => {
    const response = await fetch(server.url + target, {
      redirect: 'manual',
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), ...(cookie ? { cookie } : {}) },
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    return response;
  };
  const signIn = (username: string, password: string) =>
    call('/r/demo/__login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }).toString(),
    });

  // Signed out: only public pages; everything else goes to sign-in or is refused.
  assert.equal((await call('/healthz')).status, 200);
  const anonymous = await call('/r/demo/1');
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get('location'), '/r/demo/__login');
  assert.match(await (await call('/r/demo/welcome')).text(), /id="welcome-body"/u);
  assert.equal((await call('/r/demo/__apex/region?page=1&region=tasks')).status, 401);
  const submit = await call('/r/demo/wwv_flow.accept', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ p_flow_step_id: '1', p_request: 'ADD', p_json: '{}' }).toString(),
  });
  assert.equal(submit.status, 401);
  assert.match(await (await call('/r/demo/__login')).text(), /<form method="post"/u);

  // A wrong password stays signed out; five failures lock nothing here (the lock is the webapp's).
  assert.equal((await signIn('bob', 'nope')).status, 401);
  assert.equal((await call('/r/demo/1')).status, 302);

  // Sign-in issues a new session id.
  const before = cookie;
  assert.equal((await signIn('bob', 'pw-user')).status, 302);
  assert.notEqual(cookie, before);
  const home = await (await call('/r/demo/1')).text();
  assert.match(home, /Design review/u);
  assert.doesNotMatch(home, /apex-local-toolbar/u, 'no developer toolbar');

  // Authorization is enforced: Bob has no role, Ada is an administrator.
  const denied = await (await call('/r/demo/admin')).text();
  assert.match(denied, /Administrators only/u);
  assert.doesNotMatch(denied, /id="admin-body"/u);

  // Developer routes and endpoints do not exist in application mode.
  for (const route of ['session-state', 'view-as', 'reset-data', 'debug-log', 'outbox'])
    assert.equal((await call(`/r/demo/__apex/x/${route}`)).status, 404, route);
  assert.equal((await call('/r/demo/__apex/diagnostics')).status, 404);
  assert.equal((await call('/r/demo/no-such-page')).status, 404);
  assert.doesNotMatch(await (await call('/r/demo/no-such-page')).text(), /href=/u);

  // Sign-out ends the session.
  assert.equal((await call('/r/demo/__logout')).status, 302);
  assert.equal((await call('/r/demo/1')).status, 302);
  assert.equal((await signIn('ada', 'pw-admin')).status, 302);
  assert.match(await (await call('/r/demo/admin')).text(), /id="admin-body"/u);

  // Host names: the published name is accepted (also over HTTPS for state changes); others are refused.
  const address = new URL(server.url);
  const raw = (host: string, origin?: string) =>
    new Promise<number>((resolve, reject) => {
      import('node:http').then(({ request }) => {
        const outgoing = request(
          {
            host: address.hostname,
            port: address.port,
            path: '/r/demo/welcome',
            method: origin ? 'POST' : 'GET',
            headers: { host, ...(origin ? { origin } : {}) },
          },
          (incoming) => {
            incoming.resume();
            resolve(incoming.statusCode ?? 0);
          },
        );
        outgoing.on('error', reject);
        outgoing.end();
      }, reject);
    });
  assert.equal(await raw('apps.example.com'), 200);
  assert.equal(await raw('evil.example.org'), 403);
  assert.notEqual(await raw('apps.example.com', 'https://apps.example.com'), 403);
  assert.equal(await raw('apps.example.com', 'https://evil.example.org'), 403);
});
