# APEXREST Composer

English | [Українська](composer.uk.md)

Composer builds local APEXlang source from exact executable blocks and explicit dataset/API contracts. It extends an existing application and preserves Oracle `.apex`, authentication, authorization and unmanaged bytes. It works in the current Codex chat. The `1.3.0-beta.1` candidate contains 21 MCP tools and 14 focused skills, including `$apexrest-compose`; published 1.2.0 remains the stable release.

## Use a block

```sh
apexrest docs search "форма" --corpus blocks --limit 3
apexrest docs read --id block:crud/report-dialog@1.0.0
apexrest docs read --id blueprint:crm@1.0.0
apexrest compose plan --blueprint app.blueprint.yaml --out plans/composition.json
apexrest compose materialize --plan plans/composition.json --expected-digest SHA256
```

Start with the bundled CRM or Service Desk blueprint. Replace fixture objects and authorization contracts with reviewed project contracts. Offline is the default; `--mode connected --env NAME` explicitly reads bounded parsing-schema metadata without reading business rows. Missing keys, authorization, exact API signatures or supported adapters block planning.

Plan compilation uses the real local SQLcl compiler on a complete staged application. It performs no import or fixture SQL execution. Plans bind blueprint, source inventory, state, catalog/generator, configuration and toolchain digests. Review their contracts, effects, allocations and file preimages before materializing. MCP returns durable jobs and bounded artifacts; poll the existing job ID instead of rerunning work.

## Catalog

The panel Catalog searches EN/UK aliases and shows contracts, parameters, effects, provenance and independent qualification. Add to blueprint presents a diff before an explicit local write. Plan runs offline; Materialize requires a current materializable plan. Source previews are text and never execute catalog HTML/JavaScript. Discovery also supports `corpus: blocks|blueprints`; existing defaults remain `apexlang`.

Six experimental blocks implement report/API dialog, status summary, filtered list, read-only detail, history timeline and a self-referencing master-detail read view. CRM demonstrates list → API dialog → refresh list and summary. Service Desk demonstrates read views over tickets. These are bounded first adapters, not arbitrary APEX transformers.

## Qualification and maintenance

See [contracts](composer/contracts.md), [maintenance and recovery](composer/maintenance.md), [authoring](composer/authoring.md), [security](composer/security.md), [qualification](composer/qualification.md), the [42-task ledger](composer/ledger.json) and [ADR](adr/009-composer-local.md).

Tracked `.apexrest-composer/` holds ownership, lockfile and immutable generation bases. Private `.apexrest/composer/` holds staging, cache, plans, receipts and journals. Source-only drafts require both `--validation source-only` and explicit `composer.allowSourceOnly: true`; a compiler failure never silently falls back. Materialization writes local source only. Deployment separately uses the existing policy-aware pipeline, including both full-export and working-copy modes and v1/v2 reading plus Composer-bound v3 plans.

Live Oracle metadata, fixture DDL/DML, changed imports and authenticated application browser qualification remain a separately authorized stage. G4 and dependent runtime release gates remain open. No npm publication, tagging or production deployment is part of this delivery.
