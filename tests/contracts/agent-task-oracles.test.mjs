import test from 'node:test';
import assert from 'node:assert/strict';
import { answerChecks, agentTaskPrerequisite } from '../../scripts/lib/agent-task-oracles.mjs';
test('page oracle rejects missing and extra page rows', () => {
  const pages = [
    { page_id: 1, page_name: 'Home' },
    { page_id: 9999, page_name: 'Login' },
  ];
  assert.equal(answerChecks('AGT-001', '| 1 | Home |\n| 9999 | Login |', { pages })[0].passed, true);
  assert.equal(answerChecks('AGT-001', '| 1 | Home |', { pages })[0].passed, false);
  assert.equal(
    answerChecks('AGT-001', '| 1 | Home |\n| 9999 | Login |\n| 2 | Extra |', { pages })[0].passed,
    false,
  );
  assert.equal(answerChecks('AGT-001', '| 1 | Home |\n| 1 | Home |\nLogin 9999', { pages })[0].passed, false);
});
test('unsupported agent tasks remain blocked even with write flags', () => {
  assert.equal(
    agentTaskPrerequisite({ id: 'AGT-002', authorization: 'application-import' }).status,
    'not_run',
  );
  assert.equal(
    agentTaskPrerequisite(
      { id: 'AGT-002', authorization: 'application-import' },
      { 'allow-app-writes': true },
    ).status,
    'blocked',
  );
  assert.equal(
    agentTaskPrerequisite({ id: 'AGT-012', authorization: 'read-only-or-local' }).status,
    'blocked',
  );
  assert.equal(agentTaskPrerequisite({ id: 'AGT-001', authorization: 'read-only-or-local' }), null);
});
test('dictionary oracle checks all columns, types and foreign-key endpoints', () => {
  const data = {
    columns: [{ column_name: 'ID', data_type: 'NUMBER' }],
    foreignKeys: [{ column_name: 'PARENT_ID', referenced_table: 'PARENT', referenced_column: 'ID' }],
  };
  assert.ok(
    answerChecks('AGT-008', 'ID NUMBER; PARENT_ID references PARENT ID', data).every((c) => c.passed),
  );
  assert.equal(answerChecks('AGT-008', 'ID NUMBER', data)[1].passed, false);
});
test('reference keywords and a citation do not pass independent semantic review', () => {
  const checks = answerChecks('AGT-007', 'Read-only column condition; oracle:synthetic', {
    referenceIds: ['oracle:synthetic'],
  });
  assert.equal(checks[0].passed, true);
  assert.equal(checks[1].passed, true);
  assert.equal(checks[2].passed, false);
});
