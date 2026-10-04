import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// UTF-8 JSON payload budgets, not tokenizer estimates or native-host billing.
export const catalogByteBudget = 13000;
export const responseCases = [
  {
    id: 'defaultReferenceSearch',
    request: { name: 'apexrest_reference', arguments: { mode: 'search', query: 'validate' } },
    // The default search page is bounded by the 8 KiB inline result limit; the
    // reference ranking rewrite returns richer hits than the earlier 6500-byte sample.
    maxBytes: 8192,
  },
  {
    id: 'focusedReferenceSearch',
    request: {
      name: 'apexrest_reference',
      arguments: { mode: 'search', query: 'chart series', kind: 'grammar', limit: 3 },
    },
    maxBytes: 3500,
  },
  {
    id: 'boundedReferenceRead',
    request: {
      name: 'apexrest_reference',
      arguments: { mode: 'read', id: 'oracle:templates/region-components/chart/chart.bar', limit: 1024 },
    },
    maxBytes: 4096,
  },
];

export function jsonFootprint(value) {
  const serialized = JSON.stringify(value);
  return {
    bytes: Buffer.byteLength(serialized, 'utf8'),
    sha256: createHash('sha256').update(serialized).digest('hex'),
  };
}

export function assertByteBudget(label, bytes, budget) {
  assert.ok(bytes <= budget, `${label}: ${bytes} UTF-8 JSON bytes exceeds the ${budget}-byte budget`);
}

export function catalogFootprint(catalog) {
  const names = catalog.tools.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length, 'The MCP catalog must not repeat tool definitions');
  for (const { request } of responseCases)
    assert.ok(names.includes(request.name), `The MCP catalog is missing ${request.name}`);
  const footprint = { toolCount: names.length, ...jsonFootprint(catalog) };
  assertByteBudget('MCP catalog', footprint.bytes, catalogByteBudget);
  return footprint;
}

export function responseFootprint(response, sample) {
  assert.notEqual(response.isError, true, `${sample.id} must return a successful MCP result`);
  const text = response.content.find((item) => item.type === 'text')?.text;
  assert.equal(typeof text, 'string', `${sample.id} must include a JSON text result`);
  const result = JSON.parse(text);
  assert.equal(result.ok, true, `${sample.id} must return successful domain data`);
  const payload = jsonFootprint(response);
  assertByteBudget(sample.id, payload.bytes, sample.maxBytes);
  return {
    responseBytes: payload.bytes,
    textBytes: Buffer.byteLength(text, 'utf8'),
    dataBytes: jsonFootprint(result.data).bytes,
    // The data hash excludes the random envelope run ID so runs remain comparable.
    dataSha256: jsonFootprint(result.data).sha256,
    maxBytes: sample.maxBytes,
  };
}
