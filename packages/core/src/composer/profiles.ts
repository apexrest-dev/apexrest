import { APEX_262_PROFILE } from '../compatibility.ts';
import { Fault } from '../result.ts';

export const COMPOSER_262_PROFILE = 'profile:apex262-ut262-mmd3479';
export const composerProfiles: Record<string, { mmd: string; sqlcl: string }> = {
  'profile:apex261-ut261-mmd3102': { mmd: '26.1.0+3102', sqlcl: '26.1.2.132.1334' },
  [COMPOSER_262_PROFILE]: { mmd: APEX_262_PROFILE.mmd, sqlcl: APEX_262_PROFILE.sqlcl },
};

/** Pinned Composer profiles whose compiler build equals the installed one (MMD first). */
export function profilesForCompiler(build: string | undefined, mmd?: string) {
  if (!build) return [];
  return Object.entries(composerProfiles)
    .filter(([, pinned]) => pinned.sqlcl === build)
    .sort(([, a], [, b]) => Number(b.mmd === mmd) - Number(a.mmd === mmd))
    .map(([id]) => id);
}

/**
 * The pinned-compiler rule: a profile's compiler build and MMD must match
 * exactly. The refusal names both sides and the bundled profile that matches
 * the installed compiler, so the agent can switch blueprint or compiler.
 */
export function requireComposerCompiler(
  profile: string,
  actual: { mmd: { mmdVersion: string }; compiler: { version: string } },
  blueprintsFor: (profile: string) => string[] = () => [],
) {
  const expected = composerProfiles[profile],
    version = /\bBuild:? (\d+(?:\.\d+)+)\b/.exec(actual.compiler.version)?.[1];
  if (expected && actual.mmd.mmdVersion === expected.mmd && version === expected.sqlcl) return;
  const found = `SQLcl ${version ?? 'unknown build'} with MMD ${actual.mmd.mmdVersion}`;
  const matching = profilesForCompiler(version, actual.mmd.mmdVersion).filter((id) => id !== profile);
  const nextActions: string[] = [];
  for (const id of matching) {
    const blueprints = blueprintsFor(id);
    nextActions.push(
      blueprints.length
        ? `Use a blueprint for ${id}, which matches the installed compiler: ${blueprints.join(', ')}.`
        : `Use a blueprint whose compatibilityProfile is ${id}, which matches the installed compiler.`,
    );
  }
  if (expected)
    nextActions.push(
      `Or install SQLcl ${expected.sqlcl} (MMD ${expected.mmd}) and select it with APEXREST_SQLCL, then rerun compose plan.`,
    );
  else nextActions.push(`Use a known Composer profile: ${Object.keys(composerProfiles).join(', ')}.`);
  throw new Fault(
    'PROFILE_COMPILER_MISMATCH',
    expected
      ? `Blueprint profile ${profile} is pinned to SQLcl ${expected.sqlcl} with MMD ${expected.mmd}; found ${found}.` +
          (matching.length ? ` The installed compiler matches ${matching.join(', ')}.` : '')
      : `Blueprint profile ${profile} is not a pinned Composer profile; found ${found}.`,
    5,
    'failed',
    {
      profile,
      expected: expected ? { sqlcl: expected.sqlcl, mmd: expected.mmd } : null,
      found: { sqlcl: version ?? null, mmd: actual.mmd.mmdVersion },
      matchingProfiles: matching,
      nextActions,
    },
  );
}
