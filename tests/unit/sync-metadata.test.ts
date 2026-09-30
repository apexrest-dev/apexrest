import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OracleAdapter } from '../../packages/core/src/oracle.ts';
import type { Environment } from '../../packages/core/src/config.ts';
import type { ProcessResult } from '../../packages/core/src/process.ts';

const env = { applicationId: 123, workspace: 'FIXTURE', parsingSchema: 'FIXTURE' } as Environment;
const result = (items: unknown[]): ProcessResult => ({
  code: 0,
  stdout: JSON.stringify({ results: [{ items }] }),
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
});
for (const transport of ['direct', 'ords'] as const) {
  test(`update metadata ${transport} SQLcl transport contract: explicit formatting, scoped binds and null preservation`, async () => {
    const inputs: string[] = [];
    const oracle = new OracleAdapter(async (request) => {
      inputs.push(request.args.join(' ') + '\n' + (request.input ?? ''));
      return result([{ last_updated_on: null, last_updated_by: null }]);
    });
    const stage = await mkdtemp(path.join(tmpdir(), 'apexrest-sync-metadata-'));
    oracle.stage = async () => stage;
    oracle.settings = async () => ({
      executable: 'sql',
      javaHome: undefined,
      schemaVersion: 1,
      mode: 'cli',
      mcpRestrictLevel: '4',
      databaseTransport: transport,
    });
    if (transport === 'ords')
      oracle.selectedConnection = async () => ({
        ords: {
          url: 'https://fixture.invalid/ords/schema/',
          username: 'FIXTURE',
          password: 'fixture-secret',
        },
      });
    const metadata = await oracle.applicationMetadata(env, { kind: 'sqlcl-store', name: 'fixture' });
    assert.deepEqual(metadata, { lastUpdatedOn: null, lastUpdatedBy: null });
    assert.equal(inputs.length, 1);
    assert.match(inputs[0]!, /to_char\(last_updated_on/);
    assert.match(inputs[0]!, /NLS_DATE_LANGUAGE=American/);
    assert.match(inputs[0]!, /application_id = :p_app_id and workspace = :p_workspace and owner = :p_owner/);
    assert.doesNotMatch(inputs[0]!, /\b(?:insert|update|delete|create|drop)\b/i);
    if (transport === 'ords') assert.match(inputs[0]!, /connect -orest/);
    else assert.match(inputs[0]!, /-name/);
  });
}

test('missing, malformed and failed metadata reads never fabricate freshness', async () => {
  const oracle = new OracleAdapter();
  for (const rows of [[], [{}], [{ last_updated_on: 123, last_updated_by: null }]]) {
    oracle.jsonQuery = async () => rows;
    await assert.rejects(oracle.applicationMetadata(env, { kind: 'sqlcl-store', name: 'fixture' }), {
      code: 'SYNC_METADATA_UNCONFIRMED',
    });
  }
});
