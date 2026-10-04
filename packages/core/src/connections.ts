import path from 'node:path';
import { chmod, constants, mkdir, open, rm, stat } from 'node:fs/promises';
import { z } from 'zod';
import { contained, exists, readJson, withLock, writeJson } from './fs.ts';
import { managedHome, parse, refName } from './config.ts';
import { Fault } from './result.ts';
// Passed as one SQLcl argv value, never interpolated into a command or SQL.
export const savedConnectionName = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^\x00-\x1f\x7f-\x9f]+$/);
export const ordsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      // Plaintext HTTP would expose the ORDS password; allow it for loopback only.
      (url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.endsWith('/') &&
      !url.pathname.replace(/\/+$/, '').endsWith('/_/sql') &&
      !/[\s"\x00-\x1f]/.test(value)
    );
  }, 'Use the ORDS schema HTTPS URL ending in / (HTTP only for localhost), without credentials, query or fragment.');
export const ordsUsername = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^"\x00-\x1f\x7f-\x9f]+$/);
const ordsSchema = z.strictObject({ url: ordsUrl, username: ordsUsername });
export const connectionSchema = z
  .strictObject({
    kind: z.literal('sqlcl-store'),
    name: savedConnectionName.optional(),
    ords: ordsSchema.optional(),
  })
  .refine((value) => !!(value.name || value.ords), 'Configure a direct connection or ORDS endpoint.');
export type Connection = z.infer<typeof connectionSchema>;
const storeSchema = z.record(refName, connectionSchema);
const references = new WeakMap<Connection, string>();
export const connectionReference = (connection: Connection) => references.get(connection);
const credentialSchema = ordsSchema.extend({ password: z.string().min(1).max(4096) }).strict();
export type OrdsCredentials = z.infer<typeof credentialSchema>;

function checkPassword(password: string) {
  if (!password || password.length > 4096 || /["\x00-\x1f\x7f-\x9f]/.test(password))
    throw new Fault(
      'INVALID_ORDS_PASSWORD',
      'ORDS passwords must be nonempty and cannot contain control characters or double quotes.',
      2,
    );
  return password;
}

async function credentialPath(name: string) {
  parse(refName, name);
  return contained(managedHome(), path.join('credentials', name + '.json'));
}

export async function ordsCredentials(connection: Connection): Promise<OrdsCredentials> {
  const name = references.get(connection);
  if (!name || !connection.ords)
    throw new Fault(
      'ORDS_CONNECTION_REQUIRED',
      'Configure this connection reference with a plugin-level ORDS endpoint and credentials.',
      3,
      'blocked',
    );
  const file = await credentialPath(name);
  if (!(await exists(file)))
    throw new Fault(
      'ORDS_CREDENTIALS_REQUIRED',
      'Save the ORDS password locally in plugin connection settings.',
      3,
      'blocked',
    );
  if (process.platform !== 'win32' && ((await stat(file)).mode & 0o077) !== 0)
    throw new Fault(
      'ORDS_CREDENTIAL_PERMISSIONS',
      'ORDS credential files must only be readable by their owner (0600).',
      3,
      'blocked',
    );
  let value: OrdsCredentials;
  try {
    value = parse(credentialSchema, await readJson(file));
  } catch {
    throw new Fault(
      'ORDS_CREDENTIALS_INVALID',
      'The local ORDS credential file is invalid. Save it again in plugin settings.',
      3,
      'blocked',
    );
  }
  if (value.url !== connection.ords.url || value.username !== connection.ords.username)
    throw new Fault(
      'ORDS_CREDENTIALS_REQUIRED',
      'Save credentials for the configured ORDS endpoint and username.',
      3,
      'blocked',
    );
  checkPassword(value.password);
  return value;
}
export async function connections(): Promise<Record<string, Connection>> {
  const file = path.join(managedHome(), 'connections.json');
  return (await exists(file)) ? parse(storeSchema, await readJson(file)) : {};
}
export async function resolveConnection(name: string): Promise<Connection> {
  const connection = (await connections())[name];
  if (!connection)
    throw new Fault(
      'CONNECTION_REQUIRED',
      'Configure the requested SQLcl connection reference locally; do not send credentials in chat.',
      3,
      'blocked',
    );
  references.set(connection, name);
  return connection;
}
export async function editConnection(name: string, value?: Connection) {
  parse(refName, name);
  return withLock(path.join(managedHome(), 'connections.lock'), async () => {
    const current = await connections();
    let credentialsDeleted = false;
    if (value) current[name] = parse(connectionSchema, { ...current[name], ...value });
    else {
      delete current[name];
      const file = await credentialPath(name);
      credentialsDeleted = await exists(file);
      await rm(file, { force: true });
    }
    await writeJson(path.join(managedHome(), 'connections.json'), current);
    return { name, status: value ? 'configured' : 'removed', credentialsDeleted };
  });
}

/** A password file must be a private regular file; symlinks and shared files are rejected. */
async function readPasswordFile(file: string) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new Fault(
      'PASSWORD_FILE_UNSAFE',
      code === 'ELOOP' || code === 'EMLINK'
        ? 'The password file must not be a symbolic link.'
        : 'The password file cannot be opened.',
      2,
    );
  }
  try {
    const info = await handle.stat();
    if (!info.isFile())
      throw new Fault('PASSWORD_FILE_UNSAFE', 'The password file must be a regular file.', 2);
    if (process.platform !== 'win32' && (info.mode & 0o077) !== 0)
      throw new Fault(
        'PASSWORD_FILE_UNSAFE',
        'The password file must only be accessible by its owner (chmod 600).',
        2,
      );
    return await handle.readFile('utf8');
  } finally {
    await handle.close();
  }
}

