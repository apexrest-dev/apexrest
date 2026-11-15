import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApplication, str } from '../preview/apexlang.ts';
import { defaultAssetsDir } from '../preview/assets.ts';
import { Fault } from '../result.ts';
import { VERSION } from '../version.ts';
import type { WebappAuth, WebappConfig } from './server.ts';

/**
 * `apexrest build webapp`: writes a standalone Node.js application for an APEXlang application.
 *
 * The output holds the APEXlang sources, the web application runtime (the plug-in's renderer and
 * Oracle driver as plain JavaScript), a start script and configuration. It depends on
 * node-oracledb only. The build writes files; it never connects to a database, and the built
 * application reads its connection from its own environment when it starts.
 */
export interface BuildWebappInput {
  /** Folder that contains application.apx. */
  sourceDir: string;
  /** Output folder: new, empty, or a previous build of this command. */
  out: string;
  auth?: WebappAuth['type'];
  authFunction?: string;
  /** Copy the locally extracted APEX browser files into the output. */
  includeAssets?: boolean;
  assetsDir?: string;
  /** Folder with `webapp.mjs` and its chunks; defaults to the running plug-in runtime. */
  runtimeDir?: string;
}

const MANIFEST = 'build-manifest.json';
const ENTRIES = ['webapp.mjs', 'webapp-driver-worker.mjs'];

function runtimeFiles(directory: string): string[] {
  const files = new Set<string>();
  const visit = (name: string) => {
    if (files.has(name)) return;
    const file = path.join(directory, name);
    if (!fs.existsSync(file))
      throw new Fault(
        'WEBAPP_RUNTIME_MISSING',
        `The web application runtime (${name}) is not in ${directory}. Use the built plug-in runtime (npm run build).`,
        3,
      );
    files.add(name);
    // Chunks are referenced by relative path, statically or through import().
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/["']\.\/([\w.-]+\.mjs)["']/gu))
      visit(match[1]!);
  };
  for (const entry of ENTRIES) visit(entry);
  return [...files].sort();
}

function copyTree(
  from: string,
  to: string,
  skip: (relative: string) => boolean,
  checksums?: Record<string, string>,
): number {
  let count = 0;
  const visit = (relative: string) => {
    for (const entry of fs.readdirSync(path.join(from, relative), { withFileTypes: true })) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (skip(next)) continue;
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) {
        const target = path.join(to, next);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(from, next), target);
        if (checksums) checksums[next] = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
        count += 1;
      }
    }
  };
  visit('');
  return count;
}

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

