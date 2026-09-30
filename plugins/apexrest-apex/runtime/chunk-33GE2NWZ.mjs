import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  managedHome,
  runtimeState
} from "./chunk-EBBEN4AV.mjs";
import {
  Fault,
  exists,
  withLock,
  writeJson
} from "./chunk-2Z3BZF66.mjs";

// packages/installer/src/uninstall-tools.ts
import path from "node:path";
import { lstat, rm } from "node:fs/promises";
async function checkDirectory(home, directory) {
  let current = home;
  for (const part of ["", ...path.relative(home, directory).split(path.sep)]) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Fault(
          "TOOLCHAIN_OWNERSHIP_CONFLICT",
          "Managed tool directories must not be files or symbolic links. Nothing was removed.",
          5
        );
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}
async function uninstallTools(request) {
  const home = path.resolve(request.home ?? managedHome());
  await checkDirectory(home, home);
  const perform = async () => {
    const state = await runtimeState(home);
    const steps = [];
    for (const component of ["node", "java", "sqlcl", "playwright"]) {
      const executable = state[component];
      if (!executable) continue;
      const parts = path.relative(home, path.resolve(executable)).split(path.sep);
      const prefix = component === "playwright" ? ["playwright"] : ["toolchains", component];
      if (!prefix.every((part, index) => parts[index] === part) || parts.length <= prefix.length + 1) {
        steps.push({ component, action: "keep", reason: "External runtime; not owned by APEXREST." });
        continue;
      }
      const directory = path.join(home, ...parts.slice(0, prefix.length + 1));
      await checkDirectory(home, directory);
      if (component === "node" && (process.execPath.startsWith(directory + path.sep) || await exists(path.join(home, "installation.json")) || await exists(path.join(home, "bin")))) {
        steps.push({
          component,
          directory,
          action: "keep",
          reason: "Node.js is retained for the APEXREST launcher or plugin."
        });
        continue;
      }
      if (component === "playwright" && await exists(path.join(home, "browsers"))) {
        await checkDirectory(home, path.join(home, "browsers"));
        steps.push({ component: "browsers", directory: path.join(home, "browsers"), action: "remove" });
      }
      steps.push({ component, directory, action: "remove" });
    }
    const plan = {
      home,
      steps,
      projectsPreserved: true,
      credentialsPreserved: true,
      downloadCachePreserved: true
    };
    if (request.dryRun) return { status: "planned", plan };
    if (!request.yes)
      throw new Fault(
        "SETUP_APPROVAL_REQUIRED",
        "Review dependencies uninstall --dry-run, then pass --yes to remove managed tools.",
        4,
        "needs-user-action"
      );
    for (const step of steps.filter((step2) => step2.action === "remove")) {
      await rm(step.directory, { recursive: true, force: true });
      if (step.component !== "browsers") {
        delete state[step.component];
        delete state.components[step.component];
      }
      if (step.component === "playwright" || step.component === "browsers") delete state.browser;
      await writeJson(path.join(home, "runtime.json"), state);
    }
    return { status: "uninstalled", ...plan };
  };
  if (request.dryRun || !await exists(home)) return perform();
  return withLock(
    path.join(home, "install.lock"),
    () => withLock(path.join(home, "toolchain.lock"), perform)
  );
}
export {
  uninstallTools
};
