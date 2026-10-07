import path from 'node:path';
import { hostname } from 'node:os';
import { rm } from 'node:fs/promises';
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
  constructor(env: Environment) {
    // Serialize different apps that share a parsing schema and its migrations.
    const key = hash(canonical({ ...env.databaseIdentity, schema: env.parsingSchema }));
    this.directory = path.join(managedHome(), 'deployment-control', key);
  }
  file(name: string) {
    return path.join(this.directory, name);
  }
  async history() {
    const file = this.file('history.json');
    return (await exists(file)) ? parse(historySchema, await readJson(file)) : [];
  }
  async owner() {
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
  async acquire(runId: string) {
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
  /** Release only the reconciled run after its worker has stopped. Keep history. */
  async claimReconciled(runId: string) {
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
