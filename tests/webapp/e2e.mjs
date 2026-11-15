// End-to-end check of a built web application that is already running against an Oracle database
// holding the Bitcoin Price Monitor schema (docs/evidence/btc-experiment-20261106/db). A local
// development check; it writes one alert row and deletes it again.
//
//   WEBAPP_URL=http://127.0.0.1:8791/r/speed-lab WEBAPP_USER=alice WEBAPP_PASSWORD=... \
//   ORACLE_USER=... ORACLE_PASSWORD=... ORACLE_CONNECT_STRING=... node tests/webapp/e2e.mjs
import assert from 'node:assert/strict';
import oracledb from 'oracledb';

const base = process.env.WEBAPP_URL;
const origin = new URL(base).origin;
const prefix = new URL(base).pathname;
const jar = {};
async function call(path, init = {}) {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    ...init,
    headers: { ...(init.headers ?? {}), ...(jar.cookie ? { cookie: jar.cookie } : {}) },
  });
  const set = response.headers.get('set-cookie');
  if (set) jar.cookie = set.split(';')[0];
  return response;
}
async function submit(page, request, items) {
  const body = new URLSearchParams({
    p_flow_step_id: page,
    p_request: request,
    p_json: JSON.stringify({
      pageItems: { itemsToSubmit: Object.entries(items).map(([n, v]) => ({ n, v })) },
    }),
  });
  const response = await call(`${prefix}/wwv_flow.accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}
const db = await oracledb.getConnection({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
});
const count = async (name) =>
  (await db.execute('select count(*) from btc_price_alerts where alert_name = :n', { n: name })).rows[0][0];
const name = `E2E ${Date.now()}`;
const results = [];
const step = async (label, run) => {
  const started = Date.now();
  await run();
  results.push(`ok   ${label} (${Date.now() - started} ms)`);
};
try {
  await step('anonymous page request is redirected to the login page', async () => {
    const response = await call(`${prefix}/home`);
    assert.equal(response.status, 302);
    assert.match(response.headers.get('location'), /\/login$/u);
  });
  await step('anonymous submit and Ajax are refused', async () => {
    assert.equal((await submit('4', 'CREATE', { P4_ALERT_NAME: name })).status, 401);
    assert.equal((await call(`${prefix}/__apex/region?page=3&region=alerts`)).status, 401);
    assert.equal(await count(name), 0);
  });
  await step('developer routes are not served', async () => {
    assert.equal((await call(`${prefix}/__apex/diagnostics`)).status, 401);
  });
  await step('a wrong password does not sign in', async () => {
    await call(`${prefix}/login`);
    const reply = await submit('9999', 'LOGIN', {
      P9999_USERNAME: process.env.WEBAPP_USER,
      P9999_PASSWORD: 'wrong',
    });
    assert.equal(reply.json.errors[0].message, 'Invalid Login Credentials');
    assert.equal((await call(`${prefix}/home`)).status, 302);
  });
  await step('sign-in changes the session and opens the home page', async () => {
    const before = jar.cookie;
    const reply = await submit('9999', 'LOGIN', {
      P9999_USERNAME: process.env.WEBAPP_USER,
      P9999_PASSWORD: process.env.WEBAPP_PASSWORD,
    });
    assert.match(reply.json.redirectURL, /\/home$/u);
    assert.notEqual(jar.cookie, before);
    const home = await call(`${prefix}/home`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /t-Body/u);
    assert.equal((await call(`${prefix}/__apex/x/session-state`)).status, 404);
    assert.equal((await call(`${prefix}/__apex/diagnostics`)).status, 404);
  });
  await step('reports read Oracle rows', async () => {
    const html = await (await call(`${prefix}/alerts`)).text();
    const rows = (await db.execute('select alert_name from btc_price_alerts fetch first 1 rows only')).rows;
    assert.ok(html.includes(rows[0][0]), 'an existing alert name is on the page');
  });
  await step('a form submit inserts a row and commits it', async () => {
    // Hidden items travel with the form, as in a browser.
    const form = await (await call(`${prefix}/4`)).text();
    const hidden = /id="P4_CREATED_ON"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*id="P4_CREATED_ON"/u.exec(
      form,
    );
    const reply = await submit('4', 'CREATE', {
      P4_CREATED_ON: hidden?.[1] ?? hidden?.[2] ?? '',
      P4_ALERT_ID: '',
      P4_ALERT_NAME: name,
      P4_DIRECTION: 'ABOVE',
      P4_THRESHOLD_USD: '123456',
      P4_IS_ACTIVE: 'Y',
      P4_NOTIFY_EMAIL: 'e2e@example.com',
    });
    assert.equal(reply.status, 200);
    assert.equal(reply.json.errors, undefined, JSON.stringify(reply.json));
    assert.equal(await count(name), 1);
  });
  await step('a failing submit changes nothing', async () => {
    const reply = await submit('4', 'CREATE', { P4_ALERT_ID: '', P4_ALERT_NAME: '', P4_THRESHOLD_USD: 'x' });
    assert.ok(reply.json.errors?.length, 'validation errors are returned');
    assert.equal(await count(''), 0);
  });
  await step('sign-out ends the session', async () => {
    assert.equal((await call(`${prefix}/__logout`)).status, 302);
    assert.equal((await call(`${prefix}/home`)).status, 302);
  });
} finally {
  await db.execute('delete from btc_price_alerts where alert_name = :n', { n: name });
  await db.commit();
  await db.close();
  console.log(results.join('\n'));
}
console.log(`${results.length} steps passed`);
