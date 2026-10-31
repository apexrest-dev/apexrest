import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { translateOracleSql } from '../../packages/core/src/preview/database.ts';
import { parseFile } from '../../packages/core/src/preview/extensions/files/parse.ts';
import { PreviewServer } from '../../packages/core/src/preview/server.ts';
import { workspace } from '../fixtures/preview.ts';

const SCHEMA = `create table docs (
  id integer primary key,
  name varchar2(100),
  content blob,
  mime_type varchar2(100),
  filename varchar2(200)
);
create table people (
  id number primary key,
  name varchar2(10),
  born date
);
`;

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const PAGES: Record<string, string> = {
  'pages/p00002-upload.apx': `page 2 (
    name: Upload
    alias: UPLOAD

    region doc (
        name: Document
        type: form
        source {
            location: localDatabase
            tableName: DOCS
        }
        layout {
            sequence: 10
            slot: body
        }
    )

    pageItem P2_ID (
        type: hidden
        layout {
            sequence: 10
            region: @doc
        }
        source {
            formRegion: @doc
            column: ID
            dataType: number
            primaryKey: true
        }
    )

    pageItem P2_NAME (
        type: textField
        layout {
            sequence: 20
            region: @doc
        }
        source {
            formRegion: @doc
            column: NAME
        }
    )

    pageItem P2_FILE (
        type: imageUpload
        layout {
            sequence: 30
            region: @doc
        }
        storage {
            type: blobCol
            mimeTypeColumn: MIME_TYPE
            filenameColumn: FILENAME
        }
        source {
            formRegion: @doc
            column: CONTENT
            dataType: blob
        }
    )

    pageItem P2_PREVIEW (
        type: displayImage
        layout {
            sequence: 40
            region: @doc
        }
        settings {
            basedOn: blobColItem
        }
        source {
            formRegion: @doc
            column: CONTENT
            dataType: blob
            queryOnly: true
        }
    )

    button create (
        buttonName: CREATE
        label: Create
        layout {
            sequence: 10
            region: @doc
            slot: create
        }
        behavior {
            databaseAction: insert
        }
    )

    process init (
        name: Initialize form
        type: formInitialization
        formRegion: @doc
        execution {
            sequence: 10
            point: beforeHeader
        }
    )

    process dml (
        name: Process form
        type: formAutoRowProcessing
        formRegion: @doc
        execution {
            sequence: 10
        }
    )
)
`,
  'pages/p00003-docs.apx': `page 3 (
    name: Docs
    alias: DOCS

    region docs (
        name: Docs
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select id, name, dbms_lob.getlength(content) content, dbms_lob.getlength(content) picture
                  from docs order by id
                \`\`\`
        }
        layout {
            sequence: 10
            slot: body
        }

        column ID (
            heading {
                heading: Id
            }
        )

        column NAME (
            heading {
                heading: Name
            }
        )

        column CONTENT (
            type: downloadBlob
            appearance {
                downloadText: Get #NAME#
            }
            blobAttributes {
                tableName: DOCS
                blobColumn: CONTENT
                primaryKeyColumn1: ID
                mimeTypeColumn: MIME_TYPE
                filenameColumn: FILENAME
            }
        )

        column PICTURE (
            type: displayImage
            blobAttributes {
                tableName: DOCS
                blobColumn: CONTENT
                primaryKeyColumn1: ID
            }
        )
    )

    button fetch (
        buttonName: FETCH
        label: Fetch
        layout {
            sequence: 10
            region: @docs
            slot: create
        }
    )

    process get-file (
        name: Get file
        type: download
        source {
            sqlQuery:
                \`\`\`sql
                select content, filename, mime_type from docs where id = 1
                \`\`\`
        }
        serverSideCondition {
            whenButtonPressed: @fetch
        }
        execution {
            sequence: 10
        }
    )
)
`,
  'shared-components/data-load-definitions/people.apx': `dataLoadDefinition people (
    name: People
    target {
        tableName: PEOPLE
        loadingMethod: append
    }
    dataProfile {
        name: People
        format: csv
    }
    advanced {
        staticId: people
        firstLineContainsHeaders: true
    }
    errorHandling {
        whenOnError: ignore
    }

    dataProfileColumn id (
        columnName: ID
        source {
            sequence: 1
            dataType: number
        }
        parsing {
            selector: id
        }
    )

    dataProfileColumn name (
        columnName: NAME
        source {
            sequence: 2
            dataType: varchar2
            maxLength: 10
        }
        parsing {
            selector: full name
        }
        transformation {
            type: upper
        }
    )

    dataProfileColumn born (
        columnName: BORN
        source {
            sequence: 3
            dataType: date
        }
        parsing {
            selector: born
            formatMask: DD.MM.YYYY
        }
    )
)
`,
  'shared-components/data-load-definitions/sheet.apx': `dataLoadDefinition sheet (
    name: Sheet
    target {
        tableName: SHEET_ROWS
    }
    dataProfile {
        name: Sheet
        format: xlsx
    }
    advanced {
        defaultXlsxSheetName: sheet2.xml
    }

    dataProfileColumn code (
        columnName: CODE
        source {
            sequence: 1
            dataType: varchar2
            maxLength: 20
        }
        parsing {
            selector: CODE
        }
    )

    dataProfileColumn amount (
        columnName: AMOUNT
        source {
            sequence: 2
            dataType: number
        }
        parsing {
            selector: AMOUNT
        }
    )

    dataProfileColumn day (
        columnName: DAY
        source {
            sequence: 3
            dataType: date
        }
        parsing {
            selector: DAY
        }
    )
)
`,
  'pages/p00004-load.apx': `page 4 (
    name: Load
    alias: LOAD

    region upload (
        name: Upload
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
    )

    region preview (
        name: Preview
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                \`\`\`sql
                select p.line_number, p.col001, p.col002
                  from apex_application_temp_files f,
                       table( apex_data_parser.parse(
                                  p_content      => f.blob_content,
                                  p_file_name    => f.filename,
                                  p_file_profile => apex_data_loading.get_file_profile( p_static_id => 'people' ),
                                  p_max_rows     => 100 ) ) p
                 where f.name = :P4_FILE
                \`\`\`
        }
        layout {
            sequence: 20
            slot: body
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P4_FILE
        }
    )

    pageItem P4_FILE (
        type: fileUpload
        layout {
            sequence: 10
            region: @upload
        }
        storage {
            type: appTempFiles
        }
    )

    pageItem P4_SHEET (
        type: hidden
        layout {
            sequence: 20
            region: @upload
        }
    )

    pageItem P4_ERRORS (
        type: hidden
        layout {
            sequence: 30
            region: @upload
        }
    )

    pageItem P4_PROCESSED (
        type: hidden
        layout {
            sequence: 40
            region: @upload
        }
    )

    button load (
        buttonName: LOAD
        label: Load
        layout {
            sequence: 10
            region: @upload
            slot: create
        }
    )

    button load-sheet (
        buttonName: LOAD_SHEET
        label: Load sheet
        layout {
            sequence: 20
            region: @upload
            slot: create
        }
    )

    process load-people (
        name: Load people
        type: dataLoading
        dataLoading {
            dataLoadDefinition: @people
        }
        sourceData {
            fileBrowseItem: P4_FILE
        }
        processingResult {
            errorRowCountItem: P4_ERRORS
            processedRowCountItem: P4_PROCESSED
        }
        execution {
            sequence: 10
        }
        serverSideCondition {
            whenButtonPressed: @load
        }
    )

    process load-sheet (
        name: Load sheet
        type: executeCode
        source {
            plsqlCode:
                \`\`\`plsql
                declare
                    l_blob   blob;
                    l_result apex_data_loading.t_data_load_result;
                begin
                    select blob_content into l_blob from apex_application_temp_files where name = :P4_FILE;
                    l_result := apex_data_loading.load_data( p_static_id => 'sheet', p_data_to_load => l_blob );
                    :P4_PROCESSED := l_result.processed_rows;
                    :P4_ERRORS := l_result.error_rows;
                end;
                \`\`\`
        }
        execution {
            sequence: 20
        }
        serverSideCondition {
            whenButtonPressed: @load-sheet
        }
    )
)
`,
};

