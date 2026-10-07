import { hostname } from 'node:os';
import { runProcess } from './process.ts';

const loopback = (host: string) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.toLowerCase());
/** Evaluate the effective connected JDBC endpoint, never an application URL. */
export function localConnectionEndpoint(description: string) {
  const jdbc = /jdbc:oracle:(thin|oci):(?:[^@\r\n]*@)?([^\r\n]*)/i.exec(description);
  if (!jdbc) return { local: false, evidence: 'unconfirmed-connection-endpoint' };
  if (jdbc[1]!.toLowerCase() === 'oci' && !jdbc[2]!.trim())
    return { local: true, evidence: 'native-local-transport' };
  const address = jdbc[2]!.trim();
  const descriptorHosts = [...address.matchAll(/\(host\s*=\s*([^\s)]+)\)/gi)].map((m) => m[1]!);
  const easy = /^(?:\/\/)?(\[[^\]]+\]|[^/:,?\s]+)(?::\d+)?(?:\/|:)/.exec(address);
  const hosts = descriptorHosts.length ? descriptorHosts : easy ? [easy[1]!] : [];
  return {
    local: hosts.length > 0 && hosts.every(loopback),
    evidence:
      hosts.length && hosts.every(loopback) ? 'effective-loopback-endpoint' : 'remote-or-unresolved-endpoint',
  };
}
/** A loopback tunnel to another machine is not a local database. */
export async function localServerHost(serverHost: string) {
  const host = serverHost.toLowerCase();
  if (loopback(host) || host === hostname().toLowerCase()) return true;
  const engines = [
    'docker',
    'podman',
    ...(process.platform === 'darwin'
      ? ['/opt/podman/bin/podman', '/Applications/Docker.app/Contents/Resources/bin/docker']
      : []),
  ];
  for (const executable of engines) {
    const podman = executable.endsWith('podman');
    try {
      // The container engine must itself be local, not a remote context.
      if (podman) {
        if (process.env.CONTAINER_HOST && !process.env.CONTAINER_HOST.startsWith('unix://')) continue;
        if (process.platform !== 'linux') {
          const connections = await runProcess({
            executable,
            args: ['system', 'connection', 'list', '--format', 'json'],
            cwd: process.cwd(),
            timeoutMs: 5000,
          });
          const entries = JSON.parse(connections.stdout) as Array<{
            Name?: string;
            Default?: boolean;
            URI?: string;
          }>;
          const active = process.env.CONTAINER_CONNECTION
            ? entries.find((entry) => entry.Name === process.env.CONTAINER_CONNECTION)
            : entries.find((entry) => entry.Default);
          if (!active?.URI) continue;
          const endpoint = new URL(active.URI);
          if (!loopback(endpoint.hostname)) continue;
          const machines = await runProcess({
            executable,
            args: ['machine', 'list', '--format', 'json'],
            cwd: process.cwd(),
            timeoutMs: 5000,
          });
          if (
            machines.code !== 0 ||
            !(JSON.parse(machines.stdout) as Array<{ Running?: boolean; Port?: number }>).some(
              (machine) => machine.Running && machine.Port === Number(endpoint.port),
            )
          )
            continue;
        }
      } else {
        const context =
          process.env.DOCKER_HOST ??
          (
            await runProcess({
              executable,
              args: ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
              cwd: process.cwd(),
              timeoutMs: 5000,
            })
          ).stdout.trim();
        if (!/^(unix|npipe):\/\//.test(context)) continue;
      }
      const list = await runProcess({ executable, args: ['ps', '-q'], cwd: process.cwd(), timeoutMs: 5000 });
      const ids = list.stdout
        .trim()
        .split(/\s+/)
        .filter((id) => /^[a-f0-9]{12,64}$/.test(id));
      if (list.code !== 0 || !ids.length) continue;
      const names = await runProcess({
        executable,
        args: ['inspect', '--format', '{{.Config.Hostname}}', ...ids],
        cwd: process.cwd(),
        timeoutMs: 5000,
      });
      if (
        names.code === 0 &&
        names.stdout
          .trim()
          .split(/\s+/)
          .some((name) => name.toLowerCase() === host)
      )
        return true;
    } catch {
      /* An absent or unverifiable engine never grants local privileges. */
    }
  }
  return false;
}
