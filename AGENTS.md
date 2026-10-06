# Working language

Use English for code, CLI help, agent skill instructions and public documentation. Keep commands, configuration keys and verification claims consistent.

# Source repository

Use https://github.com/apexrest-dev/apexrest as the canonical repository and Git origin.

# Engineering rules

Use the current acceptance matrix in docs/acceptance.json. Run relevant checks and update docs/implementation-status.md and docs/next-actions.md. Never claim fixtures as Oracle or native-host evidence. Keep implementation, verification and blockers separate.

Keep current documentation and functional reference/catalog data in source control. Do not retain obsolete plans, archived rollout reports or release history. Generated verification reports belong in ignored docs/evidence/. Missing required evidence remains a release blocker.

Do not publish, tag, provision paid resources or mutate an existing database without active authorization. CI runs only on pushes to main; repository release and Oracle integration workflows are disabled.

# Application import authorization

An explicit request to create, update or import an identified development/test APEX application authorizes its necessary import. Complete validation, plan, apply and runtime verification without requesting the same permission again. When required, record the user's authorization in a short-lived, exact-project/target/plan local deploy grant. Do not widen scope to business-table writes, authentication changes, other targets or production. Preserve backup, identity, drift, coordination and unknown-outcome safeguards; production requires protected external approval.

For application-only changes, use appropriate Oracle compiler, real read-only source-query and in-app browser checks. Do not add unrelated empty SQL/E2E suites or install utPLSQL just to import a page. Preserve established required-suite scope unless the user authorizes a change. An authorized isolated application-only profile may declare no automated suites and record actual source/browser checks separately, never as passed automated tests.

# Browser verification

For user-visible application changes, inspect affected pages and behavior in the selected verification browser when its controls are available. Follow plugins/apexrest-apex/skills/apexrest-work/SKILL.md, step 7. Record actual observations separately from automated results; report missing browser access or deployed changes with the reason.

# Clean APEX deployment and coordination

Supported APEX installations require no APEXREST control tables or setup DDL. Plan/apply use local durable migration history and coordination. A legacy deploymentControl: "local" is accepted and ignored. Independent machines or managed homes are not coordinated and must be serialized externally. Preserve identity, backup, authorization, drift and unknown-outcome protections.