function xlsx(): Uint8Array {
  const sheet = (rows: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Notes" sheetId="1" r:id="rId1"/><sheet name="Data &amp; more" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      '<sst><si><t>CODE</t></si><si><t>AMOUNT</t></si><si><t>DAY</t></si><si><r><t>A</t></r><r><t>-1</t></r></si></sst>',
    ),
    'xl/styles.xml': strToU8(
      '<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      sheet('<row r="1"><c r="A1" t="inlineStr"><is><t>ignore me</t></is></c></row>'),
    ),
    'xl/worksheets/sheet2.xml': strToU8(
      sheet(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>12.5</v></c><c r="C2" s="1"><v>45658</v></c></row>' +
          '<row r="4"><c r="A4" t="inlineStr"><is><t>B-2</t></is></c><c r="B4"><v>7</v></c><c r="C4" s="1"><v>45689</v></c></row>',
      ),
    ),
  });
}

async function start(t: import('node:test').TestContext) {
  const { app, assets } = await workspace(t, { '.apex-local/01-schema.sql': SCHEMA, ...PAGES });
  const server = new PreviewServer({ sourceDir: app, assetsDir: assets, database: ':memory:' });
  await server.start();
  t.after(() => server.stop());
  const first = await fetch(`${server.url}/r/demo/home`);
  const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
  await first.text();
  const get = (path: string) => fetch(`${server.url}${path}`, { headers: { cookie } });
  /** apex.page.submit with files: multipart/form-data with p_json first, then p_files. */
  const submit = async (
    page: string,
    request: string,
    items: { n: string; v: string }[],
    files: { item: string; name: string; type: string; data: Uint8Array }[] = [],
  ) => {
    const form = new FormData();
    const itemsToSubmit = items.map((item) => {
      const index = files.findIndex((file) => file.item === item.n);
      return index >= 0 ? { ...item, fileIndex: index, fileCount: 1 } : item;
    });
    form.append('p_json', JSON.stringify({ pageItems: { itemsToSubmit } }));
    form.append('p_flow_id', '100');
    form.append('p_flow_step_id', page);
    form.append('p_request', request);
    for (const file of files) form.append('p_files', new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
    const response = await fetch(`${server.url}/r/demo/wwv_flow.accept`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    return (await response.json()) as { redirectURL?: string; errors?: { message: string }[] };
  };
  return { server, get, submit };
}

test('multipart page submit stores an image in the form BLOB column and serves it back', async (t) => {
  const { server, get, submit } = await start(t);
  const result = await submit(
    '2',
    'CREATE',
    [
      { n: 'P2_ID', v: '' },
      { n: 'P2_NAME', v: 'Logo' },
      { n: 'P2_FILE', v: 'logo.png' },
    ],
    [{ item: 'P2_FILE', name: 'logo.png', type: 'image/png', data: PNG }],
  );
  assert.equal(result.errors, undefined, JSON.stringify(result.errors));
  const row = server.db.rawQuery('select id, name, content, mime_type, filename from docs').rows[0]!;
  assert.equal(row[1], 'Logo');
  assert.deepEqual(Buffer.from(row[2] as Uint8Array), PNG);
  assert.equal(row[3], 'image/png');
  assert.equal(row[4], 'logo.png');
  // the temporary copy of a BLOB column upload is purged at the end of the request
  assert.equal(server.db.scalar('select count(*) from apex_application_temp_files'), 0);

  const form = await (await get('/r/demo/upload?p2_id=1')).text();
  assert.match(form, /<img id="P2_PREVIEW" class="display_image" src="([^"]+files\.item[^"]+)"/);
  assert.match(
    form,
    /<a-file-upload[^>]* filename="logo\.png" file-size="70" mime-type="image\/png" link="[^"]+files\.item/,
  );
  const src = /<img id="P2_PREVIEW" class="display_image" src="([^"]+)"/
    .exec(form)![1]!
    .replaceAll('&amp;', '&');
  const image = await get(src);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.match(image.headers.get('content-disposition') ?? '', /^inline/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG);

  // report columns: download BLOB link and display image
  const report = await (await get('/r/demo/docs')).text();
  const link = /<a href="([^"]+files\.column[^"]+)">Get Logo<\/a>/.exec(report);
  assert.ok(link, report.slice(0, 2000));
  assert.match(
    report,
    /<img src="[^"]+files\.column[^"]+inline=Y[^"]*" alt="" title="" class="apex-local-blob-image"/,
  );
  const file = await get(link[1]!.replaceAll('&amp;', '&'));
  assert.match(file.headers.get('content-disposition') ?? '', /^attachment; filename="logo\.png"/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), PNG);

  // download process: the submit answers with a download URL
  const fetched = await submit('3', 'FETCH', []);
  assert.match(fetched.redirectURL ?? '', /files\.download\?id=\d+/);
  const download = await get(fetched.redirectURL!);
  assert.equal(download.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), PNG);
});

