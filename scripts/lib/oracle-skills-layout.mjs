// Locates one APEX release's official skills inside an oracle/skills archive.
//
// Oracle used a versioned layout until October 2026 (apex/apexlang/26.2/apexlang-inventory/…)
// and a flat layout from November 2026 (apex/apexlang-26-2-inventory/…). Snapshots keep
// layout-independent logical keys ('apexlang-inventory/…', 'apexlang-example-applications/…'),
// so a bundled snapshot can be compared with an archive of either layout.

const SKILLS = ['apexlang-inventory/', 'apexlang-example-applications/'];

/** The archive directory of each logical skill for a release, detected from the entry names. */
export function skillsLayout(names, root, release) {
  const versioned = `${root}apex/apexlang/${release}/`;
  const dashed = release.replace('.', '-');
  const legacy = names.some((name) => name.startsWith(versioned + 'apexlang-inventory/'));
  const dirs = legacy
    ? {
        'apexlang-inventory/': versioned + 'apexlang-inventory/',
        'apexlang-example-applications/': versioned + 'apexlang-example-applications/',
      }
    : {
        'apexlang-inventory/': `${root}apex/apexlang-${dashed}-inventory/`,
        'apexlang-example-applications/': `${root}apex/apexlang-${dashed}-example-applications/`,
      };
  /** Archive entry name of a logical key, or undefined for keys outside the two skills. */
  const toArchive = (key) => {
    const skill = SKILLS.find((prefix) => key.startsWith(prefix));
    return skill ? dirs[skill] + key.slice(skill.length) : undefined;
  };
  /** Logical key of an archive entry name, or undefined outside the two skills. */
  const toKey = (name) => {
    const skill = SKILLS.find((prefix) => name.startsWith(dirs[prefix]));
    return skill ? skill + name.slice(dirs[skill].length) : undefined;
  };
  return {
    layout: legacy ? 'versioned' : 'flat',
    inventoryAssets: dirs['apexlang-inventory/'] + 'assets/',
    contains: (name) => Object.values(dirs).some((dir) => name.startsWith(dir)),
    toArchive,
    toKey,
    /** GitHub URL of a logical key at a commit. */
    sourceUrl: (commit, key) =>
      `https://github.com/oracle/skills/blob/${commit}/${toArchive(key).slice(root.length)}`,
  };
}

/** APEX releases that have official skills in the archive, in either layout. */
export function releasesIn(names, root) {
  const found = new Set();
  for (const name of names) {
    const relative = name.slice(root.length);
    const versioned = relative.match(/^apex\/apexlang\/(\d+\.\d+)\//)?.[1];
    const flat = relative.match(/^apex\/apexlang-(\d+)-(\d+)-[a-z-]+\//);
    if (versioned) found.add(versioned);
    if (flat) found.add(`${flat[1]}.${flat[2]}`);
  }
  return found;
}

/** Every entry name of a zip archive, without inflating it. */
export function archiveNames(unzipSync, bytes) {
  const names = [];
  unzipSync(bytes, {
    filter: ({ name }) => {
      names.push(name);
      return false;
    },
  });
  return names;
}
