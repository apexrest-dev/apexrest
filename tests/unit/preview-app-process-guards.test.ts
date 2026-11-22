import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { previewCheck } from '../../packages/core/src/preview/service.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import type { Session } from '../../packages/core/src/preview/render.ts';
import { workspace } from '../fixtures/preview.ts';

const block = (code: string) =>
  `    source {\n        plsqlCode:\n            \`\`\`plsql\n${code
    .split('\n')
    .map((line) => `            ${line}`)
    .join('\n')}\n            \`\`\`\n    }\n`;
const process = (code: string, extra = '', type = 'executeCode') =>
  `appProcess initialize (\n    name: Initialize\n    type: ${type}\n${block(code)}    execution {\n        point: beforeHeader\n        sequence: 10\n    }\n${extra}\n)\n`;
const PAGE = `page 1 (
    name: Home
    title: Home
    region content (
        name: Content
        type: staticContent
        source {
            htmlCode: <p>Home</p>
        }
        layout {
            sequence: 10
            slot: body
        }
    )
    process page-work (
        name: Page work
        type: executeCode
        source {
            plsqlCode: :PAGE_COUNT := nvl(:PAGE_COUNT, 0) + 1;
        }
        execution {
            point: beforeHeader
            sequence: 10
        }
    )
)
`;
const SEED = `begin
    :APP_COUNT := nvl(:APP_COUNT, 0) + 1;
    if not apex_collection.collection_exists(p_collection_name => 'SHARED_DATA') then
        apex_collection.create_collection(p_collection_name => 'SHARED_DATA');
        apex_collection.add_member(p_collection_name => 'SHARED_DATA', p_c001 => 'seed');
    end if;
end;`;
const dataPage = (id: number) =>
  PAGE.replace('page 1 (', `page ${id} (`)
    .replace('htmlCode: <p>Home</p>', 'htmlCode: <p>Data</p>')
    .replace(
      '    process page-work (',
      `    pageItem P${id}_EDIT (
        type: hidden
        layout {
            sequence: 20
            region: @content
            slot: regionBody
        }
    )
    process save-edit (
        name: Save edit
        type: executeCode
${block(`apex_collection.update_member_attribute(p_collection_name => 'SHARED_DATA', p_seq => 1, p_attr_number => 1, p_attr_value => :P${id}_EDIT);`)}        execution {
            sequence: 20
        }
        serverSideCondition {
            type: request=value
            value: SAVE
        }
    )
    process page-work (`,
    )
    .replace(
      ':PAGE_COUNT := nvl(:PAGE_COUNT, 0) + 1;',
      ":PAGE_COUNT := nvl(:PAGE_COUNT, 0) + 1; select c001 into :PAGE_VALUE from apex_collections where collection_name = 'SHARED_DATA';",
    );
const session = (): Session => ({ id: 'test', user: 'DEVELOPER', items: {}, pagination: {} });
async function fixture(
  t: Parameters<typeof workspace>[0],
  code: string,
  shared = '',
  pages = PAGE,
  nested = false,
) {
  const result = await workspace(t);
  await rm(result.app, { recursive: true, force: true });
  await mkdir(result.app, { recursive: true });
  const source = `app demo (\n    name: Demo\n${nested ? code : ''})\n${nested ? '' : code}${shared}${pages}`;
  await writeFile(path.join(result.app, 'application.apx'), source);
  const open = () =>
    new PreviewServer({ sourceDir: result.app, assetsDir: result.assets, database: ':memory:' });
  return { ...result, source, open };
}
const guard = (kind: 'security' | 'config', property: string, id: string) =>
  `    ${kind} {\n        ${property}: @${id}\n    }`;
const buildOption = (status: 'include' | 'exclude') =>
  `buildOption feature (\n    name: Feature\n    status {\n        status: ${status}\n    }\n)\n`;
const DENY = `authorization deny (\n    name: Deny\n    type: plsqlFunctionBody\n    settings {\n        plsqlFunctionBody: return false;\n    }\n)\n`;

test('shared initialization runs once before page work and preserves guarded collection edits across pages', async (t) => {
  for (const nested of [false, true]) {
    const f = await fixture(t, process(SEED), '', dataPage(1) + dataPage(2), nested);
    const check = await previewCheck(f.app, { sourceDir: f.app, assetsDir: f.assets });
    assert.deepEqual(
      check.pages.map((page) => page.id),
      ['1', '2'],
    );
    assert.equal(check.counts.error, 0);
    const server = f.open();
    try {
      const state = session();
      server.renderer.prepare(state, '1');
      assert.equal(state.items.APP_COUNT, '1');
      assert.equal(state.items.PAGE_COUNT, '1');
      assert.equal(state.items.PAGE_VALUE, 'seed');
      assert.equal(server.renderer.accept(state, '1', 'SAVE', { P1_EDIT: 'edited' }).errors?.length ?? 0, 0);
      server.renderer.prepare(state, '2');
      assert.equal(state.items.APP_COUNT, '2');
      assert.equal(state.items.PAGE_COUNT, '2');
      assert.equal(state.items.PAGE_VALUE, 'edited');
    } finally {
      server.db.close();
    }
  }
});

