import path from 'node:path';
import { z } from 'zod';
import type { ProjectContext } from './config.ts';
import { contained, exists, readJson } from './fs.ts';
import { scopedExportFile } from './partial-import.ts';

/**
 * How a file-selection plan observes the server: one native export per selected page, or one full
 * APEXlang export from which only the reviewed files are extracted (oracle.ts exportSelection).
 * The import file set, conflict comparison, backup scope and verification are the same for both;
 * the strategy only decides which export calls produce the selected artifacts.
 *
 * The choice uses an explicitly written measurement profile of the same target, application,
 * APEX release and compiler (`.apexrest/export-profiles/<target digest>.json`, written by a
 * user-invoked measurement, never in the background). Without a usable profile (missing, stale,
 * incompatible or unreadable) the deterministic fallback is the per-page export, as before. The
 * plan binds the chosen scope: a later profile change cannot alter a reviewed plan.
 */
export const exportProfileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  targetDigest: z.string(),
  applicationId: z.union([z.number(), z.string()]),
  apexVersion: z.string(),
  compilerVersion: z.string(),
  /** Median wall time of one single-page APEXlang export call. */
  pageExportMs: z.number().positive(),
  /** Median wall time of one full APEXlang application export. */
  fullExportMs: z.number().positive(),
  measuredAt: z.string(),
  source: z.string().min(1).max(200),
});
export type ExportProfile = z.infer<typeof exportProfileSchema>;
export const PROFILE_MAX_AGE_DAYS = 30;

export interface ObservationStrategy {
  exportScope: 'selected' | 'full';
  strategy: 'page-exports' | 'full-export-extraction';
  reason: string;
  provenance:
    | { kind: 'required' }
    | { kind: 'fallback'; profile: 'missing' | 'stale' | 'incompatible' | 'unreadable' }
    | {
        kind: 'profile';
        file: string;
        measuredAt: string;
        pageExportMs: number;
        fullExportMs: number;
        estimatedPageExportsMs: number;
      };
}

export const profileFile = (targetDigest: string) =>
  path.posix.join('.apexrest/export-profiles', `${targetDigest}.json`);

export async function readExportProfile(ctx: ProjectContext, targetDigest: string) {
  const relative = profileFile(targetDigest);
  const file = await contained(ctx.root, relative);
  if (!(await exists(file))) return { status: 'missing' as const, relative };
  const parsed = exportProfileSchema.safeParse(await readJson(file).catch(() => undefined));
  return parsed.success
    ? { status: 'found' as const, relative, profile: parsed.data }
    : { status: 'unreadable' as const, relative };
}

export function chooseObservation(input: {
  files: string[];
  targetDigest: string;
  applicationId: number | string;
  apexVersion: string;
  compilerVersion: string;
  profile: Awaited<ReturnType<typeof readExportProfile>>;
  now?: number;
}): ObservationStrategy {
  // Shared components have no single-component export: their observation is always full.
  if (!input.files.every(scopedExportFile))
    return {
      exportScope: 'full',
      strategy: 'full-export-extraction',
      reason: 'shared-components-require-full-apexlang-observation',
      provenance: { kind: 'required' },
    };
  const fallback = (profile: 'missing' | 'stale' | 'incompatible' | 'unreadable'): ObservationStrategy => ({
    exportScope: 'selected',
    strategy: 'page-exports',
    reason: `no usable export profile (${profile}); per-page exports`,
    provenance: { kind: 'fallback', profile },
  });
  if (input.profile.status !== 'found') return fallback(input.profile.status);
  const { profile, relative } = input.profile;
  if (
    profile.targetDigest !== input.targetDigest ||
    String(profile.applicationId) !== String(input.applicationId) ||
    profile.apexVersion !== input.apexVersion ||
    profile.compilerVersion !== input.compilerVersion
  )
    return fallback('incompatible');
  const age = (input.now ?? Date.now()) - Date.parse(profile.measuredAt);
  if (!Number.isFinite(age) || age < 0 || age > PROFILE_MAX_AGE_DAYS * 86_400_000) return fallback('stale');
  const estimatedPageExportsMs = input.files.length * profile.pageExportMs;
  const full = profile.fullExportMs < estimatedPageExportsMs;
  return {
    exportScope: full ? 'full' : 'selected',
    strategy: full ? 'full-export-extraction' : 'page-exports',
    reason: `${input.files.length} page export(s) estimated at ${Math.round(estimatedPageExportsMs)} ms against one full export at ${Math.round(profile.fullExportMs)} ms`,
    provenance: {
      kind: 'profile',
      file: relative,
      measuredAt: profile.measuredAt,
      pageExportMs: profile.pageExportMs,
      fullExportMs: profile.fullExportMs,
      estimatedPageExportsMs,
    },
  };
}

/**
 * The selected files of a full export: each selected page by its page id (so a renamed alias maps
 * to the reviewed file name), each other file by its path; absent ones stay absent. Unrelated files
 * of the export are never included.
 */
export function extractSelected(exported: Record<string, string>, selected: string[]) {
  const picked: Record<string, string> = {};
  for (const file of selected) {
    const pageId = /^pages\/p(\d{5})/.exec(file)?.[1];
    const matches = Object.keys(exported).filter((candidate) =>
      pageId ? /^pages\/p(\d{5})/.exec(candidate)?.[1] === pageId : candidate === file,
    );
    if (matches.length > 1) throw new Error(`Export has duplicate selected identities for ${file}.`);
    if (matches.length) picked[file] = matches[0]!;
  }
  return picked;
}
