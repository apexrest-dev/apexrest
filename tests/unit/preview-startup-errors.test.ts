import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { previewCheck } from '../../packages/core/src/preview/service.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import type { Session } from '../../packages/core/src/preview/render.ts';
import { workspace } from '../fixtures/preview.ts';

const code = (body: string) =>
  `    source {\n        plsqlCode:\n            \`\`\`plsql\n${body
    .split('\n')
    .map((line) => `            ${line}`)
    .join('\n')}\n            \`\`\`\n    }\n`;
function process(
  kind: 'appProcess' | 'process',
  id: string,
  body: string,
  sequence = 10,
  point = 'beforeHeader',
  extra = '',
) {
  return `${kind} ${id} (\n    name: ${id}\n    type: executeCode\n${code(body)}    execution {\n        sequence: ${sequence}\n        point: ${point}\n    }\n${extra}\n)\n`;
}
const seed = (name: string) => `if not apex_collection.collection_exists(p_collection_name => '${name}') then
    apex_collection.create_collection(p_collection_name => '${name}');
    apex_collection.add_member(p_collection_name => '${name}', p_c001 => 'seed');
end if;`;
const PAGE = `page 1 (
    name: Startup
    title: Startup
    region content (
        name: Content
        type: plSqlDynamicContent
        source {
            plsqlCode: :REGION_WORK := nvl(:REGION_WORK, 0) + 1; htp.p('<p>REGION_MARKER</p>');
        }
        layout {
            sequence: 10
            slot: body
        }
    )
${process('process', 'page-later', ':PAGE_WORK := nvl(:PAGE_WORK, 0) + 1;', 20)}
)
`;
const state = (id = 'target'): Session => ({ id, user: 'DEVELOPER', items: {}, pagination: {} });
async function fixture(t: Parameters<typeof workspace>[0], applicationProcesses: string, page = PAGE) {
  const f = await workspace(t);
  await rm(f.app, { recursive: true, force: true });
  await mkdir(f.app, { recursive: true });
  await writeFile(
    path.join(f.app, 'application.apx'),
    `app demo (\n    name: Demo\n)\n${applicationProcesses}${page}`,
  );
  return {
    ...f,
    open: () => new PreviewServer({ sourceDir: f.app, assetsDir: f.assets, database: ':memory:' }),
  };
}
const collectionCount = (server: PreviewServer, sessionId: string) =>
  Number(
    server.db.db
      .prepare('select count(*) as n from apex_local_collections where session_id = ?')
      .get(sessionId)?.n ?? 0,
  );

test('normal preview check reports initialization failure as error and valid initialization as clean', async (t) => {
  for (const failure of [false, true]) {
    const f = await fixture(
      t,
      process(
        'appProcess',
        'initialize',
        failure ? "raise_application_error(-20001, 'INIT FAILED');" : ':INITIALIZED := 1;',
      ),
    );
    const check = await previewCheck(f.app, { sourceDir: f.app, assetsDir: f.assets });
    assert.equal(check.pages.length, 1);
    if (failure) {
      assert.ok(check.counts.error > 0);
      assert.match(check.pages[0]!.error!, /INIT FAILED/u);
      assert.equal(check.pages[0]!.bytes, 0);
    } else {
      assert.equal(check.counts.error, 0);
      assert.equal(check.pages[0]!.error, undefined);
      assert.ok(check.pages[0]!.bytes > 0);
    }
  }
});

test('failed first initialization rolls back collections and session values, then retries from the prior state', async (t) => {
  const init = `${seed('RETRY_DATA')}\n:SEEDED := 'Y';\nif :FAIL = 'Y' then\n    raise_application_error(-20001, 'INIT FAILED');\nend if;`;
  const f = await fixture(
    t,
    process('appProcess', 'initialize', init) + process('appProcess', 'app-later', ':APP_LATER := 1;', 20),
  );
  const server = f.open();
  try {
    const session = state();
    session.items = { FAIL: 'Y', EXISTING: 'keep' };
    const before = structuredClone(session);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.throws(() => server.renderer.prepare(session, '1'), /INIT FAILED/u);
      assert.deepEqual(session, before);
      assert.equal(collectionCount(server, session.id), 0);
      assert.equal(session.items.APP_LATER, undefined);
      assert.equal(session.items.PAGE_WORK, undefined);
      assert.equal(session.items.REGION_WORK, undefined);
    }
    session.items.FAIL = 'N';
    const ctx = server.renderer.prepare(session, '1');
    assert.equal(collectionCount(server, session.id), 1);
    assert.equal(session.items.SEEDED, 'Y');
    assert.equal(session.items.APP_LATER, '1');
    assert.equal(session.items.PAGE_WORK, '1');
    assert.match(server.renderer.renderPage(ctx), /REGION_MARKER/u);
    assert.equal(session.items.REGION_WORK, '1');
  } finally {
    server.db.close();
  }
});

