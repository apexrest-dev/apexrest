import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { contained, exists, readJson, writeJson, atomicWrite, hash } from './fs.ts';
import type { ProjectContext } from './config.ts';
import { parse, managedHome } from './config.ts';
import { Fault, redact, sanitized, artifactPage } from './result.ts';
export class ArtifactService {
  constructor(private ctx: ProjectContext) {}
  async save(content: string, kind: string) {
    return this.persist(redact(content), kind, 'text');
  }
  async saveJson(value: unknown, kind: string) {
    return this.persist(JSON.stringify(sanitized(value)), kind, 'json');
  }
  private async resultDirectory(create = false) {
    const home = managedHome();
    if (create) await mkdir(home, { recursive: true, mode: 0o700 });
    if (!(await exists(home))) return null;
    return contained(home, path.join('results', hash(this.ctx.root)));
  }
  private async persist(content: string, kind: string, format: 'text' | 'json') {
    const id = randomUUID(),
      // Automatic MCP result archives must never follow a project-configured
      // artifact directory into application or database source trees.
      directory =
        format === 'json'
          ? (await this.resultDirectory(true))!
          : await contained(this.ctx.root, this.ctx.config.artifacts.directory);
    await atomicWrite(path.join(directory, id + '.txt'), content);
    await writeJson(path.join(directory, id + '.json'), {
      id,
      kind,
      sha256: hash(content),
      format,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.ctx.config.artifacts.retentionDays * 86400000).toISOString(),
      classification: 'private-sanitized-text',
    });
    return id;
  }
  async read(id: string, offset = 0, limit = 4096) {
    parse(z.uuid(), id);
    parse(z.number().int().min(0).max(10000000), offset);
    parse(z.number().int().min(1).max(16384), limit);
    const results = await this.resultDirectory();
    const directory =
      results && (await exists(path.join(results, id + '.json')))
        ? results
        : await contained(this.ctx.root, this.ctx.config.artifacts.directory);
    const metadata = (await readJson(await contained(directory, id + '.json'))) as {
      expiresAt: string;
      sha256: string;
      kind: string;
      format?: 'text' | 'json';
    };
    if (Date.parse(metadata.expiresAt) < Date.now())
      throw new Fault('ARTIFACT_EXPIRED', 'Artifact retention has expired.', 3);
    if (/auth|wallet|credential/i.test(metadata.kind))
      throw new Fault(
        'PRIVATE_ARTIFACT_DENIED',
        'Authentication and credential artifacts cannot be read through tools.',
        4,
      );
    const content = await readFile(await contained(directory, id + '.txt'), 'utf8');
    if (hash(content) !== metadata.sha256)
      throw new Fault('ARTIFACT_CHANGED', 'Artifact integrity check failed.', 5);
    return artifactPage(content, metadata.format ?? 'text', id, offset, limit);
  }
  // `results` limits pruning to the managed MCP result archive, so automatic
  // cleanup never scans a project-configured directory.
  async prune(scope: 'all' | 'results' = 'all') {
    const directories = [
      ...(scope === 'all' ? [await contained(this.ctx.root, this.ctx.config.artifacts.directory)] : []),
      await this.resultDirectory(),
    ];
    let removed = 0;
    for (const directory of directories) {
      if (!directory || !(await exists(directory))) continue;
      // Durable working-copy/backup/import sources are never result archives.
      const relative = path.relative(this.ctx.root, directory).split(path.sep).join('/');
      if (
        ['.apexrest/sync', '.apexrest/backups', '.apexrest/deployments', '.apexrest/plans'].some(
          (root) => relative === root || relative.startsWith(root + '/'),
        )
      )
        continue;
      for (const file of await readdir(directory))
        if (/^[a-f0-9-]{36}\.json$/.test(file)) {
          // One unreadable record must not stop cleanup of the others.
          const metadata = (await readJson(path.join(directory, file)).catch(() => null)) as {
            expiresAt?: string;
          } | null;
          if (typeof metadata?.expiresAt === 'string' && Date.parse(metadata.expiresAt) < Date.now()) {
            await rm(path.join(directory, file));
            await rm(path.join(directory, file.replace('.json', '.txt')), { force: true });
            removed++;
          }
        }
    }
    return { removed };
  }
}
