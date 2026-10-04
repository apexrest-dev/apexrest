import path from 'node:path';
import { lstat, rm } from 'node:fs/promises';
import { exists, withLock, writeJson } from '../../core/src/fs.ts';
import { managedHome } from '../../core/src/config.ts';
import { Fault } from '../../core/src/result.ts';
import { canonicalHome, runtimeState } from './toolchain.ts';

interface Request {
  home?: string;
  dryRun?: boolean;
  yes?: boolean;
}
interface Step {
  component: string;
  directory?: string;
  action: 'remove' | 'keep';
  reason?: string;
}

// Only the recorded version under this managed home is eligible. Never follow
// a substituted toolchain/version directory into an external runtime.
async function checkDirectory(home: string, directory: string) {
  let current = home;
  for (const part of ['', ...path.relative(home, directory).split(path.sep)]) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Fault(
          'TOOLCHAIN_OWNERSHIP_CONFLICT',
          'Managed tool directories must not be files or symbolic links. Nothing was removed.',
          5,
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

/**
 * Path of a recorded file below the managed home. Records may use another alias
 * of the same home (for example /var vs /private/var); only the outermost
 * ancestor that resolves to the home is canonicalized, so links below the home
 * remain visible to the ownership checks.
 */
async function relativeToHome(home: string, file: string) {
  const resolved = path.resolve(file);
  const ancestors: string[] = [];
  for (let current = path.dirname(resolved); ; current = path.dirname(current)) {
    ancestors.unshift(current);
    if (path.dirname(current) === current) break;
  }
  for (const ancestor of ancestors) {
    try {
      if ((await canonicalHome(ancestor)) === home) return path.relative(ancestor, resolved);
    } catch {
      /* Unreadable ancestors cannot identify the home. */
    }
  }
  return undefined;
}

export async function uninstallTools(request: Request) {
  const home = await canonicalHome(request.home ?? managedHome());
  await checkDirectory(home, home);
  const perform = async () => {
    const state = await runtimeState(home);
    const steps: Step[] = [];
    for (const component of ['node', 'java', 'sqlcl', 'playwright'] as const) {
      const executable = state[component];
      if (!executable) continue;
      const parts = ((await relativeToHome(home, executable)) ?? '..').split(path.sep);
      const prefix = component === 'playwright' ? ['playwright'] : ['toolchains', component];
      if (!prefix.every((part, index) => parts[index] === part) || parts.length <= prefix.length + 1) {
        steps.push({ component, action: 'keep', reason: 'External runtime; not owned by APEXREST.' });
        continue;
      }
      const directory = path.join(home, ...parts.slice(0, prefix.length + 1));
      await checkDirectory(home, directory);
      if (
        component === 'node' &&
        (process.execPath.startsWith(directory + path.sep) ||
          (await exists(path.join(home, 'installation.json'))) ||
          (await exists(path.join(home, 'bin'))))
      ) {
        steps.push({
          component,
          directory,
          action: 'keep',
          reason: 'Node.js is retained for the APEXREST launcher or plugin.',
        });
        continue;
      }
      if (component === 'playwright' && (await exists(path.join(home, 'browsers')))) {
        await checkDirectory(home, path.join(home, 'browsers'));
        steps.push({ component: 'browsers', directory: path.join(home, 'browsers'), action: 'remove' });
      }
      // Remove the browser cache before clearing the Playwright ownership pointer,
      // so an interrupted removal can still discover and retry both paths.
      steps.push({ component, directory, action: 'remove' });
    }
    const plan = {
      home,
      steps,
      projectsPreserved: true,
      credentialsPreserved: true,
      downloadCachePreserved: true,
    };
    if (request.dryRun) return { status: 'planned', plan };
    if (!request.yes)
      throw new Fault(
        'SETUP_APPROVAL_REQUIRED',
        'Review dependencies uninstall --dry-run, then pass --yes to remove managed tools.',
        4,
        'needs-user-action',
      );
    for (const step of steps.filter((step) => step.action === 'remove')) {
      await rm(step.directory!, { recursive: true, force: true });
      if (step.component !== 'browsers') {
        delete state[step.component as 'node' | 'java' | 'sqlcl' | 'playwright'];
        delete state.components[step.component];
      }
      if (step.component === 'playwright' || step.component === 'browsers') delete state.browser;
      await writeJson(path.join(home, 'runtime.json'), state);
    }
    return { status: 'uninstalled', ...plan };
  };
  if (request.dryRun || !(await exists(home))) return perform();
  return withLock(path.join(home, 'install.lock'), () =>
    withLock(path.join(home, 'toolchain.lock'), perform),
  );
}
