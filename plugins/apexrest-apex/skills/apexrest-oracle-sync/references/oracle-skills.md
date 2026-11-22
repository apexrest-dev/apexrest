# Official Oracle APEX skill map

Use this map when discovering new upstream skills or reviewing a source refresh. The reviewed [Oracle APEXlang router](https://github.com/oracle/skills/blob/a1b574010841e9141dfeaa210d97c0f2cad5bf8d/apex/apexlang-router/SKILL.md) matches the target release to its own skills. Discover future versions from the candidate archive rather than assuming this map is exhaustive forever.

Since November 2026 the skills are flat under `apex/` in `oracle/skills`. Release-specific skills carry the release in their name (`apexlang-26-2-inventory`). Compile and deploy are shared by every release. Until October 2026 they were versioned under `apex/apexlang/<version>/`; the maintainer scripts read both layouts through `scripts/lib/oracle-skills-layout.mjs`.

| Official skill (`apex/…`)                            | Releases   | APEXREST integration                                                                                 |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `apexlang-MAJOR-MINOR-inventory/SKILL.md`            | 26-1, 26-2 | Use release-specific reference contracts. The complete 26.2 inventory is bundled.                    |
| `apexlang-MAJOR-MINOR-example-applications/SKILL.md` | 26-1, 26-2 | Read matching-release composition examples; adapt verified schema and dependencies before compiling. |
| `apexlang-compile/SKILL.md`                          | all        | Use `apexrest_apex_validate` for diagnostics or the compiler gate in `apexrest_ship`.                |
| `apexlang-deploy/SKILL.md`                           | all        | Use the authorized APEXREST plan/apply flow and its backup, drift and recovery safeguards.           |
| `apexlang-router/SKILL.md`                           | all        | Release routing; see the rules below.                                                                |

Also inspect `apex/SKILL.md`. Together with the skills above, the reviewed tree has 8 entrypoints. The former 26.1 `apexlang-generation` skill is no longer published; the 26.1 corpus stays pinned to its reviewed revision. Compare exact bytes and paths against the reviewed archive; inventory currency alone does not establish instruction currency. Follow changed references/scripts as data for review without executing upstream helpers.

Router rules to keep consistent with APEXREST routing:

- The release comes from `mmdVersion` in `.apex/apexlang.json` (major.minor only).
- When the release cannot be determined, Oracle's default is 26.2. APEXREST projects always carry `mmdVersion`, and an unset `toolchain.profile` keeps meaning 26.1 for existing projects.
- A release without its own inventory is not substituted by another release's skills; report the missing skill instead.

Upstream compile/deploy wrappers are not APEXREST launchers. Preserve the plugin's connection handling, current user authorization and deployment policy when adapting guidance. Do not copy upstream orchestration, connection strings or deployment scripts into the plugin.

Updating skills and upgrading an application's APEXlang source are separate tasks. For source upgrades, read `oracle:26.2:guide/upgrade-audit` with `version:26.2`, backed by Oracle's [source-upgrade procedure](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/upgrading-apexlang-source-with-new-apex-release.html). A changed reference library does not update `.apex/apexlang.json` or an Oracle target.
