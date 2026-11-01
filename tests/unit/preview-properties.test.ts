import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseApexLang } from '../../packages/core/src/preview/apexlang.ts';
import { buildCatalog, checkComponentProperties } from '../../packages/core/src/preview/properties.ts';
import { checkApplication } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const catalog = buildCatalog(
  JSON.parse(fs.readFileSync(path.resolve('resources/components/source/parameters.json'), 'utf8')),
);

const PAGE = `page 1 (
    name: Guessed
    alias: GUESSED

    region report (
        name: Report
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery: select 1 x from dual
        }
        layout {
            sequence: 10
            slot: body
        }
        reportTemplate: @/standard
    )

    region selector (
        name: Selector
        type: regionDisplaySelector
        layout {
            sequence: 5
            slot: body
        }
        settings {
            mode: standard
        }
    )

    pageItem P1_CATEGORY (
        type: selectList
        label {
            label: Category
        }
        layout {
            sequence: 10
            region: @report
        }
        listOfValues {
            type: staticValues
        }
        behavior {
            pageActionOnSelection: submitPage
        }
        source {
            type: sqlQuery
            sqlQuery: select 1 from dual
        }
    )

    pageItem P1_FILE (
        type: fileUpload
        label {
            label: File
        }
        layout {
            sequence: 20
            region: @report
        }
        storage {
            type: &P1_STORAGE.
            purgeFileAt: endOfRequest
        }
    )

    pageItem P1_PLUGIN (
        type: plugin/slider
        label {
            label: Slider
        }
        layout {
            sequence: 30
            region: @report
        }
        settings {
            anything: goes
        }
    )

    button go (
        buttonName: GO
        label: Go
        layout {
            sequence: 10
            region: @report
            slot: create
        }
        behavior {
            action: submitPage
        }
        advanced {
            htmlDomId: go_button
        }
    )
)
`;

test('unknown APEXlang property groups, properties and values are reported', () => {
  const findings = checkComponentProperties(parseApexLang(PAGE), '1', catalog).map((entry) => entry.message);
  assert.deepEqual(findings.sort(), [
    'pageItem P1_CATEGORY: unknown property group "behavior"',
    'pageItem P1_CATEGORY: unknown property group "listOfValues"',
    'pageItem P1_CATEGORY: unknown value "sqlQuery" for source.type (expected databaseColumn, expression, functionBody, item, null, preference, sqlQueryMultipleValues, sqlQuerySingleValue, staticValue)',
    'region report: unknown property group "reportTemplate"',
    'region selector: unknown value "standard" for settings.mode (expected scrollWindow, viewSingleRegion)',
  ]);
});

test('the Oracle sample applications pass the property check', () => {
  const root = path.resolve('resources/public-templates/26.2/documents');
  let pages = 0;
  const findings: string[] = [];
  for (const app of fs.readdirSync(root)) {
    const directory = path.join(root, app);
    if (!fs.statSync(directory).isDirectory()) continue;
    for (const file of fs.readdirSync(directory)) {
      const text = fs.readFileSync(path.join(directory, file), 'utf8');
      for (const match of text.matchAll(/````apexlang\n([^]*?)\n````/gu)) {
        pages += 1;
        for (const finding of checkComponentProperties(parseApexLang(match[1]!, file), undefined, catalog))
          findings.push(`${app}/${file}: ${finding.message}`);
      }
    }
  }
  assert.ok(pages > 1000, `sample pages parsed: ${pages}`);
  assert.deepEqual(findings, []);
});

test('preview check reports unknown properties as warnings', async (t) => {
  const { app, assets } = await workspace(t, {
    'pages/p00009-guessed.apx': PAGE.replace('page 1 (', 'page 9 ('),
  });
  const result = checkApplication({ sourceDir: app, assetsDir: assets, pages: ['9'] });
  const warnings = result.diagnostics.filter((entry) => entry.level === 'warning' && entry.page === '9');
  assert.ok(
    warnings.some((entry) => entry.message === 'region report: unknown property group "reportTemplate"'),
    JSON.stringify(warnings),
  );
});
