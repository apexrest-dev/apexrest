import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadApplication } from '../../packages/core/src/preview/apexlang.ts';
import { previewCheck } from '../../packages/core/src/preview/service.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const PAGE = `page 1 (
    name: Home
    alias: HOME
    title: Home
    region hello (
        name: Hello
        type: staticContent
        source {
            htmlCode: <p>PAGE_VISIBLE_SENTINEL</p>
        }
        layout {
            sequence: 10
            slot: body
        }
    )
)
`;
const PROCESS = `appProcess count-once (
    name: Count once
    type: executeCode
    source {
        plsqlCode: :APP_COUNTER := nvl(:APP_COUNTER, 0) + 1;
    }
    execution {
        sequence: 10
        point: beforeHeader
    }
)
`;
function source(page: string, nested: boolean) {
  const indent = (text: string) =>
    text
      .split('\n')
      .map((line) => (line ? `    ${line}` : line))
      .join('\n');
  return `app demo (\n    name: Demo\n${indent(PROCESS)}${nested ? indent(page) : ''})\n${nested ? '' : page}`;
}
async function fixture(t: Parameters<typeof workspace>[0], page: string, nested: boolean) {
  const result = await workspace(t);
  // Reuse the synthetic theme, but none of the fixture's pre-existing pages or seeds.
  await rm(result.app, { recursive: true, force: true });
  await mkdir(result.app, { recursive: true });
  await writeFile(path.join(result.app, 'application.apx'), source(page, nested));
  return result;
}
function render(app: string, assets: string, page = '1') {
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  try {
    const session = { id: 'regression', user: 'DEVELOPER', items: {}, pagination: {} };
    const html = server.renderer.renderPage(server.renderer.prepare(session, page));
    return {
      html,
      session,
      application: server.renderer.app,
      found: server.renderer.findPage(page),
      aliasFound: server.renderer.findPage('HOME'),
    };
  } finally {
    server.db.close();
  }
}

test('preview checks and renders direct app-child pages exactly once without flattening shared components', async (t) => {
  const outputs = [];
  for (const nested of [false, true]) {
    const { app, assets } = await fixture(t, PAGE, nested);
    const check = await previewCheck(app, { sourceDir: app, assetsDir: assets });
    assert.deepEqual(
      check.pages.map((page) => page.id),
      ['1'],
    );
    assert.deepEqual(check.counts, { error: 0, warning: 0, info: 0 }, JSON.stringify(check));
    const rendered = render(app, assets);
    assert.equal(rendered.found?.id, '1');
    assert.equal(rendered.aliasFound, rendered.found);
    assert.match(rendered.html, /PAGE_VISIBLE_SENTINEL/);
    assert.equal(Number((rendered.session.items as Record<string, unknown>).APP_COUNTER), 1);
    assert.equal(
      rendered.application.shared.filter((component) => component.type === 'appProcess').length,
      0,
    );
    assert.equal(
      rendered.application.app.children.filter((component) => component.type === 'appProcess').length,
      1,
    );
    if (nested)
      assert.equal(
        rendered.found,
        rendered.application.app.children.find((component) => component.type === 'page'),
      );
    // Submission IDs are generated from the current time for each render.
    outputs.push(
      rendered.html.replace(
        /(name="p_page_submission_id" value=")\d+(" id="pPageSubmissionId")/u,
        '$1<time>$2',
      ),
    );
  }
  assert.equal(outputs[0], outputs[1]);
});

test('preview preserves existing root-page precedence over a nested page and the last root declaration', async (t) => {
  const { app, assets } = await fixture(t, PAGE, true);
  await writeFile(path.join(app, 'application.apx'), source(PAGE, true) + PAGE.replace('Home', 'Root first'));
  await mkdir(path.join(app, 'pages'));
  await writeFile(path.join(app, 'pages', 'p00001-last.apx'), PAGE.replace('Home', 'Root last'));
  const loaded = loadApplication(app);
  assert.equal(loaded.pages.size, 1);
  assert.equal(loaded.pages.get('1')?.props.name, 'Root last');
  assert.equal(loaded.app.children.find((component) => component.type === 'page')?.props.name, 'Home');
  const check = await previewCheck(app, { sourceDir: app, assetsDir: assets });
  assert.deepEqual(
    check.pages.map((page) => page.name),
    ['Root last'],
  );
});

test('preview checks missing pages and actual page query errors for both placements, then reads source edits fresh', async (t) => {
  const badPage = `page 1 (
    name: Broken
    region broken (
        name: Broken
        type: classicReport
        source {
            type: sqlQuery
            sqlQuery: select MISSING_COLUMN from dual
        }
        layout {
            sequence: 10
            slot: body
        }
    )
)
`;
  for (const nested of [false, true]) {
    const { app, assets } = await fixture(t, badPage, nested);
    const check = await previewCheck(app, { sourceDir: app, assetsDir: assets });
    assert.equal(check.pages.length, 1);
    assert.ok(check.counts.error > 0, JSON.stringify(check));
    const missing = await previewCheck(app, { sourceDir: app, assetsDir: assets, pages: ['42'] });
    assert.equal(missing.counts.error, 1);
    assert.match(missing.pages[0]!.error!, /Page 42 does not exist/);
    await writeFile(
      path.join(app, 'application.apx'),
      source(
        PAGE.replace('page 1 (', 'page 2 (').replace('PAGE_VISIBLE_SENTINEL', 'EDITED_SENTINEL'),
        nested,
      ),
    );
    const edited = await previewCheck(app, { sourceDir: app, assetsDir: assets });
    assert.deepEqual(
      edited.pages.map((page) => page.id),
      ['2'],
    );
    assert.equal(edited.counts.error, 0);
    const rendered = render(app, assets, '2');
    assert.match(rendered.html, /EDITED_SENTINEL/);
    assert.equal(rendered.application.pages.has('1'), false);
  }
});
