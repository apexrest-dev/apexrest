import { parseDocument, isAlias, isMap, isSeq, isScalar } from 'yaml';
import { readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { contained, hash, exists } from '../fs.ts';
import { Fault } from '../result.ts';

/** Locale-independent keys, exact strings, ordered arrays, no volatile fields. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Fault('INVALID_DOCUMENT', 'Non-finite numbers are unsupported.', 2);
  const result = JSON.stringify(value);
  if (result === undefined) throw new Fault('INVALID_DOCUMENT', 'Undefined values are unsupported.', 2);
  return result;
}
export const documentText = (value: unknown) => JSON.stringify(JSON.parse(canonical(value)), null, 2) + '\n';
export const semanticDigest = (value: unknown) => hash(canonical(value));
export function parseDocumentData(source: string): unknown {
  if (Buffer.byteLength(source) > 1024 * 1024)
    throw new Fault('DOCUMENT_LIMIT', 'Document exceeds 1 MiB.', 2);
  const doc = parseDocument(source, {
    version: '1.2',
    schema: 'core',
    strict: true,
    uniqueKeys: true,
    keepSourceTokens: true,
  });
  // JSON-compatible scalars also permit plain identifiers in authoring YAML.
  const invalid = doc.errors;
  if (invalid.length || doc.warnings.length)
    throw new Fault(
      'INVALID_DOCUMENT',
      invalid
        .map((e) => e.message)
        .concat(doc.warnings.map((e) => e.message))
        .join('; '),
      2,
    );
  let count = 0;
  function inspect(node: unknown, depth: number) {
    if (++count > 10000 || depth > 64)
      throw new Fault('DOCUMENT_LIMIT', 'Document structure exceeds limits.', 2);
    if (isAlias(node)) throw new Fault('INVALID_DOCUMENT', 'Aliases are unsupported.', 2);
    if (node && typeof node === 'object' && 'tag' in node && node.tag)
      throw new Fault('INVALID_DOCUMENT', 'Explicit tags are unsupported.', 2);
    if (isMap(node))
      for (const pair of node.items) {
        if (
          !isScalar(pair.key) ||
          typeof pair.key.value !== 'string' ||
          ['__proto__', 'constructor', 'prototype', '<<'].includes(pair.key.value)
        )
          throw new Fault('INVALID_DOCUMENT', 'Unsafe or non-string mapping key.', 2);
        inspect(pair.value, depth + 1);
      }
    else if (isSeq(node)) for (const item of node.items) inspect(item, depth + 1);
    else if (isScalar(node) && typeof node.value === 'string' && node.value.length > 65536)
      throw new Fault('DOCUMENT_LIMIT', 'Scalar exceeds 64 KiB.', 2);
  }
  inspect(doc.contents, 0);
  const value = doc.toJS({ maxAliasCount: 0 });
  canonical(value);
  return value;
}
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Fault('COMPOSER_INVALID_INPUT', result.error.message, 2);
  return result.data;
}
export async function safePath(root: string, relative: string) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..'))
    throw new Fault('COMPOSER_PATH_UNSAFE', 'Expected a contained relative path.', 2);
  const file = await contained(root, relative);
  let probe = await realpath(root);
  for (const part of path.relative(probe, file).split(path.sep).filter(Boolean)) {
    probe = path.join(probe, part);
    let info;
    try {
      info = await lstat(probe);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (info) {
      if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
        throw new Fault('COMPOSER_PATH_UNSAFE', 'Symlinks and special files are unsupported.', 2);
    }
  }
  return file;
}
export async function readDocument<T>(root: string, file: string, schema: z.ZodType<T>) {
  return validate(schema, parseDocumentData(await readFile(await safePath(root, file), 'utf8')));
}
export function planDigest(plan: { digest?: string } & Record<string, unknown>) {
  const { digest: _digest, ...payload } = plan;
  return semanticDigest(payload);
}
