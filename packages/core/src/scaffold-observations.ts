import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { resourceRoot } from './project.ts';
import type { Environment } from './config.ts';
import { Fault } from './result.ts';

/** Generate, but never execute, explicitly requested target-bound SQL observations. */
export async function scaffoldObservationsSql(env: Environment, pages: number[]) {
  const literal = (value: string) => {
    if (/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(value))
      throw new Fault('INVALID_INPUT', 'Observation target fields must be single-line values.', 2);
    return "'" + value.replaceAll("'", "''") + "'";
  };
  if (
    !Number.isSafeInteger(env.applicationId) ||
    env.applicationId < 1 ||
    !pages.length ||
    pages.some((id) => !Number.isInteger(id) || id < 1 || id > 9998)
  )
    throw new Fault('INVALID_INPUT', 'Observation pages must be explicit scaffold page IDs.', 2);
  const values: Record<string, string> = {
    APP: String(env.applicationId),
    PAGES: pages.join(','),
    DB: literal(env.databaseIdentity.dbUniqueName),
    SERVICE: literal(env.databaseIdentity.serviceName),
    SCHEMA: literal(env.parsingSchema),
    WORKSPACE: literal(env.workspace),
  };
  const template = await readFile(path.join(resourceRoot(), 'scaffold/observations.sql'), 'utf8');
  return template.replace(/__([A-Z_]+)__/g, (_all, key: string) => {
    const value = values[key];
    if (value === undefined)
      throw new Fault('SCAFFOLD_TEMPLATE_INVALID', 'Unknown observation template field.', 3);
    return value;
  });
}
