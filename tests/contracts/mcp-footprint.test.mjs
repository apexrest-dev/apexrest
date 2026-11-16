import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  assertByteBudget,
  catalogFootprint,
  jsonFootprint,
  responseCases,
  responseFootprint,
} from '../../scripts/lib/mcp-footprint.mjs';

test('payload budgets count UTF-8 bytes and reject oversized responses', () => {
  const value = { content: 'дані 😀' };
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  assert.ok(bytes > JSON.stringify(value).length);
  assert.equal(jsonFootprint(value).bytes, bytes);
  assert.throws(() => assertByteBudget('fixture', bytes, bytes - 1), /UTF-8 JSON bytes/);
  assertByteBudget('fixture', bytes, bytes);
});

test('built MCP catalog and representative retrieval responses stay within byte budgets', async (t) => {
  const client = new Client({ name: 'payload-budget-contract', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('dist/runtime/mcp.mjs')],
      stderr: 'pipe',
      // The SDK's default environment, without adding local usage records to the developer's home.
      env: { ...getDefaultEnvironment(), APEXREST_USAGE: '0' },
    }),
  );
  catalogFootprint(await client.listTools());
  for (const sample of responseCases) {
    const first = responseFootprint(await client.callTool(sample.request), sample);
    const repeated = responseFootprint(await client.callTool(sample.request), sample);
    assert.deepEqual(repeated, first, `${sample.id} should have a stable data hash and byte footprint`);
  }
});
