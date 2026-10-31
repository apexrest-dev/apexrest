import { crc32, deflateRawSync } from 'node:zlib';
import { escapeHtml } from '../../theme.ts';

/**
 * Report downloads beyond CSV/HTML: a minimal but genuine Office Open XML workbook (one sheet,
 * bold header row, numbers as numbers) and a print-friendly HTML page that stands in for PDF.
 */

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** A plain ZIP archive (deflate, no extras), enough for spreadsheet applications. */
export function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // 2026-01-01 00:00 in DOS time; the timestamp is irrelevant for generated files.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const xml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    // Characters XML 1.0 does not allow.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, '');

function columnName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

const NUMBER = /^-?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/u;

/** Workbook bytes for headings and display rows; plain numeric text becomes number cells. */
export function toXlsx(sheetName: string, headings: string[], rows: string[][]): Buffer {
  const cell = (value: string, row: number, column: number, header: boolean) => {
    const ref = `${columnName(column)}${row}`;
    if (!header && NUMBER.test(value.trim()) && value.trim().length < 16)
      return `<c r="${ref}"><v>${value.trim()}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  };
  const sheetRows = [headings, ...rows]
    .map(
      (values, index) =>
        `<row r="${index + 1}">${values.map((value, column) => cell(value, index + 1, column, index === 0)).join('')}</row>`,
    )
    .join('');
  const widths = headings
    .map((heading, index) => {
      const longest = Math.max(heading.length, ...rows.slice(0, 200).map((row) => (row[index] ?? '').length));
      return `<col min="${index + 1}" max="${index + 1}" width="${Math.min(60, Math.max(8, longest + 2))}" customWidth="1"/>`;
    })
    .join('');
  const name = xml(sheetName.replace(/[\\/?*[\]:]/gu, ' ').slice(0, 31) || 'Sheet1');
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${widths ? `<cols>${widths}</cols>` : ''}<sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  return zip(
    Object.entries(files).map(([entry, content]) => ({ name: entry, data: Buffer.from(content, 'utf8') })),
  );
}

/** PDF stand-in: a print-friendly page that says plainly it is not a PDF. */
export function toPrintHtml(title: string, headings: string[], rows: string[][], numeric: boolean[]): string {
  const align = (index: number) => (numeric[index] ? ' class="num"' : '');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;margin:24px;color:#161513}
.note{border:1px solid #c9a227;background:#fff8dc;padding:8px 12px;margin:0 0 16px;border-radius:4px}
h1{font-size:18px;margin:0 0 12px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #c8c8c8;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f0f0f0}
td.num,th.num{text-align:right}thead{display:table-header-group}tr{break-inside:avoid}
@media print{.note{display:none}body{margin:0}}
</style></head><body><p class="note"><strong>Local preview:</strong> PDF files are not generated without the database. This print-friendly page stands in for the PDF download; use your browser's Print → Save as PDF. <button type="button" onclick="window.print()">Print</button></p><h1>${escapeHtml(title)}</h1><table><thead><tr>${headings.map((heading, index) => `<th${align(index)}>${escapeHtml(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td${align(index)}>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
