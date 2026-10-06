import path from 'node:path';
import { readFile } from 'node:fs/promises';

export interface TargetVersions {
  apexVersion: string;
  databaseVersion: string;
}
export const APEX_262_PROFILE = {
  id: 'apex262-sqlcl263-mmd3479',
  apex: '26.2',
  sqlcl: '26.3.0.260.1620',
  mmd: '26.2.0+3479',
  qualification: 'partial-local',
} as const;

export function databaseMeetsApex262Minimum(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.|$)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]),
    minor = Number(match[2]);
  if (major === 23) return minor >= 26;
  return major > 19 || (major === 19 && minor >= 18);
}

/** Read the real vendor metadata; never rewrite or infer an MMD build. */
export async function sourceMmdVersion(source: string): Promise<string | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(source, '.apex/apexlang.json'), 'utf8'));
    const version = (value as { mmdVersion?: unknown } | null)?.mmdVersion;
    return typeof version === 'string' && /^\d+\.\d+\.\d+\+\d+$/.test(version) ? version : null;
  } catch {
    return null;
  }
}

export function evaluatePartialImportCompatibility(
  input: TargetVersions & {
    compilerVersion: string;
    mmdVersion: string | null;
    importFiles: boolean;
    mode: 'cli' | 'mcp';
    databaseTransport: 'direct' | 'ords';
    helpHash: string;
  },
) {
  const reasons: string[] = [];
  if (input.mode !== 'cli' || input.databaseTransport !== 'direct')
    reasons.push('Partial import requires direct SQLcl CLI transport.');
  if (!input.importFiles) reasons.push('The selected SQLcl import help does not advertise -files.');
  if (!input.compilerVersion.includes(APEX_262_PROFILE.sqlcl))
    reasons.push('The SQLcl build is outside the reviewed partial-import profile.');
  if (input.mmdVersion !== APEX_262_PROFILE.mmd)
    reasons.push('Source MMD is outside the reviewed APEX 26.2 profile.');
  if (!/^26\.2(?:\.|$)/.test(input.apexVersion))
    reasons.push('The target APEX release is outside the reviewed 26.2 profile.');
  if (!databaseMeetsApex262Minimum(input.databaseVersion))
    reasons.push('Target database release is unconfirmed or below the APEX 26.2 minimum.');
  return { ...input, supported: reasons.length === 0, reasons };
}
