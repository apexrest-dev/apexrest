import path from 'node:path';
import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { z } from 'zod';
import { canonical, contained, hash, inventory, readJson } from './fs.ts';
import { relativePath, type ProjectContext } from './config.ts';
import { checkSnapshot, privateCopy, snapshotSchema, syncPath, type SourceSnapshot } from './sync.ts';
import { Fault } from './result.ts';
import { APEXLANG_EQUIVALENCE_POLICY } from './apexlang-equivalence.ts';

export interface ImportOptions {
  importMode?: 'auto' | 'full' | 'files';
  files?: string[];
}
export const importSelectionSchema = z.strictObject({
  requestedMode: z.enum(['auto', 'full', 'files']),
  resolvedMode: z.enum(['full', 'files']),
  files: z.array(relativePath),
  reasons: z.array(z.string()),
  dependencies: z.array(relativePath),
  before: snapshotSchema.nullable(),
  effective: snapshotSchema.nullable(),
  capabilities: z.record(z.string(), z.unknown()),
  readbackPolicy: z.literal(APEXLANG_EQUIVALENCE_POLICY).optional(),
  exportScope: z.enum(['selected', 'full']).optional(),
});
export type ImportSelection = z.infer<typeof importSelectionSchema>;
export function importOptions(value: ImportOptions = {}): Required<ImportOptions> {
  const mode = value.importMode ?? 'auto';
  if ((value.files?.length ?? 0) > 1000)
    throw new Fault('INVALID_INPUT', 'Select at most 1000 files in one import.', 2);
  if (!['auto', 'full', 'files'].includes(mode)) throw new Fault('INVALID_INPUT', 'Unknown import mode.', 2);
  if ((mode === 'files') !== !!value.files?.length)
    throw new Fault(
      'INVALID_INPUT',
      'files mode requires a nonempty file list; other modes do not accept files.',
      2,
    );
  const files = (value.files ?? []).map((file) => {
    if (
      !relativePath.safeParse(file).success ||
      /[\\*?\[\]]/.test(file) ||
      /^[A-Za-z]:/.test(file) ||
      file.startsWith('-') ||
      path.posix.normalize(file) !== file ||
      file === '.'
    )
      throw new Fault(
        'IMPORT_FILE_UNSAFE',
        'Use normalized application-relative file paths without globs.',
        2,
      );
    return file;
  });
  if (new Set(files).size !== files.length)
    throw new Fault('IMPORT_FILE_UNSAFE', 'Duplicate import files are not allowed.', 2);
  return { importMode: mode, files: files.sort() };
}
export async function sourceRelease(root: string): Promise<string | null> {
  try {
    const value = (await readJson(path.join(root, '.apex/apexlang.json'))) as { mmdVersion?: unknown };
    return typeof value.mmdVersion === 'string' ? (value.mmdVersion.match(/^\d+\.\d+/)?.[0] ?? null) : null;
  } catch {
    return null;
  }
}
/** Deliberately bounded to the two qualified APEX streams, not future releases. */
export function supportedFile(file: string) {
  return (
    /^pages\/p\d{5}[-\w]*\.apx$/.test(file) ||
    (/^shared-components\/.+\.apx$/.test(file) &&
      !/(?:^|\/)(?:themes?|templates?|plugins?|plug-ins?|static-files|files|authentications?|authorizations?)(?:[/.]|$)/i.test(
        file,
      ))
  );
}
/** Native page selectors have a qualified one-file identity mapping. Oracle 26.2 rejects APEXlang LOV/list selectors. */
export function scopedExportFile(file: string) {
  return /^pages\/p\d{5}[-\w]*\.apx$/.test(file);
}
export function pickFiles(files: FileMap, selected: readonly string[]): FileMap {
  return Object.fromEntries(selected.filter((file) => files[file]).map((file) => [file, files[file]!]));
}
/** Retain local dependency context; only selected files are observed on the server. */
export async function overlaySelection(
  source: string,
  exported: string,
  files: readonly string[],
  destination: string,
) {
  await privateCopy(source, destination);
  const observed = await inventory(exported);
  for (const file of files) {
    const target = await contained(destination, file);
    if (!observed[file]) await rm(target, { force: true });
    else {
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await cp(await contained(exported, file), target);
    }
  }
  return destination;
}
export type FileMap = Record<string, string>;
export function changedFiles(before: FileMap, after: FileMap) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((file) => before[file] !== after[file])
    .sort();
}
/** B→L expresses intent; B→R expresses other editors' work. L→R is not intent. */
export function selectImport(base: FileMap, local: FileMap, remote: FileMap, options: ImportOptions) {
  const requested = importOptions(options);
  const localChanges = changedFiles(base, local);
  const remoteChanges = changedFiles(base, remote);
  const selected = requested.importMode === 'files' ? requested.files : localChanges;
  for (const file of selected)
    if (!Object.hasOwn(local, file) && requested.importMode === 'files')
      throw new Fault('IMPORT_FILE_MISSING', `Selected file is missing: ${file}`, 2);
  const conflicts = localChanges.filter(
    (file) => remoteChanges.includes(file) && local[file] !== remote[file],
  );
  if (conflicts.length)
    throw new Fault(
      'IMPORT_CONFLICT',
      'Local and server changes overlap; reconcile before planning.',
      5,
      'blocked',
      { conflicts },
    );
  const reasons: string[] = [];
  if (selected.some((file) => !Object.hasOwn(local, file))) reasons.push('deleted-files-require-full-import');
  if (selected.some((file) => !supportedFile(file))) reasons.push('unsupported-component-files');
  const files = selected.filter((file) => local[file] !== remote[file]);
  if (!files.length) reasons.push('no-changed-files');
  const effective = { ...remote };
  for (const file of files) {
    if (local[file]) effective[file] = local[file]!;
    else delete effective[file];
  }
  return { files, reasons, remoteChanges, effective: Object.fromEntries(Object.entries(effective).sort()) };
}
export async function persistSnapshot(
  ctx: ProjectContext,
  source: string,
  directory: string,
): Promise<SourceSnapshot> {
  const destination = await syncPath(ctx, directory);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await privateCopy(source, destination);
  const files = await inventory(destination);
  return { directory, files, digest: hash(canonical(files)) };
}
export async function stageSelection(
  ctx: ProjectContext,
  before: SourceSnapshot,
  localRoot: string,
  files: string[],
  expected: FileMap,
  directory: string,
) {
  const root = await syncPath(ctx, directory);
  await mkdir(path.dirname(root), { recursive: true, mode: 0o700 });
  await privateCopy(await syncPath(ctx, before.directory), root);
  for (const file of files) {
    const destination = await contained(root, file);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await cp(await contained(localRoot, file), destination);
  }
  const actual = await inventory(root);
  if (canonical(actual) !== canonical(expected))
    throw new Fault('SOURCE_DRIFT', 'Source changed while preparing the selected import.', 5);
  return { directory, files: actual, digest: hash(canonical(actual)) };
}
/** Rebase the live result without turning unselected local work into deployed work. */
export async function rebaseAfterImport(
  ctx: ProjectContext,
  runId: string,
  reviewedLocal: FileMap,
  before: FileMap,
  server: SourceSnapshot,
  selected: string[],
) {
  await checkSnapshot(ctx, server);
  const localRoot = await syncPath(ctx, ctx.config.application.sourceDir);
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      'LOCAL_RECONCILIATION_REQUIRED',
      'Import confirmed; local files changed during execution. Reconcile them before another import.',
      5,
    );
  const base = '.apexrest/deployments/' + runId;
  const replacement = await syncPath(ctx, base + '/rebased-source');
  const retained = await syncPath(ctx, base + '/local-before-rebase');
  await privateCopy(localRoot, replacement);
  const remoteOnly = changedFiles(before, server.files).filter(
    (file) => selected.includes(file) || reviewedLocal[file] === before[file],
  );
  // Also selected files may be normalized by the compiler/exporter.
  for (const file of new Set([...remoteOnly, ...selected])) {
    const destination = await contained(replacement, file);
    if (!server.files[file]) await rm(destination, { force: true });
    else {
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(await contained(await syncPath(ctx, server.directory), file), destination);
    }
  }
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      'LOCAL_RECONCILIATION_REQUIRED',
      'Import confirmed; concurrent local edits prevented rebase.',
      5,
    );
  await rename(localRoot, retained);
  // Check the actual retained directory too: never discard an edit racing the rename.
  if (canonical(await inventory(retained)) !== canonical(reviewedLocal)) {
    await rename(retained, localRoot);
    throw new Fault(
      'LOCAL_RECONCILIATION_REQUIRED',
      'Import confirmed; concurrent local edits were preserved.',
      5,
    );
  }
  try {
    await rename(replacement, localRoot);
  } catch (error) {
    await rename(retained, localRoot);
    throw error;
  }
}