function readme(name: string, alias: string, auth: WebappAuth, assets: boolean): string {
  return `# ${name}

A Node.js web application built from APEXlang sources with \`apexrest build webapp\`. It renders the
application's pages with Universal Theme and runs their SQL and PL/SQL in your Oracle database.

## Run

\`\`\`sh
npm install
cp .env.example .env      # set the Oracle connection
npm start                 # http://127.0.0.1:8080/r/${alias}
\`\`\`

Node.js 24 or later is required. The database user must be able to read and change the
application's tables; set \`schema\` in \`config/default.json\` when another schema owns them.

## APEX browser files

${
  assets
    ? 'The APEX JavaScript, CSS, fonts and Universal Theme in `apex-assets/` were copied from the APEX distribution on the build machine. They are Oracle software: you are responsible for having the right to use and distribute them.'
    : 'The APEX JavaScript, CSS, fonts and Universal Theme are not part of this build. Extract them from your own APEX 26.2 download with `apexrest preview setup` and set `APEX_ASSETS_DIR` (or `assetsDir` in `config/default.json`) to that folder. They are Oracle software: you are responsible for having the right to use them.'
}

## Sign-in

\`auth.type\` in \`config/default.json\` is \`${auth.type}\`:

- \`users\`: accounts in \`config/users.json\` (\`[{ "username": "...", "password": "<hash>", "roles": [] }]\`).
  Create a hash with \`node server.mjs hash-password <password>\`.
- \`plsql\`: \`auth.function\` names a database function \`f(p_username, p_password) return boolean\`.
- \`database\`: Oracle database accounts.
- \`open\`: no password. Only for a closed test network.

Roles decide "is in role" authorization schemes and \`apex_acl\` checks: list them per user (\`users\`)
or set \`auth.rolesQuery\`, a query that returns the role static IDs of \`:APP_USER\`.

Pages need a signed-in session unless their authentication is "Page Is Public". Authorization
schemes are enforced; a scheme type the runtime cannot evaluate allows access and is not a
substitute for checks in your database code.

## Deploy

- Put the application behind HTTPS and set \`publicHosts\` (or \`PUBLIC_HOSTS\`) to the names it is
  reached by, and \`secureCookies: true\`. Requests for other host names are refused.
- \`HOST=0.0.0.0\` listens on all interfaces (the Dockerfile sets it). \`GET /healthz\` answers \`ok\`.
- One process handles one request at a time and keeps sessions in memory: signed-in users are
  signed out by a restart, and a second process does not share sessions.

## Limits

- Session state protection (URL checksums) is not implemented: do not rely on hidden or
  read-only items for security; check values in your database code.
- Charts are drawn as SVG, not Oracle JET. The rich text editor is a simple stand-in.
- Workflows, generative AI, push notifications and dynamic action or process plug-ins do not run.
- Uploaded files, collections and e-mail stay in the server's memory; e-mail is not sent.
- With APEX installed in the database and \`applicationId\` set, database code gets an APEX
  session (\`v()\`, \`apex_util\`). Without it, \`v()\` returns NULL inside packages; page items reach
  PL/SQL as bind variables.

Rebuild with \`apexrest build webapp\` after changing the APEXlang sources; \`config/\` and \`.env\`
are kept.
`;
}

