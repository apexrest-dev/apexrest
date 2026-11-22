import path from 'node:path';
import { hostname } from 'node:os';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { z } from 'zod';
import { managedHome, parse } from './config.ts';
import type { Environment } from './config.ts';
import { canonical, exists, hash, readJson, withLock, writeJson } from './fs.ts';
import { Fault } from './result.ts';

/**
 * Deployment coordination is always the local durable store: a lease and
 * migration history under the managed home, scoped to the database identity
 * and parsing schema. It serializes runners sharing one managed home only;
 * independent machines or homes need external serialization.
 */
export function coordination(env: Environment) {
  return {
    backend: 'local' as const,
    scope: 'managed-home-schema' as const,
    // Bind plans to the history store. Moving a plan to a fresh home is not migration recovery.
    storeDigest: hash(canonical({ home: managedHome(), ...env.databaseIdentity, schema: env.parsingSchema })),
  };
}
const ownerSchema = z.strictObject({
  runId: z.string(),
  pid: z.number().int().positive(),
  hostname: z.string(),
  phase: z.enum(['preparing', 'writing']),
  createdAt: z.string(),
});
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const serviceBindingSchema = z.strictObject({ serviceName: z.string().min(1), directory: digestSchema });
const packagesSchema = z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/));
const schemaInstanceSchema = z.strictObject({ created: z.string().min(1) });
const historySchema = z.array(
  z.strictObject({
    version: z.string(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(['started', 'succeeded']),
    run_id: z.string(),
  }),
);

/** A private durable control store. It creates no Oracle objects and grants no authorization. */
export class LocalDeploymentControl {
  readonly directory: string;
  private readonly serviceBinding: string;
  private readonly serviceName: string;
  private readonly root: string;
  constructor(env: Environment) {
    const { dbUniqueName, serviceName } = env.databaseIdentity;
    const schema = env.parsingSchema;
    this.root = path.join(managedHome(), 'deployment-control');
    // Keep the legacy service-specific paths for existing owners, plans and migration history.
    this.directory = path.join(this.root, hash(canonical({ dbUniqueName, serviceName, schema })));
    this.serviceName = serviceName;
    this.serviceBinding = path.join(
      this.root,
      'schema-services',
      hash(canonical({ dbUniqueName, schema })) + '.json',
    );
  }
  file(name: string) {
    return path.join(this.directory, name);
  }
  private async hasScriptHistory(directory: string) {
    const history = path.join(directory, 'history.json');
    const packages = path.join(directory, 'packages.json');
    return (
      ((await exists(history)) && parse(historySchema, await readJson(history)).length > 0) ||
      ((await exists(packages)) && Object.keys(parse(packagesSchema, await readJson(packages))).length > 0)
    );
  }
  /** Register a known original store after a read-only plan has verified its target. */
  async registerExisting() {
    if (await this.hasScriptHistory(this.directory)) await this.checkService(true);
  }
  private async checkService(bind = false) {
    const check = async () => {
      let binding: z.infer<typeof serviceBindingSchema> | undefined;
      try {
        binding = parse(serviceBindingSchema, await readJson(this.serviceBinding));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const directory = path.basename(this.directory);
      if (binding && (binding.serviceName !== this.serviceName || binding.directory !== directory))
        throw new Fault(
          'CONTROL_SERVICE_CHANGED',
          'This database name and schema already use a different Oracle service in the managed deployment store. Use the existing service to preserve migration history and reconcile interrupted runs.',
          5,
          'conflict',
        );
      if (!bind || binding) return;
      // A pre-upgrade directory hash does not reveal its database/service. An
      // unknown store could belong to this database under another service name.
      const bindings = path.dirname(this.serviceBinding);
      const recognized = new Set([directory]);
      for (const file of (await readdir(bindings)).filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
        recognized.add(parse(serviceBindingSchema, await readJson(path.join(bindings, file))).directory);
      }
      const knownHistory = await this.hasScriptHistory(this.directory);
      let unregisteredHistory = false;
      for (const entry of await readdir(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !digestSchema.safeParse(entry.name).success || recognized.has(entry.name))
          continue;
        const legacy = path.join(this.root, entry.name);
        if (await exists(path.join(legacy, 'active.json')))
          throw new Fault(
            'LEGACY_CONTROL_OWNER_UNRESOLVED',
            'An older deployment store still has active ownership. Resolve that run using its original service before binding a different store.',
            5,
            'conflict',
          );
        if (!knownHistory && !unregisteredHistory) unregisteredHistory = await this.hasScriptHistory(legacy);
      }
      if (unregisteredHistory)
        throw new Fault(
          'LEGACY_CONTROL_HISTORY_UNREGISTERED',
          'An older deployment store has unregistered migration or package history. Run a full read-only deployment plan for each original environment using its original Oracle service before binding a new store.',
          5,
          'conflict',
        );
      await writeJson(this.serviceBinding, { serviceName: this.serviceName, directory });
    };
    if (bind) await withLock(path.join(path.dirname(this.serviceBinding), 'bindings.lock'), check);
    else await check();
  }
  /**
   * Binds the local history to one instance of the parsing schema, identified by its creation time
   * (UTC, from the target identity query). A schema that was dropped and created again, or a
   * database rebuilt with the same name, service and schema, starts with no migrations: the
   * history recorded for the earlier instance is provably not on it and is moved aside instead of
   * silently skipping migrations. A store without a recorded instance is adopted unless the
   * schema was created after its history was last written. Nothing is replayed or deleted.
   */
  async reconcileSchemaInstance(created: string): Promise<{ archived?: string }> {
    if (!(await exists(this.directory))) return {};
    return withLock(this.file('control.lock'), async () => {
      const record = this.file('schema-instance.json');
      const recorded = (await exists(record))
        ? parse(schemaInstanceSchema, await readJson(record)).created
        : undefined;
      if (recorded === created) return {};
      const scripts = ['history.json', 'packages.json'].map((name) => this.file(name));
      let stale = recorded !== undefined;
      if (!stale && (await this.hasScriptHistory(this.directory))) {
        let written = 0;
        for (const file of scripts)
          if (await exists(file)) written = Math.max(written, (await stat(file)).mtimeMs);
        const createdAt = Date.parse(created);
        stale = Number.isFinite(createdAt) && createdAt > written;
      }
      if (!stale || !(await this.hasScriptHistory(this.directory))) {
        await writeJson(record, { created });
        return {};
      }
      // A run that took ownership after the schema was created belongs to the new schema: its own
      // history rows stay; one that started before it must be reconciled against the old schema.
      const owner = await this.owner();
      if (owner && !(Date.parse(owner.createdAt) >= Date.parse(created)))
        throw new Fault(
          'CONTROL_SCHEMA_RECREATED',
          'The parsing schema was created again after a deployment run took ownership of its local history. Reconcile that run before deploying to the new schema.',
          5,
          'conflict',
        );
      const archive = this.file(
        `archived-schema-${(recorded ?? 'unrecorded').replace(/[^0-9A-Za-z]/gu, '')}-${Date.now()}`,
      );
      await mkdir(archive, { recursive: true, mode: 0o700 });
      const historyFile = this.file('history.json');
      const rows = (await exists(historyFile)) ? parse(historySchema, await readJson(historyFile)) : [];
      for (const file of scripts)
        if (await exists(file)) await rename(file, path.join(archive, path.basename(file)));
      const current = owner ? rows.filter((row) => row.run_id === owner.runId) : [];
      if (current.length) await writeJson(historyFile, current);
      await writeJson(record, { created });
      return { archived: archive };
    });
  }
  async history() {
    await this.checkService();
    const file = this.file('history.json');
    return (await exists(file)) ? parse(historySchema, await readJson(file)) : [];
  }
  /**
   * Checksum of each package script last applied successfully, by project-relative file. Package
   * scripts are re-runnable, so a plan only re-applies the ones that changed since then.
   */
  async packages(projectId: string): Promise<Record<string, string>> {
    await this.checkService();
    const file = this.file('packages.json');
    const all = (await exists(file)) ? parse(packagesSchema, await readJson(file)) : {};
    const prefix = projectId + ':';
    return Object.fromEntries(
      Object.entries(all)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, sha]) => [key.slice(prefix.length), sha]),
    );
  }
  async packageApplied(runId: string, projectId: string, file: string, checksum: string) {
    await withLock(this.file('control.lock'), async () => {
      await this.assertOwner(runId);
      const target = this.file('packages.json');
      const all = (await exists(target)) ? parse(packagesSchema, await readJson(target)) : {};
      all[projectId + ':' + file] = checksum;
      await writeJson(target, Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))));
    });
  }
  async owner() {
    await this.checkService();
    const file = this.file('active.json');
    try {
      return parse(ownerSchema, await readJson(file));
    } catch (error) {
      // A completed runner may remove the lease while a read-only status check
      // observes it. Corrupt or inaccessible leases must still fail closed.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }
  async acquire(runId: string, bindService = true) {
    await this.checkService(bindService);
    await withLock(this.file('control.lock'), async () => {
      const owner = await this.owner();
      if (owner) {
        let dead = false;
        if (owner.hostname === hostname()) {
          try {
            process.kill(owner.pid, 0);
          } catch (e) {
            dead = (e as NodeJS.ErrnoException).code === 'ESRCH';
          }
        }
        if (!dead || owner.phase === 'writing')
          throw new Fault(
            'TARGET_LOCKED',
            'A runner owns this schema or an interrupted write needs reconciliation. Preserve its control state.',
            5,
            'conflict',
          );
      }
      await writeJson(this.file('active.json'), {
        runId,
        pid: process.pid,
        hostname: hostname(),
        phase: 'preparing',
        createdAt: new Date().toISOString(),
      });
    });
  }
  async assertOwner(runId: string) {
    const owner = await this.owner();
    if (owner?.runId !== runId || owner.pid !== process.pid || owner.hostname !== hostname())
      throw new Fault(
        'LEASE_LOST',
        'Local deployment ownership is no longer confirmed.',
        6,
        'outcome_unknown',
      );
    return owner;
  }
  async markWriting(runId: string) {
    await withLock(this.file('control.lock'), async () => {
      await writeJson(this.file('active.json'), { ...(await this.assertOwner(runId)), phase: 'writing' });
    });
  }
  async migration(runId: string, version: string, checksum: string, status: 'started' | 'succeeded') {
    await withLock(this.file('control.lock'), async () => {
      await this.assertOwner(runId);
      const history = await this.history(),
        previous = history.find((row) => row.version === version);
      if (
        status === 'started'
          ? Boolean(previous)
          : !previous ||
            previous.run_id !== runId ||
            previous.checksum !== checksum ||
            previous.status !== 'started'
      )
        throw new Fault(
          'MIGRATION_HISTORY_CONFLICT',
          'Migration history requires reconciliation; it cannot be replayed or overwritten.',
          5,
        );
      const next = history.filter((row) => row.version !== version);
      next.push({ version, checksum, status, run_id: runId });
      await writeJson(
        this.file('history.json'),
        next.sort((a, b) => a.version.localeCompare(b.version)),
      );
    });
  }
  async release(runId: string) {
    await withLock(this.file('control.lock'), async () => {
      await this.assertOwner(runId);
      await rm(this.file('active.json'));
    });
  }
  /**
   * Applies a human-confirmed database reconciliation of one held run (deploy-reconcile.ts):
   * records what the person stated about each of the run's scripts, then releases the run's
   * ownership. Only the run that owns the store, on this host, with its process gone.
   */
  async reconcileRun(
    runId: string,
    projectId: string,
    statements: {
      kind: 'migration' | 'package';
      file: string;
      version: string;
      checksum: string;
      applied: boolean;
    }[],
  ) {
    await this.checkService();
    return withLock(this.file('control.lock'), async () => {
      const owner = await this.owner();
      if (!owner || owner.runId !== runId)
        throw new Fault(
          'RUN_NOT_OWNER',
          'This run does not hold the deployment ownership of the target.',
          5,
          'conflict',
        );
      if (owner.hostname !== hostname())
        throw new Fault(
          'RUN_ON_OTHER_HOST',
          'The run was started on another host; reconcile it there.',
          5,
          'conflict',
        );
      let alive = true;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        alive = (error as NodeJS.ErrnoException).code !== 'ESRCH';
      }
      if (alive && owner.pid !== process.pid)
        throw new Fault(
          'RUN_STILL_ALIVE',
          'The process of this run is still alive; wait for its terminal result.',
          5,
          'conflict',
        );
      const historyFile = this.file('history.json');
      let history = (await exists(historyFile)) ? parse(historySchema, await readJson(historyFile)) : [];
      const packagesFile = this.file('packages.json');
      const packages = (await exists(packagesFile))
        ? parse(packagesSchema, await readJson(packagesFile))
        : {};
      for (const statement of statements) {
        if (statement.kind === 'migration') {
          const other = history.find((row) => row.version === statement.version && row.run_id !== runId);
          if (other)
            throw new Fault(
              'MIGRATION_HISTORY_CONFLICT',
              `${statement.version} is already recorded by run ${other.run_id}.`,
              5,
            );
          history = history.filter((row) => row.version !== statement.version);
          if (statement.applied)
            history.push({
              version: statement.version,
              checksum: statement.checksum,
              status: 'succeeded',
              run_id: runId,
            });
        } else if (statement.applied) packages[projectId + ':' + statement.file] = statement.checksum;
      }
      await writeJson(
        historyFile,
        history.sort((a, b) => a.version.localeCompare(b.version)),
      );
      await writeJson(
        packagesFile,
        Object.fromEntries(Object.entries(packages).sort(([a], [b]) => a.localeCompare(b))),
      );
      await rm(this.file('active.json'));
      return owner;
    });
  }
  /** Release only the reconciled run after its worker has stopped. Keep history. */
  async claimReconciled(runId: string) {
    await this.checkService(true);
    await withLock(this.file('control.lock'), async () => {
      const owner = await this.owner();
      if (!owner) {
        await writeJson(this.file('active.json'), {
          runId,
          pid: process.pid,
          hostname: hostname(),
          phase: 'preparing',
          createdAt: new Date().toISOString(),
        });
        return;
      }
      if (owner.runId !== runId || owner.hostname !== hostname())
        throw new Fault(
          'TARGET_LOCKED',
          'Another runner owns this target; reconciliation cannot clear its ownership.',
          5,
        );
      if (owner.pid !== process.pid) {
        let dead = false;
        try {
          process.kill(owner.pid, 0);
        } catch (error) {
          dead = (error as NodeJS.ErrnoException).code === 'ESRCH';
        }
        if (!dead)
          throw new Fault(
            'TARGET_LOCKED',
            'The import worker is still alive; wait for its terminal result.',
            5,
          );
      }
      await writeJson(this.file('active.json'), { ...owner, pid: process.pid, phase: 'preparing' });
    });
  }
}
