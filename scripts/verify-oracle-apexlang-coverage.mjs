// Reconcile all official source bytes and exercise every definition through bundled MCP.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const option = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const archive = option('--archive');
if (!archive)
  throw new Error(
    'Usage: node scripts/verify-oracle-apexlang-coverage.mjs --archive PINNED.zip [--resource-root DIRECTORY] [--runtime MCP.mjs] [--out REPORT.json]',
  );
const resources = path.resolve(option('--resource-root') ?? 'plugins/apexrest-apex/resources');
const runtime = path.resolve(option('--runtime') ?? 'plugins/apexrest-apex/runtime/mcp.mjs');
const output = path.resolve(option('--out') ?? 'docs/evidence/oracle-inventory-coverage.json');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const root = path.join(resources, 'references/26.2');
const snapshot = JSON.parse(await readFile(path.join(root, 'oracle-snapshot.json'), 'utf8'));
const bytes = await readFile(archive);
assert.equal(sha256(bytes), snapshot.archiveSha256, 'archive provenance');
const prefix = `skills-${snapshot.commit}/apex/apexlang/26.2/apexlang-inventory/assets/`;
const upstream = unzipSync(bytes, { filter: ({ name }) => name.startsWith(prefix) && name.endsWith('.md') });
const indexBytes = await readFile(path.join(root, 'index.json'));
assert.equal(sha256(indexBytes), snapshot.indexSha256, 'index provenance');
const searchBytes = await readFile(path.join(root, 'search.json'));
assert.equal(sha256(searchBytes), snapshot.searchSha256, 'search accelerator provenance');
const entries = JSON.parse(indexBytes).filter((entry) => entry.id.startsWith('oracle:26.2:inventory/'));
assert.equal(entries.length, Object.keys(upstream).length, 'complete official denominator');
const client = new Client({ name: 'oracle-inventory-coverage', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [runtime],
  cwd: path.dirname(runtime),
  env: { ...process.env, APEXREST_RESOURCES: resources },
  stderr: 'pipe',
});
transport.stderr?.on('data', () => {});
let pages = 0,
  addresses = 0;
const keywords = new Set(),
  families = {};
async function query(args) {
  const result = await client.callTool({ name: 'apexrest_reference', arguments: args });
  assert.ok(!result.isError, 'MCP result is successful');
  const envelope = JSON.parse(result.content.find((part) => part.type === 'text').text);
  assert.equal(envelope.ok, true, JSON.stringify(envelope.diagnostics));
  return envelope.data;
}
try {
  await client.connect(transport);
  const ordinaryQueries = [
    {
      query: 'interactive grid',
      id: 'oracle:26.2:inventory/app/page/region/plugin-variants/interactive-grid/interactive-grid',
    },
    { query: 'reasoningEffort', id: 'oracle:26.2:inventory/app/ai-agent/ai-agent' },
    { query: 'workflow', id: 'oracle:26.2:inventory/app/workflow/workflow' },
  ];
  for (const probe of ordinaryQueries) {
    const hits = await query({
      mode: 'search',
      corpus: 'components',
      version: '26.2',
      query: probe.query,
      include: 'metadata',
      limit: 3,
    });
    assert.ok(
      hits.some((hit) => hit.id === probe.id),
      `${probe.query}: ordinary discovery of ${probe.id}`,
    );
  }
  assert.deepEqual(
    await query({
      mode: 'search',
      corpus: 'components',
      version: '26.2',
      query: 'qzxvnoexist987654',
      include: 'metadata',
      limit: 3,
    }),
    [],
    'unrelated query remains a valid empty result',
  );
  for (const entry of entries) {
    const relative = entry.document.slice('documents/'.length),
      raw = Buffer.from(upstream[prefix + relative]).toString('utf8');
    assert.equal(sha256(raw), entry.contentSha256, `${relative}: source content hash`);
    const component = raw.match(/^- componentType: `([^`]+)`/m)?.[1];
    assert.ok(component, `${relative}: component declaration`);
    keywords.add(component);
    const props = [];
    let group = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('### ')) group = line.slice(4);
      const prop = line.match(/^- `([^`]+)` — `([^`]+)`;/);
      if (prop) props.push({ group, name: prop[1], type: prop[2] });
    }
    assert.deepEqual(
      snapshot.inventoryDefinitions[relative],
      { componentType: component, properties: props },
      `${relative}: property reconciliation`,
    );
    addresses += props.length;
    const family = relative.startsWith('app/page/')
      ? 'page/' + relative.split('/')[2]
      : relative.startsWith('app/')
        ? 'shared/' + relative.split('/')[1]
        : 'workspace/' + relative.split('/')[0];
    const row = (families[family] ??= { documents: 0, propertyAddresses: 0 });
    row.documents++;
    row.propertyAddresses += props.length;
    const hits = await query({
      mode: 'search',
      corpus: 'components',
      version: '26.2',
      query: entry.id,
      include: 'metadata',
      limit: 1,
    });
    assert.equal(hits[0]?.id, entry.id, `${relative}: exact discovery`);
    let offset = 0,
      content = '';
    do {
      const page = await query({ mode: 'read', id: entry.id, version: '26.2', offset, limit: 8192 });
      assert.equal(page.offset, offset);
      content += page.content;
      pages++;
      offset = page.nextOffset;
    } while (offset !== null);
    assert.equal(content, raw, `${relative}: complete paginated MCP content`);
  }
} finally {
  await client.close();
}
assert.equal(snapshot.inventoryCoverage.documents, entries.length);
assert.equal(snapshot.inventoryCoverage.declarationKeywords, keywords.size);
assert.equal(snapshot.inventoryCoverage.propertyAddresses, addresses);
const report = {
  schemaVersion: 1,
  status: 'passed',
  source: snapshot.commit,
  mmdVersion: snapshot.mmdVersion,
  resourceRoot: resources,
  runtime,
  scope:
    'Full official inventory byte/type/property reconciliation, accelerator provenance, ordinary discovery and packaged MCP retrieval; no Oracle database, import or browser qualification.',
  documents: { included: entries.length, upstream: Object.keys(upstream).length },
  declarationKeywords: keywords.size,
  propertyAddresses: addresses,
  paginatedReads: pages,
  families,
  indexSha256: snapshot.indexSha256,
  searchSha256: snapshot.searchSha256,
  ordinaryDiscoveryQueries: ['interactive grid', 'reasoningEffort', 'workflow'],
  unrelatedQuery: 'passed-empty',
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
