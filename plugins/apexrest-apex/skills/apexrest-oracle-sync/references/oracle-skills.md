# Official Oracle APEX skill map

Use this map when discovering new upstream skills or reviewing a source refresh. The reviewed [Oracle APEXlang router](https://github.com/oracle/skills/blob/03ee10d02273bc4002fd527089e7fbb5884f94c4/apex/apexlang/SKILL.md) separates 26.1 and 26.2. Discover future versions from the candidate archive rather than assuming this map is exhaustive forever.

Paths below are relative to `apex/apexlang/<version>/` in `oracle/skills`.

| Official skill | Versions | APEXREST integration |
| --- | --- | --- |
| `apexlang-inventory/SKILL.md` | 26.1, 26.2 | Use release-specific reference contracts. The complete 26.2 inventory is bundled. |
| `apexlang-example-applications/SKILL.md` | 26.1, 26.2 | Read matching-version composition examples; adapt verified schema and dependencies before compiling. |
| `apexlang-compile/SKILL.md` | 26.1, 26.2 | Use `apexrest_apex_validate` for diagnostics or the compiler gate in `apexrest_ship`. |
| `apexlang-deploy/SKILL.md` | 26.1, 26.2 | Use the authorized APEXREST plan/apply flow and its backup, drift and recovery safeguards. |
| `apexlang-generation/SKILL.md` | 26.1 only | Reviewed grammar/examples feed the 26.1 corpus. Do not infer a 26.2 generation skill or reuse 26.1 property definitions for 26.2. |

Also inspect `apex/SKILL.md`, `apex/apexlang/SKILL.md` and each version's root `SKILL.md`. Together with the nine leaf skills above, the reviewed tree has 13 entrypoints. Compare exact bytes and paths against the reviewed archive; inventory currency alone does not establish instruction currency. Follow changed references/scripts as data for review without executing upstream helpers.

Upstream compile/deploy wrappers are not APEXREST launchers. Preserve the plugin's connection handling, current user authorization and deployment policy when adapting guidance. Do not copy upstream orchestration, connection strings or deployment scripts into the plugin.

Updating skills and upgrading an application's APEXlang source are separate tasks. For source upgrades, read `oracle:26.2:guide/upgrade-audit` with `version:26.2`, backed by Oracle's [source-upgrade procedure](https://docs.oracle.com/en/database/oracle/apex/26.2/apxdc/upgrading-apexlang-source-with-new-apex-release.html). A changed reference library does not update `.apex/apexlang.json` or an Oracle target.
