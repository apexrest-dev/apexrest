import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { atomicWrite, exists, hashFile } from '../../core/src/fs.ts';
import { Fault } from '../../core/src/result.ts';
export interface Artifact {
  id: string;
  version: string;
  url: string;
  sha256: string;
  os: string;
  arch: string;
  type: 'tar.gz' | 'zip';
  executable: string;
  allowedHosts: string[];
  license: string;
  consentRequired: boolean;
}
export interface DownloadOptions {
  /** Maximum wait for response headers on each request. */
  headersTimeoutMs?: number;
  /** Maximum gap between body chunks; it resets whenever data arrives. */
  idleTimeoutMs?: number;
  /** Complete download attempts, each restarting from the locked URL. */
  attempts?: number;
  retryDelayMs?: number;
}
export type ProxySupport =
  'not-configured' | 'node-env-proxy' | 'enabled-by-installer' | 'available' | 'unsupported';
const proxyVariables = ['https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY'];
let proxyApplied = false;

/** Describe how vendor downloads will honor HTTP(S)_PROXY / NO_PROXY in this Node process. */
export function proxyStatus(env: NodeJS.ProcessEnv = process.env, execArgv = process.execArgv) {
  const variables = proxyVariables.filter((name) => env[name]);
  const noProxy = Boolean(env.no_proxy || env.NO_PROXY);
  const setGlobal = (http as { setGlobalProxyFromEnv?: unknown }).setGlobalProxyFromEnv;
  const support: ProxySupport = !variables.length
    ? 'not-configured'
    : env.NODE_USE_ENV_PROXY === '1' || execArgv.includes('--use-env-proxy')
      ? 'node-env-proxy'
      : proxyApplied
        ? 'enabled-by-installer'
        : typeof setGlobal === 'function'
          ? 'available'
          : 'unsupported';
  return { configured: variables.length > 0, variables, noProxy, support };
}

/** Make the built-in fetch honor HTTP(S)_PROXY and NO_PROXY, or fail instead of bypassing a proxy. */
export function applyEnvironmentProxy() {
  const status = proxyStatus();
  if (status.support === 'available') {
    (http as unknown as { setGlobalProxyFromEnv: () => unknown }).setGlobalProxyFromEnv();
    proxyApplied = true;
    return proxyStatus();
  }
  if (status.support === 'unsupported')
    throw new Fault(
      'PROXY_UNSUPPORTED',
      'A proxy is configured, but this Node.js cannot apply it to downloads. Run with NODE_USE_ENV_PROXY=1 (Node.js 24 or later), or preload the offline cache.',
      3,
      'blocked',
    );
  return status;
}

/** The SHA-keyed cache is trusted input for extraction, so it must be private to this user. */
export async function assertPrivateCache(cache: string, platform = process.platform) {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  if (platform === 'win32') return;
  const physical = (await lstat(cache)).isSymbolicLink() ? await realpath(cache) : cache;
  const info = await stat(physical);
  if (!info.isDirectory() || info.mode & 0o022 || info.uid !== process.getuid?.())
    throw new Fault(
      'UNSAFE_CACHE_DIRECTORY',
      `Download cache ${cache} must be a directory owned by the current user and not writable by group or others.`,
      3,
      'blocked',
    );
}

