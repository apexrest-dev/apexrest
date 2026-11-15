# Build a web application

`apexrest build webapp` turns an APEXlang application into a standalone Node.js web application. The application renders the pages with Universal Theme, runs their SQL and PL/SQL in your existing Oracle database through `node-oracledb`, and needs no APEX runtime or ORDS in front of it.

It is the [local preview](local-preview.md) renderer in application mode. What the preview renders, the built application renders; what the preview reports as not simulated, the built application does not do. It is not Oracle APEX, and a page that works here is not evidence of how it behaves on APEX.

## How it works

The build does not compile pages. It packages the sources with an interpreter:

- **Build.** `app/` receives the APEXlang source files unchanged. `runtime/` receives the plugin's renderer and its Oracle driver as plain JavaScript. No HTML or JavaScript is generated per page.
- **Start.** The runtime parses every source file into a tree of components (pages, regions, items, buttons, dynamic actions, processes), each with its type and properties. Page layout comes from Universal Theme's own templates, taken from Oracle's theme export in the APEX browser files.
- **Page request.** The server checks the session and the page's authorization scheme. The renderer walks the page's components; each region type has a handler that runs the region's SQL in Oracle with page items as bind variables and fills the theme templates. The answer is HTML plus a block of page configuration.
- **Submit.** The browser posts the page items to `wwv_flow.accept`, as on APEX. The server runs validations, computations and processes in page order, with PL/SQL and row saves in Oracle, then commits and answers with the next page, or rolls back and answers with the error messages.
- **Browser.** Oracle's own APEX JavaScript runs unchanged: interactive grid, popup LOV, date pickers, page submit, messages. A small runtime script from the plugin reads the page configuration, binds the dynamic actions, refreshes regions and sends server calls to the built application.
- **Threads.** The renderer runs in one thread. The Oracle connection lives in a worker thread, and the renderer waits for each answer.

## Convert an existing application

1. **Get the sources.** You need the APEXlang folder (`application.apx`, `pages/`, `shared-components/`). When the application exists only in APEX, export it first; see [existing applications](existing-app.md).
2. **Check them.** `apexrest preview check --source-dir /abs/app` renders every page and lists the features the renderer does not run.
3. **Get Oracle's browser files once.** `apexrest preview setup` extracts them from your own APEX 26.2 download.
4. **Build.** Pass the source folder or the project, `--include-assets`, and the sign-in type.
5. **Point it at the database.** Set the connection in `.env`. In `config/default.json`, set `schema` when another schema owns the tables, `auth.rolesQuery` for role-based authorization schemes, and `applicationId` when the application is also installed in APEX in that database.

```sh
apexrest preview setup
apexrest preview check --source-dir /abs/app
apexrest build webapp --source-dir /abs/app --out /abs/output --include-assets \
  --auth plsql --auth-function app_auth.check_login
```

Then start it, sign in and walk through the pages. After changing the sources, build again; `config/` and `.env` are kept.

## Build

```sh
apexrest build webapp --project /abs/project --out /abs/output
apexrest build webapp --source-dir /abs/app --out /abs/output --include-assets
```

| Option                                | Meaning                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `--out PATH`                          | Output folder: new, empty, or a previous build of this command                    |
| `--auth users\|plsql\|database\|open` | Sign-in of the built application; `users` by default                              |
| `--auth-function NAME`                | `plsql`: a database function `f(p_username, p_password) return boolean`           |
| `--include-assets`                    | Copy the locally extracted APEX browser files into the output                     |
| `--assets-dir PATH`                   | Where those files are; defaults to the preview's cache (`apexrest preview setup`) |

The build only writes files. It never connects to a database, and it refuses an output folder that is not empty unless an earlier build wrote it. A rebuild replaces `app/` and `runtime/` and keeps `config/` and `.env`; the same sources give a byte-identical `build-manifest.json`.

Output:

```
package.json          depends on oracledb only
server.mjs            starts the application
app/                  the APEXlang sources
runtime/              the renderer and the Oracle driver as plain JavaScript
config/default.json   port, host names, session timeout, sign-in
config/users.json     accounts for auth type users
.env.example          Oracle connection
Dockerfile, README.md, build-manifest.json
```

## Run

```sh
cd /abs/output
npm install
cp .env.example .env      # ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING
npm start                 # http://127.0.0.1:8080/r/<alias>
```

Node.js 24 or later is required. The database user must be able to read and change the application's tables; set `schema` in `config/default.json` when another schema owns them. Each HTTP request is one transaction: it is committed when the request succeeds and rolled back when page processing fails, and package state is reset between requests.

### APEX browser files

The APEX look comes from Oracle's own JavaScript, CSS, fonts and Universal Theme. They are Oracle software and are never part of this plugin. Either pass `--include-assets` to copy the files you extracted from your own APEX 26.2 download into the output, or set `APEX_ASSETS_DIR` on the server to such a folder. Whether you may use or distribute them outside an APEX installation depends on your Oracle license; the build records your choice in `build-manifest.json`.

### Sign-in and authorization