test('startup rollback covers earlier successful units and preserves another completed session', async (t) => {
  const init = process('appProcess', 'first', seed('FIRST_DATA') + "\n:SENTINEL := 'Y';");
  const fail = process(
    'appProcess',
    'second',
    "if :FAIL = 'Y' then\n    raise_application_error(-20001, 'SECOND FAILED');\nend if;",
    20,
  );
  const f = await fixture(t, init + fail);
  const server = f.open();
  try {
    const other = state('other');
    server.renderer.prepare(other, '1');
    assert.equal(collectionCount(server, other.id), 1);
    const target = state();
    target.items.FAIL = 'Y';
    assert.throws(() => server.renderer.prepare(target, '1'), /SECOND FAILED/u);
    assert.equal(collectionCount(server, target.id), 0);
    assert.equal(target.items.SENTINEL, undefined);
    assert.equal(collectionCount(server, other.id), 1);
    target.items.FAIL = 'N';
    server.renderer.prepare(target, '1');
    assert.equal(collectionCount(server, target.id), 1);
    assert.equal(collectionCount(server, other.id), 1);
  } finally {
    server.db.close();
  }
});

test('a failed page before-header unit stops later page and region work and rolls back earlier startup work', async (t) => {
  const brokenPage = PAGE.replace(
    '    region content (',
    process('process', 'page-fails', "raise_application_error(-20001, 'PAGE INIT FAILED');") +
      '    region content (',
  );
  const f = await fixture(t, process('appProcess', 'initialize', seed('PAGE_DATA')), brokenPage);
  const server = f.open();
  try {
    const session = state();
    assert.throws(() => server.renderer.prepare(session, '1'), /PAGE INIT FAILED/u);
    assert.equal(session.items.PAGE_WORK, undefined);
    assert.equal(session.items.REGION_WORK, undefined);
    assert.equal(collectionCount(server, session.id), 0);
  } finally {
    server.db.close();
  }
});

test('unsupported startup remains an explicit limitation and handled PL/SQL exceptions remain successful', async (t) => {
  const variants = [
    process('appProcess', 'unsupported', ':UNUSED := 1;').replace(
      '    source {',
      '    source {\n        language: javascript',
    ),
    process(
      'appProcess',
      'handled',
      "begin\n    raise_application_error(-20001, 'HANDLED');\nexception when others then\n    :HANDLED := 1;\nend;",
    ),
  ];
  for (const [i, appProcess] of variants.entries()) {
    const f = await fixture(t, appProcess);
    const check = await previewCheck(f.app, { sourceDir: f.app, assetsDir: f.assets });
    assert.equal(check.counts.error, 0);
    if (i === 0)
      assert.ok(check.diagnostics.some((d) => d.level === 'info' && /not simulated/u.test(d.message)));
    const server = f.open();
    try {
      const session = state();
      server.renderer.prepare(session, '1');
      assert.equal(session.items.PAGE_WORK, '1');
      if (i === 0) assert.equal(session.items.UNUSED, undefined);
      else assert.equal(session.items.HANDLED, '1');
    } finally {
      server.db.close();
    }
  }
});

test('POST validation and apex_error results retain normal error arrays and a prior POST error is not a fatal GET', async (t) => {
  const validation = `validation input (
    name: Input
    validation {
        type: functionBodyReturningBoolean
        plsqlFunctionBody: return :P1_VALUE = 'OK';
    }
    execution {
        sequence: 10
    }
    error {
        errorMessage: FIX INPUT
    }
)
`;
  const addError = process(
    'process',
    'submit-error',
    "apex_error.add_error(p_message => 'POST MESSAGE', p_display_location => 'INLINE_IN_NOTIFICATION');",
    10,
    'processing',
    '    serverSideCondition {\n        type: request=value\n        value: ADD_ERROR\n    }',
  );
  const save = process('process', 'save', ':SAVED := nvl(:SAVED, 0) + 1;', 20, 'processing');
  const page = PAGE.replace('    region content (', validation + addError + save + '    region content (');
  const f = await fixture(t, process('appProcess', 'initialize', ':READY := 1;'), page);
  const server = f.open();
  try {
    const session = state();
    let result: ReturnType<typeof server.renderer.accept>;
    assert.doesNotThrow(() => {
      result = server.renderer.accept(session, '1', 'SAVE', { P1_VALUE: 'bad' });
    });
    assert.match(result!.errors![0]!.message, /FIX INPUT/u);
    assert.equal(session.items.SAVED, undefined);
    assert.doesNotThrow(() => {
      result = server.renderer.accept(session, '1', 'ADD_ERROR', { P1_VALUE: 'OK' });
    });
    assert.match(result!.errors![0]!.message, /POST MESSAGE/u);
    assert.equal(session.items.SAVED, undefined);
    result = server.renderer.accept(session, '1', 'SAVE', { P1_VALUE: 'OK' });
    assert.equal(result.errors?.length ?? 0, 0);
    assert.equal(session.items.SAVED, '1');
    session.errors = [{ type: 'error', message: 'PRIOR POST ERROR', location: ['page'], unsafe: false }];
    const ctx = server.renderer.prepare(session, '1');
    assert.match(server.renderer.renderPage(ctx), /PRIOR POST ERROR/u);
    assert.equal(server.diagnostics().filter((d) => d.level === 'error').length, 0);
  } finally {
    server.db.close();
  }
});
