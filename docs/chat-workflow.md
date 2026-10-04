# APEX work in the current session

Describe an Oracle APEX change in the current Codex or Claude Code conversation, or invoke `$apexrest-work`. The [work skill](../plugins/apexrest-apex/skills/apexrest-work/SKILL.md) implements it in that conversation with its existing context, model and permissions. There is no plugin task registration, startup call or panel.

1. **Project.** New app: `apexrest_project` `action:init` with `directory` and `template` (`blank-app` or `customer-crm`); it generates real Oracle sources. Existing app: `action:inspect` (summary) for source directories and environments; `apexrest_apex_sync` `action:status` shows a working copy. Configured identities are not verified live targets.
2. **References**, at most three lookups per change: `apexrest_reference` `mode:search` with short English terms, `kind` and `limit:3`, then `mode:read` the chosen ID. Routes and contracts are in the [APEXlang skill](../plugins/apexrest-apex/skills/apexrest-apexlang/SKILL.md).
3. **Edit** `.apx` files under the application source directory. Keep `.apex/apexlang.json`, Oracle IDs, authentication and authorization; edit related components together and never leave placeholders.
4. **Validate** with `apexrest_apex_validate` until `diagnostics` is empty: fix the named file and line, rerun. Never ship with errors.
5. **Plan** with `apexrest_ship` `mode:plan`, `env` and `userRequest` (the user's literal instruction). Review `risks`, `sources` and `target`.
6. **Apply** with `apexrest_ship` `mode:apply` and the same `userRequest` when the user asked for the change in that dev/test environment. That explicit request is the authorization: the runtime records a grant bound to this plan and removes it afterwards; the agent does not ask again. The call waits (`waitSeconds` default 60); if still running, read `apexrest_job` `action:status` with the returned `jobId`. Never rerun ship to fetch results.
7. **Verify** visibly changed pages: `apexrest_browser_open` for `env`, then open the returned URL with the selected browser's controls (`codex` host browser or `external` system browser) and check rendering, navigation and the changed interaction, following the [browser verification rule](testing.md#browser-verification). Opening a page is not verification.
8. **Report** files changed, validation result, ship status and `runId`, pages verified in the browser, and anything not verified with its reason.

Blocked, failed or unknown outcomes follow the [safety skill](../plugins/apexrest-apex/skills/apexrest-safety/SKILL.md); missing tools or connections follow the [setup skill](../plugins/apexrest-apex/skills/apexrest-setup/SKILL.md). A completed job can still have failed: inspect its actual result and diagnostics. Existing required suites remain in force; browser observations are recorded separately from automated tests.

The host controls its own execution and collaboration. APEXREST provides Oracle/APEX tools; it does not create model sessions or select models, and has no global chat interceptor. A new session may be needed after plugin installation or update to refresh the host's cached skill and tool catalog.
