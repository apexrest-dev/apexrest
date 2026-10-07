import { APEX_262_PROFILE } from '../compatibility.ts';
import { Fault } from '../result.ts';

export const COMPOSER_262_PROFILE = 'profile:apex262-ut262-mmd3479';
export const composerProfiles: Record<string, { mmd: string; sqlcl: string }> = {
  'profile:apex261-ut261-mmd3102': { mmd: '26.1.0+3102', sqlcl: '26.1.2.132.1334' },
  [COMPOSER_262_PROFILE]: { mmd: APEX_262_PROFILE.mmd, sqlcl: APEX_262_PROFILE.sqlcl },
};

export function requireComposerCompiler(
  profile: string,
  actual: { mmd: { mmdVersion: string }; compiler: { version: string } },
) {
  const expected = composerProfiles[profile],
    version = /\bBuild:? (\d+(?:\.\d+)+)\b/.exec(actual.compiler.version)?.[1];
  if (!expected || actual.mmd.mmdVersion !== expected.mmd || version !== expected.sqlcl)
    throw new Fault(
      'PROFILE_COMPILER_MISMATCH',
      'Real compiler/MMD differs from the selected pinned Composer profile.',
      5,
    );
}
