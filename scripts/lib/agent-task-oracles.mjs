// Text stays in memory; only boolean oracle outcomes leave this module.
export function answerChecks(
  id,
  answer,
  { pages = [], columns = [], foreignKeys = [], schema, referenceIds = [] } = {},
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
          columns.every((c) => answer.includes(c.column_name) && answer.toUpperCase().includes(c.data_type)),
      },
      {
        name: 'dictionary-fks-match',
        passed: foreignKeys.every(
          (f) =>
            answer.includes(f.column_name) &&
            answer.includes(f.referenced_table) &&
            answer.includes(f.referenced_column),
        ),
      },
    ];
  if (id === 'AGT-011')
    return [{ name: 'connection-schema-match', passed: !!schema && answer.includes(schema) }];
  if (id === 'AGT-007')
    return [
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
        passed: false,
        reason:
          'Automatic keyword/citation checks cannot prove the technical answer; independent review required.',
      },
    ];
  return [];
}
