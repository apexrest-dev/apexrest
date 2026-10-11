import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../../packages/core/src/process.ts';

async function assertDescendantGone(stdout: string) {
  const pid = Number(stdout.trim());
  assert.ok(Number.isInteger(pid) && pid > 0, 'shell reports its descendant PID');
  try {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        assert.equal((error as NodeJS.ErrnoException).code, 'ESRCH');
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
