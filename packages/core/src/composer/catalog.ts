import path from 'node:path';
import { readFile, readdir, cp, mkdir } from 'node:fs/promises';
import { resourceRoot } from '../project.ts';
import { inventory, exists, hash } from '../fs.ts';
import { Fault } from '../result.ts';
import { blockSchema, evidenceSchema, rendererSchema, type Block } from './schemas.ts';
import { readDocument, semanticDigest, safePath, parseDocumentData, validate } from './formats.ts';

export interface Package {
  manifest: Block;
  digest: string;
  directory: string;
  files: Record<string, string>;
  evidence: unknown[];
}
export interface Catalog {
  generatorDigest: string;
  digest: string;
  packages: Map<string, Package>;
}
export async function loadCatalog(project?: string, cachePayloads = true): Promise<Catalog> {
  const root = path.join(resourceRoot(), 'blocks');
  const index = JSON.parse(await readFile(await safePath(root, 'manifest.json'), 'utf8')) as {
    schemaVersion: number;
    packages: { path: string; digest: string }[];
  };
  if (index.schemaVersion !== 1 || !Array.isArray(index.packages) || index.packages.length > 1000)
    throw new Fault('CATALOG_INVALID', 'Unsupported block registry.', 2);
  const generator = JSON.parse(await readFile(await safePath(root, 'generator.json'), 'utf8')) as {
    runtimeSourceDigest: string;
  };
  const revocations = JSON.parse(await readFile(await safePath(root, 'revocations.json'), 'utf8')) as {
    id: string;
    digest: string;
    reason: string;
  }[];
  if (!Array.isArray(revocations)) throw new Fault('CATALOG_INVALID', 'Invalid revocation registry.', 5);
  const packages = new Map<string, Package>();
  async function add(base: string, relative: string, expected?: string) {
    const directory = await safePath(base, relative),
      files = await inventory(directory),
      digest = semanticDigest(files);
    if (expected && expected !== digest)
      throw new Fault('PACKAGE_CORRUPT', 'Block package integrity check failed.', 5);
    if (project && cachePayloads) {
      const cache = await safePath(project, `.apexrest/composer/cache/${digest}`);
      if (!(await exists(cache))) {
        await mkdir(path.dirname(cache), { recursive: true, mode: 0o700 });
        await cp(directory, cache, { recursive: true, errorOnExist: true, force: false });
      }
      if (semanticDigest(await inventory(cache)) !== digest)
        throw new Fault('PACKAGE_CORRUPT', 'Cached immutable package changed.', 5);
    }
    const manifest = await readDocument(directory, 'block.yaml', blockSchema),
      key = manifest.id + '@' + manifest.version;
    if (expected && manifest.origin !== 'apexrest-dev/apexrest-codex')
      throw new Fault('ORIGIN_DENIED', 'Bundled block origin is outside registry policy.', 5);
    if (!expected && project) {
      const policyFile = await safePath(project, '.apexrest-composer/registry-policy.json');
      const policy = (await exists(policyFile))
        ? (JSON.parse(await readFile(policyFile, 'utf8')) as { reviewedPackages?: Record<string, string> })
        : { reviewedPackages: {} };
      if (policy.reviewedPackages?.[key] !== digest) manifest.status = 'draft';
      else if (manifest.status === 'draft') manifest.status = 'experimental';
    }
    if (packages.has(key))
      throw new Fault('MUTABLE_VERSION_CONFLICT', 'Duplicate block ID/version is unsupported.', 5);
    if (revocations.some((r) => r.id === key && r.digest === digest)) manifest.status = 'revoked';
    const descriptor = await readDocument(directory, 'renderer.json', rendererSchema);
    if (descriptor.renderer !== manifest.renderer)
      throw new Fault('PACKAGE_INVALID', 'Renderer contract differs from manifest.', 5);
    if (Object.keys(files).some((f) => /\.(?:m?js|cjs|sh|exe|dll|node|class|jar)$/i.test(f)))
      throw new Fault('PACKAGE_INVALID', 'Executable package hooks are prohibited.', 5);
    for (const file of manifest.source.files) {
      if (!files[file]) throw new Fault('PACKAGE_INVALID', 'Declared block source is absent.', 2);
      if (!/\.(?:apx|json)$/.test(file))
        throw new Fault('PACKAGE_INVALID', 'Executable hooks are unsupported.', 2);
    }
    const evidenceFile = await safePath(root, 'evidence/' + encodeURIComponent(key) + '.json');
    const evidence = (await exists(evidenceFile))
      ? validate(evidenceSchema.array().max(100), JSON.parse(await readFile(evidenceFile, 'utf8')))
      : [];
    packages.set(key, {
      manifest,
      digest,
      directory,
      files,
      evidence: evidence.map((e) => ({
        ...e,
        status:
          e.sourceDigest === digest && e.generatorDigest === generator.runtimeSourceDigest
            ? e.status
            : 'stale',
      })),
    });
  }
  for (const entry of [...index.packages].sort((a, b) => (a.path < b.path ? -1 : 1)))
    await add(root, entry.path, entry.digest);
  if (project && (await exists(await safePath(project, '.apexrest-composer/blocks')))) {
    const local = await safePath(project, '.apexrest-composer/blocks');
    for (const entry of (await readdir(local, { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      if (!entry.isDirectory())
        throw new Fault('PACKAGE_INVALID', 'Local blocks must be contained package directories.', 2);
      await add(local, entry.name);
    }
  }
  return {
    generatorDigest: generator.runtimeSourceDigest,
    packages,
    digest: semanticDigest({
      packages: [...packages].map(([key, p]) => [key, p.digest, p.manifest.status]),
      revocations,
      generator,
    }),
  };
}
export function resolvePackages(catalog: Catalog, selectors: string[], profile: string) {
  const result = new Map<string, Package>(),
    visiting = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) throw new Fault('DEPENDENCY_CYCLE', 'Block dependency cycle.', 5);
    if (result.has(key)) return;
    const pkg = catalog.packages.get(key);
    if (!pkg) throw new Fault('PACKAGE_NOT_AVAILABLE_OFFLINE', `Exact block ${key} is unavailable.`, 3);
    if (pkg.manifest.status === 'draft')
      throw new Fault(
        'PACKAGE_REVIEW_REQUIRED',
        'Review and pin local package integrity in registry-policy before planning.',
        5,
      );
    if (pkg.manifest.status === 'revoked' || !pkg.manifest.compatibility.profileRefs.includes(profile))
      throw new Fault(
        'BLOCK_INCOMPATIBLE',
        `Block ${key} is revoked or incompatible with the selected profile.`,
        5,
      );
    visiting.add(key);
    for (const dependency of [...pkg.manifest.requires.blocks].sort()) visit(dependency);
    visiting.delete(key);
    result.set(key, pkg);
  }
  for (const selector of [...selectors].sort()) visit(selector);
  return result;
}
export async function catalogSearch(
  query: string,
  options: {
    project?: string | undefined;
    corpus?: string | undefined;
    offset?: number | undefined;
    limit?: number | undefined;
    version?: string | undefined;
    profile?: string | undefined;
    status?: string | undefined;
    locale?: string | undefined;
    cursor?: string | undefined;
  } = {},
) {
  if (options.corpus === 'blueprints') {
    const root = path.join(resourceRoot(), 'blueprints'),
      entries = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8')) as {
        id: string;
        title: string;
        path: string;
      }[];
    const hits = entries.filter((e) => (e.id + ' ' + e.title).toLowerCase().includes(query.toLowerCase()));
    return {
      totalMatches: hits.length,
      results: hits.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 3)),
      nextResultOffset:
        hits.length > (options.offset ?? 0) + (options.limit ?? 3)
          ? (options.offset ?? 0) + (options.limit ?? 3)
          : null,
    };
  }
  const catalog = await loadCatalog(options.project, false),
    terms = query.normalize('NFKC').toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  if (options.cursor && options.cursor !== catalog.digest)
    throw new Fault('CATALOG_CURSOR_STALE', 'Catalog changed; restart discovery.', 5);
  const scored = [...catalog.packages]
    .map(([id, p]) => {
      const body = [id, p.manifest.name, ...p.manifest.aliases]
        .join(' ')
        .normalize('NFKC')
        .toLocaleLowerCase('en');
      return { id, p, score: (id === query ? 1000 : 0) + terms.filter((t) => body.includes(t)).length };
    })
    .filter(
      (e) =>
        e.score &&
        (!options.version || e.p.manifest.version === options.version) &&
        (!options.status || e.p.manifest.status === options.status) &&
        (!options.profile || e.p.manifest.compatibility.profileRefs.includes(options.profile)),
    )
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const offset = options.offset ?? 0,
    limit = options.limit ?? 3;
  return {
    totalMatches: scored.length,
    catalogDigest: catalog.digest,
    cursor: catalog.digest,
    results: scored.slice(offset, offset + limit).map(({ id, p, score }) => ({
      id,
      title: p.manifest.name,
      kind: 'template',
      version: p.manifest.version,
      status: p.manifest.status === 'verified' ? 'experimental' : p.manifest.status,
      declaredStatus: p.manifest.status,
      qualification: 'runtime-not-run',
      compatibility: options.profile ? 'compatible' : 'unknown',
      requiredInputs: p.manifest.ports.inputs,
      effects: p.manifest.effects,
      evidence: p.evidence,
      reasons: ['lexical-match', ...(score >= 1000 ? ['exact-id'] : [])],
      sha256: p.digest,
      limitations: p.manifest.limitations,
    })),
    nextResultOffset: offset + limit < scored.length ? offset + limit : null,
  };
}
export async function catalogRead(id: string, offset = 0, limit = 4096, project?: string) {
  let content: string;
  if (id.startsWith('blueprint:')) {
    const root = path.join(resourceRoot(), 'blueprints'),
      index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8')) as {
        id: string;
        path: string;
      }[];
    const entry = index.find((e) => e.id === id);
    if (!entry) throw new Fault('REFERENCE_NOT_FOUND', 'Unknown blueprint.', 2);
    content = await readFile(await safePath(root, entry.path), 'utf8');
  } else {
    const [selector, sourcePath] = id.split('/source/');
    const pkg = (await loadCatalog(project, false)).packages.get(selector!);
    if (!pkg) throw new Fault('REFERENCE_NOT_FOUND', 'Unknown exact block version.', 2);
    if (sourcePath) {
      if (!pkg.manifest.source.files.includes(sourcePath))
        throw new Fault('REFERENCE_NOT_FOUND', 'Source is outside declared package payload.', 2);
      content = await readFile(await safePath(pkg.directory, sourcePath), 'utf8');
    } else
      content = JSON.stringify(
        { manifest: pkg.manifest, digest: pkg.digest, files: pkg.files, evidence: pkg.evidence },
        null,
        2,
      );
  }
  return {
    id,
    title: id,
    version: id.split('@')[1] ?? '1',
    source: 'bundled-composer-catalog',
    offset,
    length: content.length,
    requires: [] as string[],
    related: [] as string[],
    relatedCount: 0,
    relatedOmittedCount: 0,
    classification: 'untrusted_catalog_content',
    sha256: hash(content),
    content: content.slice(offset, offset + limit),
    nextOffset: offset + limit < content.length ? offset + limit : null,
    dataClassification: 'untrusted_catalog_content',
  };
}
export async function validateAuthoredBlock(directory: string) {
  const manifest = await readDocument(directory, 'block.yaml', blockSchema),
    files = await inventory(directory);
  for (const file of Object.keys(files)) {
    const bytes = await readFile(await safePath(directory, file), 'utf8');
    if (
      /\/Users\/|https?:\/\/[^\s]+\/ords|password\s*[:=]|BEGIN.*PRIVATE KEY|\b(?:applicationId|workspaceId):\s*\d+/i.test(
        bytes,
      )
    )
      throw new Fault('PRIVATE_SOURCE', 'Captured block contains source-specific private data.', 5);
    if (file.endsWith('.json')) parseDocumentData(bytes);
  }
  return { manifest, digest: semanticDigest(files), qualification: 'draft', files };
}
