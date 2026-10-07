# APEX work in the current session

Describe an Oracle APEX change in the current Codex or Claude Code conversation, or invoke the work skill (`$apexrest-work` in Codex, `/apexrest:apexrest-work` in Claude Code). The [work skill](../plugins/apexrest-apex/skills/apexrest-work/SKILL.md) implements it in that conversation with its existing context, model and permissions. There is no plugin task registration, startup call or panel.

The [APEX 26.2 workflow](apex-26.2.md) in this source checkout adds partial imports for page and supported shared-component changes. Existing 26.1 projects keep their full-import behavior.

1. **Project.** New app: `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`); it generates real Oracle sources. Existing app: `action:inspect` (summary) for source directories and environments; `apexrest_apex_sync` `action:status` shows a working copy. For 26.2 partial imports, establish a trusted checkpoint with `action:init` before editing. Configured identities and local sync status are not verified live targets.
2. **References**, at most three lookups per change: `apexrest_reference` `mode:search` with short English terms, `kind` and `limit:3`, then `mode:read` the chosen ID. Use the project's release profile, or explicit `version: "26.2"` for 26.2 sources. Routes and contracts are in the [APEXlang skill](../plugins/apexrest-apex/skills/apexrest-apexlang/SKILL.md).
3. **Edit** `.apx` files under the application source directory. Keep `.apex/apexlang.json`, Oracle IDs, authentication and authorization; edit related components together and never leave placeholders.
4. **Ship** ordinary authorized edits with one `apexrest_ship` `mode:apply` call, `env` and `userRequest` (the user's literal instruction). Both hosts use the same compiler, plan, grant, backup, import and readback implementation. `importMode:auto` selects eligible changed pages/shared files; `files` binds an exact application-relative list; global or unsupported changes require `full`.
5. **Review when needed.** Standalone `apexrest_apex_validate` is for compiler diagnostics; `mode:plan` is for an explicit review of selection, dependencies, reasons, risks, sources and target. Neither is a required extra call before an ordinary apply. A separate `mode:apply` prepares a fresh plan; granular `deploy apply` consumes the particular saved plan when exact-plan review is required.
6. **Wait.** The identified DEV/QA/TEST app task authorizes its necessary import; the runtime records and removes the exact-plan grant. If the call is still running (`waitSeconds` default 25), read `apexrest_job action:status` with the returned `jobId`. Never rerun ship to fetch results.
7. **When requested, verify** visibly changed pages: `apexrest_browser_open` for `env`, then open the returned URL with the selected browser's controls (`host` in-app browser of Codex or Claude Code, legacy alias `codex`, or the user-selected browser) and check rendering, navigation and the changed interaction, following the [browser verification rule](testing.md#browser-verification). Opening a page is not verification.
8. **Report** files changed, validation result, ship status and `runId`, pages verified in the browser, and anything not verified with its reason.

For a Home page that uses a changed status LOV, an explicit plan request looks like this; replace the paths with the actual application-relative paths and preserve the user's actual request:

```json
{
  "project": "/absolute/path/to/application-project",
  "mode": "plan",
  "env": "dev",
  "importMode": "files",
  "files": ["pages/p00001-home.apx", "shared-components/lovs/status.apx"],
  "userRequest": "Update the Home page and status LOV in the identified development application"
}
```

File imports require an existing dev/test application, a trusted sync checkpoint, the reviewed 26.2 source/target and SQLcl 26.3/MMD tuple, and direct SQLcl CLI transport inside the runtime. Codex and Claude Code can invoke this path through `apexrest_ship` over MCP. Planning compares the checkpoint, local edits and a fresh server export; it preserves remote-only edits and blocks unequal edits to the same component. The effective application is compiled with the selected page and LOV together. Dependencies are not silently added: an explicit `files` request never widens or falls back to `full`. Page-only changes use native selected-page exports; supported shared files disclose full APEXlang observation because Oracle rejects their native selected export. The retained backup and readback cover only the selected files, and the checkpoint preserves local dependency context. Ordinary operations create no SQL application dumps. Unselected server freshness is not established by scoped readback. See [existing applications](existing-app.md) for CLI examples and [deployment safeguards](deployment-safety.md#apex-262-partial-imports) for fallback and recovery rules.

Blocked, failed or unknown outcomes follow the [safety skill](../plugins/apexrest-apex/skills/apexrest-safety/SKILL.md); missing tools or connections follow the [setup skill](../plugins/apexrest-apex/skills/apexrest-setup/SKILL.md). A completed job can still have failed: inspect its actual result and diagnostics. Application checks use the host in-app browser; browser observations are recorded separately from compiler and import results.

The host controls its own execution and collaboration. APEXREST provides Oracle/APEX tools; it does not create model sessions or select models, and has no global chat interceptor. A new session may be needed after plugin installation or update to refresh the host's cached skill and tool catalog.
