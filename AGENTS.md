# Working language

Use English for code, CLI help, agent skill instructions and public documentation. Keep commands, configuration keys and evidence claims consistent. Preserve the original build specification unchanged as historical input.

English-only documentation (user amendment, 2026-10-04): the Ukrainian `.uk.md` companions were retired; do not create or require translations. This amendment supersedes the earlier bilingual rule, which remains visible in the original specification as historical input.

# Source repository

Use https://github.com/apexrest-dev/apexrest as the canonical repository for this project's code and the Git origin.

# Engineering rules

Preserve APEXREST_CODEX_PLUGIN_BUILD_SPEC.md. Use the acceptance matrix in docs/acceptance.json.
Never claim mocks as Oracle/native-host evidence. Keep implementation, verification and blockers separate.
Run relevant checks and update docs/implementation-status.md and docs/next-actions.md.
Do not publish, tag, provision paid resources or mutate an existing database without active authorization.

# Authorized application import rule (user amendment, 2026-09-12)

An explicit request to create, update or import an identified development/test APEX application authorizes the necessary application import within that scope. Complete validation, plan, apply and runtime verification; do not stop at a plan or ask the same permission again. Record existing user authorization as a short-lived, exact-project/target/plan local deploy grant when required by the runtime. Do not invent authorization or widen it to business-table writes, authentication changes, other targets or production. Preserve backup, identity, drift, coordination and unknown-outcome safeguards; production still requires protected external approval.

For an application-only change, use checks appropriate to that change: Oracle compilation, real read-only source-query checks and in-app browser verification. Do not make unrelated empty SQL/E2E suites or installing utPLSQL prerequisites for importing a page. Preserve existing suite results; changing an established required-suite scope needs user authorization. An explicitly authorized isolated application-only profile may declare no automated suites and record its actual source/browser checks separately, never as passed automated SQL/E2E tests. This amendment supersedes conflicting workflow guidance, not the original specification as historical input.

# In-app browser verification rule (user amendment, 2026-09-12)

For user-visible application changes, verify the affected pages and behavior in the selected verification browser (`codex` by default, or `external` when selected in plugin settings) when its controls are available. Follow the browser verification rule in plugins/apexrest-apex/skills/apexrest-work/SKILL.md, step 7. Record actual observations separately from automated test results; if browser access or the deployed change is unavailable, report the missing verification and its reason.

# Clean APEX deployment rule (user amendment, 2026-09-12)

Deploy must work with a clean supported APEX installation. APEXREST control tables are not prerequisites: use local durable migration history and local coordination by default. Do not ask to create service tables merely to unblock a normal plan/apply. Database-backed coordination is an explicit optional environment mode. Explain local versus cross-machine coordination accurately. Preserve identity, backup, approval, drift and unknown-outcome protections. This user amendment supersedes the original specification's mandatory control-table assumption; preserve the original specification as historical input.

Coordination amendment (user decision, 2026-10-06): database-backed coordination was removed in 1.3.0 and stays removed. Plan/apply always use local durable coordination; a legacy `deploymentControl: "local"` is accepted and ignored. Explain that independent machines or managed homes are not coordinated and must be serialized externally. This supersedes the optional database-backed coordination mode described above.