export function buildWebapp(input: BuildWebappInput) {
  const sourceDir = path.resolve(input.sourceDir);
  const out = path.resolve(input.out);
  // Parsing is the build's own check; the Oracle compiler remains the authority on the sources.
  const app = loadApplication(sourceDir);
  const alias = (app.app.id || 'app').toLowerCase().replace(/[^a-z0-9-]+/gu, '-');
  const name = str(app.app.props, 'name', app.app.id);
  if (out === sourceDir || out.startsWith(sourceDir + path.sep) || sourceDir.startsWith(out + path.sep))
    throw new Fault('WEBAPP_OUTPUT_INVALID', 'The output folder must be outside the application sources.', 2);
  if (fs.existsSync(out)) {
    const entries = fs.readdirSync(out);
    if (entries.length && !entries.includes(MANIFEST))
      throw new Fault(
        'WEBAPP_OUTPUT_NOT_EMPTY',
        `${out} is not empty and was not written by apexrest build webapp. Choose a new folder.`,
        5,
        'conflict',
      );
  }
  const authType = input.auth ?? 'users';
  if (authType === 'plsql' && !/^[A-Za-z][\w$#]*(?:\.[A-Za-z][\w$#]*){0,2}$/u.test(input.authFunction ?? ''))
    throw new Fault(
      'INVALID_INPUT',
      'auth plsql needs --auth-function with a function name such as app_auth.authenticate.',
      2,
    );
  const auth: WebappAuth = {
    type: authType,
    ...(authType === 'plsql' ? { function: input.authFunction! } : {}),
    ...(authType === 'users' ? { usersFile: 'config/users.json' } : {}),
  };
  const runtimeDir = input.runtimeDir ?? path.dirname(fileURLToPath(import.meta.url));
  const runtime = runtimeFiles(runtimeDir);

  // Generated parts are replaced; configuration and credentials of an earlier build are kept.
  for (const generated of ['app', 'runtime'])
    fs.rmSync(path.join(out, generated), { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const sources: Record<string, string> = {};
  const hidden = (relative: string) =>
    relative.split('/').some((part) => part.startsWith('.') && part !== '.apex');
  const sourceCount = copyTree(sourceDir, path.join(out, 'app'), hidden, sources);
  for (const file of runtime) {
    fs.mkdirSync(path.join(out, 'runtime'), { recursive: true });
    fs.copyFileSync(path.join(runtimeDir, file), path.join(out, 'runtime', file));
  }
  let assets = false;
  if (input.includeAssets) {
    const from = path.resolve(input.assetsDir ?? defaultAssetsDir());
    if (!fs.existsSync(path.join(from, 'manifest.json')))
      throw new Fault(
        'PREVIEW_ASSETS_MISSING',
        `The APEX browser files are not in ${from}. Run apexrest preview setup first.`,
        3,
      );
    fs.rmSync(path.join(out, 'apex-assets'), { recursive: true, force: true });
    copyTree(from, path.join(out, 'apex-assets'), () => false);
    assets = true;
  }

  const keep = (file: string, content: string) => {
    if (!fs.existsSync(path.join(out, file))) write(path.join(out, file), content);
  };
  const config: WebappConfig = {
    host: '127.0.0.1',
    port: 8080,
    publicHosts: [],
    secureCookies: false,
    sessionTimeoutMinutes: 480,
    assetsDir: 'apex-assets',
    auth,
  };
  keep('config/default.json', `${JSON.stringify(config, null, 2)}\n`);
  if (authType === 'users') keep('config/users.json', '[]\n');
  keep(
    '.env.example',
    'ORACLE_USER=\nORACLE_PASSWORD=\nORACLE_CONNECT_STRING=localhost:1521/freepdb1\n# PORT=8080\n# HOST=127.0.0.1\n# PUBLIC_HOSTS=apps.example.com\n# APEX_ASSETS_DIR=/path/to/apex-assets\n',
  );
  keep('.gitignore', 'node_modules/\n.env\nconfig/users.json\n');
  write(
    path.join(out, 'package.json'),
    `${JSON.stringify(
      {
        name: alias,
        version: '1.0.0',
        private: true,
        type: 'module',
        description: `${name}: built from APEXlang with apexrest build webapp`,
        engines: { node: '>=24' },
        scripts: { start: 'node server.mjs' },
        dependencies: { oracledb: '^6.10.0' },
      },
      null,
      2,
    )}\n`,
  );
  write(
    path.join(out, 'server.mjs'),
    `// Generated by apexrest build webapp. Starts the application in this folder.\nimport { runWebapp } from './runtime/webapp.mjs';\n\nawait runWebapp(import.meta.dirname);\n`,
  );
  write(
    path.join(out, 'Dockerfile'),
    `FROM node:24-slim\nWORKDIR /app\nCOPY package.json ./\nRUN npm install --omit=dev\nCOPY . .\nENV HOST=0.0.0.0 PORT=8080\nEXPOSE 8080\nUSER node\nCMD ["node", "server.mjs"]\n`,
  );
  write(path.join(out, 'README.md'), readme(name, alias, auth, assets));
  const pages = [...app.pages.keys()].filter((id) => id !== '0').length;
  write(
    path.join(out, MANIFEST),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        builtBy: `apexrest ${VERSION}`,
        application: { alias, name, pages },
        auth: auth.type,
        assetsIncluded: assets,
        runtime,
        sources,
      },
      null,
      2,
    )}\n`,
  );
  return {
    out,
    application: { alias, name, pages },
    files: { sources: sourceCount, runtime: runtime.length },
    auth: auth.type,
    assetsIncluded: assets,
    url: `http://127.0.0.1:8080/r/${alias}`,
    nextActions: [
      `cd ${out} && npm install`,
      'Copy .env.example to .env and set the Oracle connection.',
      ...(assets
        ? []
        : [
            'Set APEX_ASSETS_DIR to the APEX browser files (apexrest preview setup), or rebuild with --include-assets.',
          ]),
      ...(authType === 'users'
        ? ['Add accounts to config/users.json (node server.mjs hash-password <password>).']
        : []),
      'npm start',
    ],
  };
}
