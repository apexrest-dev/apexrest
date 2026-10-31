import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { runProcess, spawnTree, stopTree } from '../../packages/core/src/process.ts';
import { SqlclStdioTransport } from '../../packages/core/src/sqlcl-mcp.ts';

async function assertDescendantGone(stdout: string) {
  const pid = Number(stdout.trim());
  assert.ok(Number.isInteger(pid) && pid > 0, 'shell reports its descendant PID');
  try {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0);
        if (process.platform === 'linux') {
          const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
          if (stat.slice(stat.lastIndexOf(')') + 2).startsWith('Z ')) return;
        }
      } catch (error) {
        assert.ok(['ESRCH', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? ''));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* Already reaped. */
    }
  }
}

// Oracle's `sql` launcher starts the JVM as a child of a shell without exec. A
// timeout or cancellation must stop that descendant too, and the runner must
// resolve even when a descendant keeps the stdio pipes open.
test(
  'timeouts stop the whole process tree and resolve promptly',
  { skip: process.platform === 'win32' },
  async () => {
    const started = Date.now();
    const result = await runProcess({
      executable: 'sh',
      args: ['-c', 'sleep 30 & echo $!; wait'],
      cwd: process.cwd(),
      timeoutMs: 300,
    });
    assert.equal(result.timedOut, true);
    await assertDescendantGone(result.stdout);
    assert.ok(Date.now() - started < 10000, 'runner resolved before the orphaned sleep would have ended');
  },
);

test(
  'cancellation stops a tree whose child holds stdout open',
  { skip: process.platform === 'win32' },
  async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    const started = Date.now();
    const result = await runProcess({
      executable: 'sh',
      args: ['-c', 'sleep 30 & echo $!; wait'],
      cwd: process.cwd(),
      timeoutMs: 60000,
      signal: controller.signal,
    });
    assert.equal(result.cancelled, true);
    await assertDescendantGone(result.stdout);
    assert.ok(Date.now() - started < 10000);
  },
);

for (const interruption of ['timeout', 'cancellation'] as const)
  test(
    `${interruption} kills a SIGTERM-resistant descendant after its launcher exits`,
    { skip: process.platform === 'win32' },
    async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'apexrest-process-tree-'));
      const ready = path.join(directory, 'ready');
      const controller = new AbortController();
      // Publish readiness only after the child has installed its signal handler.
      // The launcher keeps the default SIGTERM behavior and exits before escalation.
      const descendant = `
        process.on('SIGTERM', () => {});
        setInterval(() => {}, 1000);
        setTimeout(() => process.exit(0), 30000);
        console.log(process.pid);
        require('node:fs').writeFileSync(process.argv[1], String(process.pid));
      `;
      const launcher = `
        require('node:child_process').spawn(process.execPath,
          ['-e', ${JSON.stringify(descendant)}, process.argv[1]], { stdio: 'inherit' });
        setInterval(() => {}, 1000);
      `;
      const running = runProcess({
        executable: process.execPath,
        args: ['-e', launcher, ready],
        cwd: process.cwd(),
        timeoutMs: interruption === 'timeout' ? 6000 : 10000,
        signal: controller.signal,
      });
      let pid: number | undefined;
      try {
        // Readiness must be observed well before the 6 s timeout can fire.
        const deadline = Date.now() + 4000;
        while (!pid && Date.now() < deadline) {
          try {
            pid = Number(await readFile(ready, 'utf8')) || undefined;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
          if (!pid) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.ok(pid, 'descendant is ready before interrupting the launcher');
        if (interruption === 'cancellation') controller.abort();
        const result = await running;
        assert.equal(result.timedOut, interruption === 'timeout');
        assert.equal(result.cancelled, interruption === 'cancellation');
        assert.equal(Number(result.stdout.trim()), pid);
        await assertDescendantGone(result.stdout);
      } finally {
        controller.abort();
        if (pid) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            /* Already reaped. */
          }
        }
        await running;
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

test(
  'a descendant still holding the pipes after a normal launcher exit is stopped',
  { skip: process.platform === 'win32' },
  async () => {
    const result = await runProcess({
      executable: 'sh',
      args: ['-c', 'sleep 30 & echo $!'],
      cwd: process.cwd(),
      timeoutMs: 60000,
    });
    assert.equal(result.code, 0);
    assert.equal(result.timedOut, false);
    await assertDescendantGone(result.stdout);
  },
);

// Records group signals without changing delivery, so a test can prove that no
// SIGKILL reaches a process group ID after the whole group has closed.
async function recordGroupSignals(run: (signals: [number, string][]) => Promise<void>) {
  const original = process.kill;
  const signals: [number, string][] = [];
  process.kill = ((pid: number, signal?: string | number) => {
    if (pid < 0) signals.push([pid, String(signal)]);
    return original.call(process, pid, signal);
  }) as typeof process.kill;
  try {
    await run(signals);
  } finally {
    process.kill = original;
  }
}

test(
  'stopTree is idempotent and cancels SIGKILL once the group has closed',
  { skip: process.platform === 'win32' },
  async () =>
    recordGroupSignals(async (signals) => {
      const child = spawnTree(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'pipe' });
      await once(child, 'spawn');
      const closed = once(child, 'close');
      stopTree(child);
      stopTree(child);
      await closed;
      await new Promise((resolve) => setTimeout(resolve, 1800));
      assert.deepEqual(signals, [[-child.pid!, 'SIGTERM']]);
    }),
);

test(
  'SQLcl MCP transport shutdown sends no SIGKILL after the group has closed',
  { skip: process.platform === 'win32' },
  async () =>
    recordGroupSignals(async (signals) => {
      const transport = new SqlclStdioTransport({
        executable: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000)'],
        cwd: process.cwd(),
      });
      await transport.start();
      const pid = transport.pid!;
      const closed = new Promise<void>((resolve) => (transport.onclose = resolve));
      transport.kill();
      transport.kill();
      await closed;
      await new Promise((resolve) => setTimeout(resolve, 1800));
      assert.deepEqual(signals, [[-pid, 'SIGTERM']]);
    }),
);

test('stderr is redacted while stdout stays verbatim for JSON consumers', async () => {
  const result = await runProcess({
    executable: process.execPath,
    args: ['-e', "console.log(JSON.stringify({ note: 'password: kept' })); console.error('token: abc')"],
    cwd: process.cwd(),
  });
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout), { note: 'password: kept' });
  assert.doesNotMatch(result.stderr, /abc/);
});
