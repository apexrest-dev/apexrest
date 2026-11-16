import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLockedSqlcl, lockDiagnostics } from '../../packages/core/src/doctor.ts';

const lock = {
  artifacts: [
    { id: 'node', version: '24.21.0', os: 'linux', arch: 'x64' },
    { id: 'sqlcl', version: '26.3.0.260.1620', os: 'darwin', arch: 'arm64' },
    { id: 'sqlcl', version: '26.3.0.260.1620', os: 'linux', arch: 'x64' },
  ],
};
const probe = (build: string) => `SQLcl: Release 26.x Production Build: ${build}`;

test('doctor warns when the selected SQLcl differs from the project lock', () => {
  const check = checkLockedSqlcl(
    lock,
    'apexrest.toolchain.lock.json',
    probe('26.1.2.132.1334'),
    'linux',
    'x64',
  );
  assert.deepEqual(check, {
    status: 'mismatch',
    lockFile: 'apexrest.toolchain.lock.json',
    expected: '26.3.0.260.1620',
    found: '26.1.2.132.1334',
  });
  const [diagnostic] = lockDiagnostics(check);
  assert.equal(diagnostic?.severity, 'warning');
  assert.equal(diagnostic?.code, 'TOOLCHAIN_SQLCL_MISMATCH');
  assert.match(diagnostic!.message, /26\.1\.2\.132\.1334.*26\.3\.0\.260\.1620/);
});

test('doctor is quiet when the selected SQLcl matches the lock', () => {
  const check = checkLockedSqlcl(lock, 'lock.json', probe('26.3.0.260.1620'), 'linux', 'x64');
  assert.equal(check.status, 'match');
  assert.deepEqual(lockDiagnostics(check), []);
});

test('doctor flags an unreadable SQLcl build and skips unpinned platforms', () => {
  const unknown = checkLockedSqlcl(lock, 'lock.json', undefined, 'linux', 'x64');
  assert.equal(unknown.status, 'unknown');
  assert.equal(lockDiagnostics(unknown)[0]?.code, 'TOOLCHAIN_SQLCL_UNVERIFIED');
  const unpinned = checkLockedSqlcl(lock, 'lock.json', probe('26.1.2.132.1334'), 'win32', 'x64');
  assert.deepEqual(unpinned, { status: 'unpinned' });
  assert.deepEqual(lockDiagnostics(unpinned), []);
  assert.deepEqual(lockDiagnostics({ status: 'no-project' }), []);
});
