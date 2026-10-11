// Text stays in memory; only boolean oracle outcomes leave this module.
export function agentTaskPrerequisite(task, options = {}) {
  if (task.authorization !== 'read-only-or-local')
    return {
      status: options['allow-app-writes'] ? 'blocked' : 'not_run',
      reason: options['allow-app-writes']
        ? 'Definition-specific operator/readback/reset fixture is not implemented. No generic import or blind reset is substituted.'
        : 'Requires --allow-app-writes and literal --user-request; exact case fixtures remain unimplemented.',
    };
  if (['AGT-006', 'AGT-013'].includes(task.id) && !options.interactive)
    return { status: 'not_run', reason: 'Human App Builder edit/host restart requires --interactive.' };
  if (!['AGT-001', 'AGT-004', 'AGT-005', 'AGT-007', 'AGT-008', 'AGT-011', 'AGT-014'].includes(task.id))
    return { status: 'blocked', reason: 'Definition-specific automated oracle is not implemented.' };
  return null;
}

export function answerChecks(
  id,
  answer,
  { pages = [], columns = [], foreignKeys = [], schema, referenceIds = [], pluginReferenceUsed = false } = {},
) {
  if (id === 'AGT-001') {
    const observed = [...answer.matchAll(/^\s*\|\s*(\d+)\s*\|\s*([^|]+)\|/gm)].map((m) => ({
      id: Number(m[1]),
      name: m[2].replace(/[`*]/g, '').trim(),
    }));
    const matches =
      pages.length > 0 &&
      pages.every(
        (p) =>
          new RegExp(`\\b${p.page_id}\\b`).test(answer) &&
          answer.toLowerCase().includes(p.page_name.toLowerCase()),
      );
    return [
      {
        name: 'live-page-ids-and-names',
        passed:
          matches &&
          (!observed.length ||
            (observed.length === pages.length &&
              new Set(observed.map((p) => p.id)).size === pages.length &&
              observed.every((p) =>
                pages.some(
                  (row) => row.page_id === p.id && row.page_name.toLowerCase() === p.name.toLowerCase(),
                ),
              ))),
      },
    ];
  }
  if (id === 'AGT-008')
    return [
      {
        name: 'dictionary-columns-match',
        passed:
          columns.length > 0 &&
          columns.every((c) => {
            const name = c.column_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const type = c.data_type.replace(/\([^)]*\)/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return answer
              .split('\n')
              .some(
                (line) =>
                  new RegExp(`\\b${name}\\b`, 'i').test(line) &&
                  new RegExp(`\\b${type}\\b`, 'i').test(line.replace(/\([^)]*\)/g, '')),
              );
          }),
      },
      {
        name: 'dictionary-fks-match',
        passed: foreignKeys.length
          ? foreignKeys.every(
              (f) =>
                answer.includes(f.column_name) &&
                answer.includes(f.referenced_table) &&
                answer.includes(f.referenced_column),
            )
          : /no foreign keys?\b|\bno\s+FKs?\b|foreign keys?[^\n]*(?:none|0)|зовнішн\p{L}*\s+ключ\p{L}*(?:\s+у\s+таблиці)?\s*[:—-]?\s*(?:немає|відсутн\p{L}*)|(?:немає|відсутн\p{L}*)\s+(?:жодних\s+)?зовнішн\p{L}*\s+ключ\p{L}*/iu.test(
              answer,
            ),
      },
    ];
  if (id === 'AGT-011')
    return [{ name: 'connection-schema-match', passed: !!schema && answer.includes(schema) }];
  if (id === 'AGT-007')
    return [
      { name: 'plugin-reference-used', passed: pluginReferenceUsed },
      { name: 'profile-reference-citation', passed: referenceIds.some((id) => answer.includes(id)) },
      {
        name: 'conditional-grid-readonly-explanation',
        passed:
          /read.only/i.test(answer) &&
          /column|field/i.test(answer) &&
          /condition|expression|item/i.test(answer),
      },
      {
        name: 'independent-semantic-review',
        status: 'needs_review',
        reason:
          'Automatic keyword/citation checks cannot prove the technical answer; independent review required.',
      },
    ];
  return [];
}
