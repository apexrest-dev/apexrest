import { parseArgs } from 'node:util';
import { checkpoint, usageSelection } from './lib/plugin-test-metrics.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    file: { type: 'string' },
    rollout: { type: 'string' },
    transcript: { type: 'string' },
    'usage-source': { type: 'string' },
    case: { type: 'string' },
  },
});
if (!['start', 'finish'].includes(positionals[0]) || !values.file)
  throw new Error(
    'Usage: plugin-test-metrics.mjs start|finish --file PRIVATE.json [--rollout CODEX.jsonl] [--case ID]',
  );
console.log(
  JSON.stringify(await checkpoint(positionals[0], values.file, usageSelection(values), values.case)),
);