| `auth.type` | Accounts                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `users`     | `config/users.json`: `[{ "username", "password", "roles" }]`; hash a password with `node server.mjs hash-password <password>` |
| `plsql`     | `auth.function`, a database function `f(p_username, p_password) return boolean`                                               |
| `database`  | Oracle database accounts                                                                                                      |
| `open`      | Any name without a password; only for a closed test network                                                                   |

A page needs a signed-in session unless its authentication is "Page Is Public". The application's login page is used when it has one, otherwise a built-in form. Sign-in issues a new session id, five failed attempts lock a user name for a minute, and an idle session ends after `sessionTimeoutMinutes`.

Authorization schemes are enforced on pages and components. Roles decide "is in role" schemes and `apex_acl` checks: list them per user (`users`) or set `auth.rolesQuery`, a query that returns the role static IDs of `:APP_USER`. PL/SQL and SQL schemes run in Oracle. A scheme type the runtime cannot evaluate allows access.

### Deployment

- Put the application behind HTTPS, set `publicHosts` (or `PUBLIC_HOSTS`) to the host names it is reached by and `secureCookies: true`. Requests for other host names and cross-origin state changes are refused.
- `HOST=0.0.0.0` listens on all interfaces (the Dockerfile sets it). `GET /healthz` answers `ok` without a database call.
- The developer toolbar, session-state editor, "view as", diagnostics endpoint, hot reload and live socket of the preview do not exist in a built application, and errors shown to users carry no internal detail.

## What works

Everything the local preview supports in [connected mode](local-preview.md#connected-oracle-mode), without its SQLcl limits: reports, interactive grids with saves, forms, charts (SVG), cards, faceted search, trees, calendars, maps, page items, dynamic actions, validations, computations, processes and branches, with region SQL and PL/SQL running untranslated in Oracle. CLOB values and HTP output have no 32 KB limit.

When the application declares an error handling function and the database has the APEX error API (`apex_error`), an error that carries an ORA code is passed to that function in Oracle and its message is shown, as APEX does. Without the function or the API, the user sees the database error text, including its `ORA-06512` lines.

With APEX installed in the database and `applicationId` set in `config/default.json` (the application imported there), database code gets an APEX session, so `v()` and `apex_util` work inside packages. Without it, page items reach PL/SQL as bind variables and `v()` returns NULL in stored code.

## Limits

- **Session state protection is not implemented.** URL checksums and item-level restrictions do not exist. Do not rely on hidden or read-only items for security; check values in database code.
- **One request at a time.** One process handles requests one after another and keeps sessions in memory: a restart signs users out, and a second process does not share sessions.
- **Not Oracle JET.** Charts are drawn as SVG; the rich text editor is a simple stand-in.
- **Not run.** Workflows, generative AI, push notifications, dynamic action and process plug-ins, report subscriptions.
- **The web user is not visible to database code without an APEX session.** `sys_context('APEX$SESSION', 'APP_USER')` is empty there, so audit columns and menus that database code derives from the APEX user see the database account.
- **One session cookie name.** Two built applications reached under the same host name overwrite each other's session, even on different ports. Serve each under its own host name.
- **A denied page answers HTTP 200** with the scheme's error message, as the preview does.
- **Kept in memory.** Uploaded files, collections and e-mail; e-mail is not sent. BLOB columns are not served from Oracle.
- **DDL from page components is refused**; PL/SQL may still run it.

## Verification

Checked on 2026-11-15 on local Docker (database 23.26.3, APEX 26.2 installed, a schema without an APEX workspace):

- A built application (Bitcoin Price Monitor, six pages) started from a clean environment with `npm install` and `npm start`. `tests/webapp/e2e.mjs` passed nine steps: anonymous requests redirected or refused, a wrong password refused, sign-in with a new session id, reports reading Oracle rows, a form insert committed (read back on a separate connection), a failing submit changing nothing, and sign-out.
- Three Oracle sample applications with their own install scripts loaded into the schema, every page rendered through the driver: Sample Dynamic Actions 27 pages and Sample Charts 49 pages without a failure; Customers 126 pages without a page error and 37 failing statements, mostly tables missing after a partly failed script run.
- A 119-page trading application (Trade: 106 tables, 70 views, 37 packages, 217 triggers, its own Theme Roller style) built in 0.4 s and run against a schema without an APEX workspace. A scripted session in headless Chromium passed 23 steps without a JavaScript error or a failed request: sign-in and a refused password, a tree-filtered report, six report pages, a dialog form whose trigger error was worded by the application's error handling function and wrote nothing, a committed row, a goods receipt saved through popup LOVs and an interactive grid, posted and unposted with the stock register read back on a separate connection, a PL/SQL print form, and sign-out. All 118 pages answered for five accounts: the administrator opened every page, the four role accounts were denied 40 to 55 pages each by "is in role" schemes. Server time per page for the administrator: median 18 ms, slowest 90 ms.
- The same application in a generated English variant with the standard Iris theme style, in its own schema, passed the same 23 steps.
- Unit tests cover the build output and its refusals, password hashing, and application mode (sign-in, public pages, enforced roles, closed developer routes, host names) without a database.

Not checked: a person using a browser, a comparison with the same pages on APEX, concurrent users, a remote database, HTTPS behind a proxy, `plsql` and `database` sign-in against real accounts, an APEX session with an imported application. Next steps are in [next actions](next-actions.md).