test('application processes respect conditions and the existing permissive or enforcing authorization mode', async (t) => {
  for (const mode of ['never', 'permissive', 'enforcing'] as const) {
    const extra =
      mode === 'never'
        ? '    serverSideCondition {\n        type: never\n    }'
        : guard('security', 'authorizationScheme', 'deny');
    const f = await fixture(t, process(':FLAG := 1;', extra), DENY);
    const server = f.open();
    try {
      const state = session();
      if (mode === 'enforcing') state.viewAs = { roles: [], deny: ['deny'] };
      server.renderer.prepare(state, '1');
      assert.equal(state.items.FLAG, mode === 'permissive' ? '1' : undefined);
      assert.equal(state.items.PAGE_COUNT, '1');
      if (mode === 'permissive')
        assert.ok(server.diagnostics().some((d) => /allows access anyway/u.test(d.message)));
    } finally {
      server.db.close();
    }
  }
});

test('application build options respect source status and runtime overrides before evaluating process conditions', async (t) => {
  const extra =
    guard('config', 'buildOption', 'feature') +
    '\n    serverSideCondition {\n        type: functionBody\n        plsqlFunctionBody: :CONDITION_COUNT := nvl(:CONDITION_COUNT, 0) + 1; return true;\n    }';
  const pages = PAGE.replace(
    '    process page-work (',
    `    process enable-feature (
        name: Enable feature
        type: executeCode
${block("apex_util.set_build_option_status(p_application_id => 100, p_build_option_name => 'Feature', p_build_status => 'INCLUDE');")}        execution {\n            sequence: 10\n        }\n        serverSideCondition {\n            type: request=value\n            value: ENABLE\n        }\n    )\n    process page-work (`,
  );
  for (const status of ['include', 'exclude'] as const) {
    const f = await fixture(t, process(':FLAG := nvl(:FLAG, 0) + 1;', extra), buildOption(status), pages);
    const server = f.open();
    try {
      const state = session();
      server.renderer.prepare(state, '1');
      assert.equal(state.items.FLAG, status === 'include' ? '1' : undefined);
      assert.equal(state.items.CONDITION_COUNT, status === 'include' ? '1' : undefined);
      assert.equal(server.renderer.accept(state, '1', 'ENABLE', {}).errors?.length ?? 0, 0);
      server.renderer.prepare(state, '1');
      assert.equal(state.items.FLAG, status === 'include' ? '2' : '1');
    } finally {
      server.db.close();
    }
  }
});

test('unresolved build options skip explicitly, source edits are fresh, and existing execution errors stay visible', async (t) => {
  const f = await fixture(t, process(':FLAG := 1;', guard('config', 'buildOption', 'missing')));
  let server = f.open();
  try {
    const state = session();
    server.renderer.prepare(state, '1');
    assert.equal(state.items.FLAG, undefined);
    assert.ok(
      server
        .diagnostics()
        .some((d) => /build option missing could not be resolved; skipped/u.test(d.message)),
    );
  } finally {
    server.db.close();
  }
  await writeFile(
    path.join(f.app, 'application.apx'),
    f.source
      .replace(guard('config', 'buildOption', 'missing'), '')
      .replace(':FLAG := 1;', ":FLAG := 2; raise_application_error(-20001, 'EXPECTED INIT FAILURE');"),
  );
  server = f.open();
  try {
    const state = session();
    assert.throws(() => server.renderer.prepare(state, '1'), /EXPECTED INIT FAILURE/u);
    assert.equal(state.items.FLAG, undefined);
    assert.ok(
      server
        .diagnostics()
        .some((error) => error.level === 'error' && /EXPECTED INIT FAILURE/u.test(error.message)),
    );
  } finally {
    server.db.close();
  }
});

test('unqualified process types remain explicitly unsupported without extending dispatch points', async (t) => {
  const f = await fixture(t, process(':FLAG := 1;', '', 'NATIVE_PLSQL'));
  const server = f.open();
  try {
    const state = session();
    server.renderer.prepare(state, '1');
    assert.equal(state.items.FLAG, undefined);
    assert.ok(server.diagnostics().some((d) => /NATIVE_PLSQL.*not simulated/u.test(d.message)));
    assert.equal(state.items.PAGE_COUNT, '1');
  } finally {
    server.db.close();
  }
});

test('application process sequence is preserved before existing page processes', async (t) => {
  const first = process(":ORDER := nvl(:ORDER, '') || '1';")
    .replace('appProcess initialize (', 'appProcess first (')
    .replace('name: Initialize', 'name: First');
  const second = process(":ORDER := nvl(:ORDER, '') || '2';")
    .replace('appProcess initialize (', 'appProcess second (')
    .replace('name: Initialize', 'name: Second')
    .replace('sequence: 10', 'sequence: 20');
  const pages = PAGE.replace(':PAGE_COUNT := nvl(:PAGE_COUNT, 0) + 1;', ":ORDER := :ORDER || 'P';");
  const f = await fixture(t, second + first, '', pages);
  const server = f.open();
  try {
    const state = session();
    server.renderer.prepare(state, '1');
    assert.equal(state.items.ORDER, '12P');
  } finally {
    server.db.close();
  }
});