export interface ConfigureConnection {
  sqlclName?: string | undefined;
  ordsUrl?: string | undefined;
  ordsUsername?: string | undefined;
  passwordFile?: string | undefined;
  password?: string | undefined;
}

// Passwords enter only through the local settings form or an explicitly supplied
// local file; public connection records and operation results contain metadata.
export async function configureConnection(name: string, input: ConfigureConnection) {
  parse(refName, name);
  return withLock(path.join(managedHome(), 'connections.lock'), async () => {
    const current = await connections();
    const previous = current[name];
    const ords =
      input.ordsUrl || input.ordsUsername
        ? parse(ordsSchema, { url: input.ordsUrl, username: input.ordsUsername })
        : previous?.ords;
    const value = parse(connectionSchema, {
      ...previous,
      kind: 'sqlcl-store',
      ...(input.sqlclName ? { name: input.sqlclName } : {}),
      ...(ords ? { ords } : {}),
    });
    let password = input.password;
    if (input.passwordFile) {
      if (password !== undefined) throw new Fault('INVALID_INPUT', 'Supply one local password source.', 2);
      password = (await readPasswordFile(path.resolve(input.passwordFile))).replace(/\r?\n$/, '');
    }
    if (password !== undefined && !ords)
      throw new Fault(
        'INVALID_INPUT',
        'Configure the ORDS endpoint and username before saving its password.',
        2,
      );
    if (ords && (input.ordsUrl || input.ordsUsername || password !== undefined)) {
      if (password !== undefined) {
        const folder = await contained(managedHome(), 'credentials');
        await mkdir(folder, { recursive: true, mode: 0o700 });
        if (process.platform !== 'win32') await chmod(folder, 0o700);
        await writeJson(await credentialPath(name), { ...ords, password: checkPassword(password) });
      } else {
        references.set(value, name);
        await ordsCredentials(value);
      }
    }
    current[name] = value;
    await writeJson(path.join(managedHome(), 'connections.json'), current);
    return { name, status: 'configured' as const };
  });
}
