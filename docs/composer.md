# APEXREST Composer (experimental, CLI only)

Composer builds local APEXlang source from exact executable blocks and explicit dataset/API contracts. It extends an existing application and preserves Oracle `.apex`, authentication, authorization and unmanaged bytes.

**Status.** Composer is experimental and reachable only through the CLI (`apexrest compose plan|materialize`, `apexrest docs search --corpus blocks|blueprints`). The redesign removed its MCP tools (`apexrest_compose_plan`, `apexrest_compose_materialize`), the `$apexrest-compose` skill and the panel Catalog; the `apexrest_reference` tool still accepts `corpus: "blocks"` and `corpus: "blueprints"` for offline reading. A later phase replaces the block library with an **App Spec compiler** that turns a reviewed application specification into APEXlang through the same validate/ship cycle; until then, treat Composer as a maintained prototype, not the primary way to generate applications. The published `1.3.0-beta.1` package still ships the Composer MCP tools and skill described in its [release notes](release-notes.md).

## Use a block

```sh
apexrest docs search "форма" --corpus blocks --limit 3
apexrest docs read --id block:crud/report-dialog@1.0.0
apexrest docs read --id blueprint:crm@1.0.0
apexrest compose plan --blueprint app.blueprint.yaml --out plans/composition.json
apexrest compose materialize --plan plans/composition.json --expected-digest SHA256
```

Start with the bundled CRM or Service Desk blueprint. Replace fixture objects and authorization contracts with reviewed project contracts. Offline is the default; `--mode connected --env NAME` explicitly reads bounded parsing-schema metadata without reading business rows. Missing keys, authorization, exact API signatures or supported adapters block planning.

Plan compilation uses the real local SQLcl compiler on a complete staged application. It performs no import or fixture SQL execution. Plans bind blueprint, source inventory, state, catalog/generator, configuration and toolchain digests. Review their contracts, effects, allocations and file preimages before materializing. Materialized source then goes through the ordinary `apexrest_apex_validate` and `apexrest_ship` cycle.

## Blocks and blueprints

Six experimental blocks implement report/API dialog, status summary, filtered list, read-only detail, history timeline and a self-referencing master-detail read view. CRM demonstrates list → API dialog → refresh list and summary. Service Desk demonstrates read views over tickets. These are bounded first adapters, not arbitrary APEX transformers. Discovery searches EN/UK aliases and returns contracts, parameters, effects, provenance and independent qualification; source previews are text and never execute catalog HTML/JavaScript.

## Qualification and maintenance

See [contracts](composer/contracts.md), [maintenance and recovery](composer/maintenance.md), [authoring](composer/authoring.md), [security](composer/security.md), [qualification](composer/qualification.md), the [42-task ledger](composer/ledger.json), the [audit](composer/audit.md) and [ADR 009](adr/009-composer-local.md). Those pages predate the removal of the Composer MCP tools and panel; references to panel controls or MCP routes in them are historical.

The [Composer implementation plan](../APEXREST_COMPOSER_IMPLEMENTATION_PLAN.md) is historical working input, written in Ukrainian and preserved unchanged without an English companion. It describes planned work, not the current product contract; the audit and ledger record actual status.

Tracked `.apexrest-composer/` holds ownership, lockfile and immutable generation bases. Private `.apexrest/composer/` holds staging, cache, plans, receipts and journals. Source-only drafts require both `--validation source-only` and explicit `composer.allowSourceOnly: true`; a compiler failure never silently falls back. A source-only materialization cannot bind into a deployment plan (`COMPOSITION_UNQUALIFIED`); replan with compiler validation before deploying. Each owned source is limited to 1 MiB; a larger generated plan is blocked with `PLAN_LIMIT`. Materialization writes local source only. Deployment separately uses the existing policy-aware pipeline, including both full-export and working-copy modes and v1/v2 reading plus Composer-bound v3 plans.

Live Oracle metadata, fixture DDL/DML, changed imports and authenticated application browser qualification remain a separately authorized stage. G4 and dependent runtime release gates remain open. No npm publication, tagging or production deployment is part of this delivery.