test('data loading parses CSV uploads with a data load definition and reports error rows', async (t) => {
  const { server, get, submit } = await start(t);
  const csv =
    'id;full name;born\n1;Ann;01.02.1990\n2;"Bob; Jr.";15.06.1985\nx;Bad;01.01.2000\n3;Way too long name;01.01.2001\n';
  const uploaded = await submit(
    '4',
    '',
    [{ n: 'P4_FILE', v: 'people.csv' }],
    [{ item: 'P4_FILE', name: 'people.csv', type: 'text/csv', data: Buffer.from(csv) }],
  );
  assert.equal(uploaded.errors, undefined);
  const name = server.db.scalar('select name from apex_application_temp_files') as string;
  assert.match(name, /^\d+\/people\.csv$/);

  // apex_data_parser.parse joined laterally to the temp file table, columns mapped by the profile
  const page = await (await get('/r/demo/load')).text();
  assert.match(page, />Bob; Jr\.</);
  assert.match(page, /<td class="t-Report-cell"[^>]*>2<\/td>/);

  const loaded = await submit('4', 'LOAD', []);
  assert.equal(loaded.errors, undefined, JSON.stringify(loaded.errors));
  assert.deepEqual(server.db.query('select id, name, born from people order by id').rows, [
    { ID: 1, NAME: 'ANN', BORN: '1990-02-01' },
    { ID: 2, NAME: 'BOB; JR.', BORN: '1985-06-15' },
  ]);
  const after = await (await get('/r/demo/load')).text();
  assert.match(after, /4 rows processed: 2 inserted, 0 updated, 2 with errors\./);
  assert.match(after, /id="P4_ERRORS" value="2"/);
  assert.match(after, /id="P4_PROCESSED" value="4"/);
});