class RetriableDownload extends Error {}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withDeadline<T>(work: Promise<T>, ms: number, controller: AbortController, message: string) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new RetriableDownload(message));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function download(
  artifact: Artifact,
  cache: string,
  offline = false,
  fetcher: typeof fetch = fetch,
  options: DownloadOptions = {},
): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || /(?:latest|main)(?:[./?]|$)/.test(artifact.url))
    throw new Fault('UNPINNED_ARTIFACT', 'Downloads require an immutable version URL and SHA-256.', 2);
  await assertPrivateCache(cache);
  const file = path.join(cache, artifact.sha256);
  if (await exists(file)) {
    if ((await hashFile(file)) !== artifact.sha256)
      throw new Fault(
        'INTEGRITY_FAILURE',
        'Cached artifact SHA-256 does not match the trusted lock.',
        3,
        'blocked',
      );
    return file;
  }
  if (offline)
    throw new Fault(
      'OFFLINE_CACHE_MISS',
      `Artifact ${artifact.id} ${artifact.version} is absent from the offline cache.`,
      3,
      'blocked',
    );
  if (fetcher === globalThis.fetch) applyEnvironmentProxy();
  const headersTimeoutMs = options.headersTimeoutMs ?? 60000,
    idleTimeoutMs = options.idleTimeoutMs ?? 60000,
    attempts = options.attempts ?? 3,
    retryDelayMs = options.retryDelayMs ?? 1000;

  // One attempt follows the redirect chain and streams the body into an
  // unpublished file. Transport failures, 5xx and stalled bodies restart it.
  const attempt = async () => {
    let url = new URL(artifact.url);
    for (let redirect = 0; redirect < 6; redirect++) {
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !artifact.allowedHosts.includes(url.hostname)
      )
        throw new Fault(
          'DOWNLOAD_ORIGIN_DENIED',
          'Download redirect left the vendor origin allowlist.',
          4,
          'blocked',
        );
      const controller = new AbortController();
      let response: Response;
      try {
        response = await withDeadline(
          fetcher(url, { redirect: 'manual', signal: controller.signal }),
          headersTimeoutMs,
          controller,
          `Vendor did not respond within ${Math.round(headersTimeoutMs / 1000)} s.`,
        );
      } catch (error) {
        if (error instanceof Fault) throw error;
        throw new RetriableDownload(error instanceof Error ? error.message : 'Vendor download failed.');
      }
      if (response.status >= 500) {
        await response.body?.cancel().catch(() => {});
        throw new RetriableDownload(`Vendor returned HTTP ${response.status}.`);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = response.headers.get('location');
        await response.body?.cancel().catch(() => {});
        if (!next) throw new Fault('DOWNLOAD_FAILED', 'Missing redirect destination.', 3);
        url = new URL(next, url);
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {});
        throw new Fault('DOWNLOAD_FAILED', `Vendor returned HTTP ${response.status}.`, 3, 'blocked');
      }
      const reader = response.body.getReader();
      async function* verifiedChunks() {
        let size = 0;
        const digest = createHash('sha256');
        for (;;) {
          let chunk: ReadableStreamReadResult<Uint8Array>;
          try {
            chunk = await withDeadline(
              reader.read(),
              idleTimeoutMs,
              controller,
              `Download stalled for ${Math.round(idleTimeoutMs / 1000)} s.`,
            );
          } catch (error) {
            if (error instanceof Fault || error instanceof RetriableDownload) throw error;
            throw new RetriableDownload(error instanceof Error ? error.message : 'Download interrupted.');
          }
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 512 * 1024 * 1024) throw new Fault('DOWNLOAD_LIMIT', 'Download exceeds 512 MiB.', 3);
          digest.update(chunk.value);
          yield chunk.value;
        }
        if (digest.digest('hex') !== artifact.sha256)
          throw new Fault(
            'INTEGRITY_FAILURE',
            'Download SHA-256 does not match the trusted lock. Nothing was executed.',
            3,
            'blocked',
          );
      }
      try {
        // atomicWrite publishes only after the entire stream passes size and checksum checks.
        await atomicWrite(file, verifiedChunks());
      } finally {
        await reader.cancel().catch(() => {});
      }
      return file;
    }
    throw new Fault('DOWNLOAD_REDIRECT_LIMIT', 'Too many vendor redirects.', 3);
  };
  for (let index = 1; ; index++) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof RetriableDownload)) throw error;
      if (index >= attempts) throw new Fault('DOWNLOAD_FAILED', error.message, 3, 'blocked');
      await delay(retryDelayMs * index);
    }
  }
}
