# Local composition workflow

Search exact bundled IDs with `docs search --corpus blocks`; read using `docs read --id block:crud/report-dialog@1.0.0`. Bundled `blueprint:crm@1.0.0` and `blueprint:service-desk@1.0.0` show the contract dialect. Replace fixture identities and reviewed contracts for your own project. Profile: `profile:apex261-ut261-mmd3102` (APEX 26.1 / UT 26.1).

```sh
apexrest compose plan --blueprint app.blueprint.yaml --out plans/composition.json
apexrest compose materialize --plan plans/composition.json --expected-digest SHA256
apexrest compose plan --action recover-resume --out plans/recovery.json
```

Offline planning never queries a database. Connected planning uses `--mode connected --env DEV` and the existing parsing-schema metadata reader. It does not read business rows. Full plans and diagnostics are private artifacts; tracked ownership, exact package lock and available generation bases live in `.apexrest-composer/`.

Source-only validation requires both an explicit `--validation source-only` and project `composer.allowSourceOnly: true`. It remains unqualified and is never a fallback after failed compilation. Before deployment, replan with compiler validation and perform separately authorized runtime qualification.

The first API adapter maps `record.<field>` inputs to scalar PL/SQL arguments with explicit IN/OUT modes. An edit draft requires the persisted key/version; a create draft starts with both null. Key/version are not editable fields. The bound API independently enforces row-write authorization and expected-version predicates. The save response must include authoritative key/version before a dialog can emit `saved`. Cancel invokes no API.