test('XLSX workbooks load through apex_data_loading.load_data and list their worksheets', async (t) => {
  const { server, submit } = await start(t);
  const book = xlsx();
  const parsed = parseFile(book, 'book.xlsx', { sheet: 'Data & more' });
  assert.deepEqual(parsed.columns, ['CODE', 'AMOUNT', 'DAY']);
  assert.deepEqual(parsed.rows, [
    ['A-1', '12.5', '2025-01-01'],
    ['', '', ''],
    ['B-2', '7', '2025-02-01'],
  ]);

  await submit(
    '4',
    '',
    [{ n: 'P4_FILE', v: 'book.xlsx' }],
    [{ item: 'P4_FILE', name: 'book.xlsx', type: 'application/octet-stream', data: book }],
  );
  const sheets = server.db.query(
    `select p.sheet_display_name, p.sheet_file_name from apex_application_temp_files f,
            table(apex_data_parser.get_xlsx_worksheets(p_content => f.blob_content)) p order by p.sheet_sequence`,
  ).rows;
  assert.deepEqual(sheets, [
    { SHEET_DISPLAY_NAME: 'Notes', SHEET_FILE_NAME: 'sheet1.xml' },
    { SHEET_DISPLAY_NAME: 'Data & more', SHEET_FILE_NAME: 'sheet2.xml' },
  ]);
  const result = await submit('4', 'LOAD_SHEET', []);
  assert.equal(result.errors, undefined, JSON.stringify(result.errors));
  assert.deepEqual(server.db.query('select code, amount, day from sheet_rows order by code').rows, [
    { CODE: 'A-1', AMOUNT: 12.5, DAY: '2025-01-01' },
    { CODE: 'B-2', AMOUNT: 7, DAY: '2025-02-01' },
  ]);
  // the empty spreadsheet row 3 is skipped
  assert.equal(server.db.scalar('select count(*) from sheet_rows'), 2);
});

test('BLOB values travel as tokens through SQL, PL/SQL binds and table functions', async (t) => {
  const { server } = await start(t);
  const db = server.db;
  db.db
    .prepare('insert into docs (id, name, content) values (9, ?, ?)')
    .run('raw', Buffer.from('a,b\n1,2\n'));
  const token = db.scalar('select content from docs where id = 9') as string;
  assert.match(token, /^\[blob 8 bytes #[0-9a-f]{16}\]$/);
  db.execute('insert into docs (id, name, content) values (10, :N, :B)', { N: 'copy', B: token });
  assert.equal(
    db.scalar('select count(*) from docs a join docs b on a.content = b.content and a.id = 9 and b.id = 10'),
    1,
  );
  assert.equal(db.scalar('select dbms_lob.getlength(content) from docs where id = 10'), 8);
  assert.deepEqual(
    db.query(
      `select line_number, col001, col002 from table(apex_data_parser.parse(p_content => :B, p_file_name => 'x.csv'))`,
      { B: token },
    ).rows,
    [
      { LINE_NUMBER: 1, COL001: 'a', COL002: 'b' },
      { LINE_NUMBER: 2, COL001: '1', COL002: '2' },
    ],
  );
  assert.match(
    translateOracleSql('select p.col001 from t f, table(apex_data_parser.parse(p_content => f.c)) p'),
    /json_each\(apex_data_parser__parse\(f\.c/,
  );
});
