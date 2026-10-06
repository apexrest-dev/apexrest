# Composer (experimental CLI)

Composer builds local APEXlang from exact executable blocks and explicit dataset/API contracts. It preserves Oracle `.apex` metadata, authentication, authorization and unmanaged source. It is available through `apexrest compose`; MCP reference search/read can inspect block and blueprint data.

## Plan and materialize

```sh
apexrest docs search "report dialog" --corpus blocks --limit 3
apexrest docs read --id block:crud/report-dialog@1.0.0
apexrest docs read --id blueprint:crm@1.0.0
apexrest compose plan --blueprint app.blueprint.yaml --out plans/composition.json
apexrest compose materialize --plan plans/composition.json --expected-digest SHA256
```

Replace fixture objects and authorization declarations with reviewed project contracts. Offline planning is the default; `--mode connected --env NAME` explicitly reads bounded parsing-schema metadata. Planning compiles a complete staged application with real local SQLcl and performs no import or fixture SQL execution.

Plans bind blueprint, source inventory, state, catalog/generator, configuration and toolchain digests. Review contracts, effects, allocations and preimages before materializing. Materialized source then follows the normal validate/ship cycle. Missing keys, authorization, exact API signatures or supported adapters block planning.

## Contracts and security

Strict YAML AST/schema validation rejects duplicate keys, aliases, tags, unsafe keys, escaping paths, symlinks and oversized input. Entities require scalar field types, an ordered key and explicit row-read authorization. Write adapters require exact PL/SQL mappings, editable fields, version checks, write authorization, errors and caller-owned transaction semantics. The API independently enforces row authorization and expected versions; a successful save returns authoritative key/version before dialog close.

Native IR, modal forms, Cards and read views provide six experimental renderers and the CRM/Service Desk blueprints. They are bounded adapters with explicit dependencies. Catalog data and previews remain untrusted text; search does not execute HTML, JavaScript or SQL. Bundled origin and package hashes do not establish live runtime qualification.

## Ownership and recovery

Tracked `.apexrest-composer/` holds ownership, locks and immutable generation bases. Private `.apexrest/composer/` holds staging, cache, plans, receipts and journals. Three-way merge compares generated base, local source and new generated source; overlap, unknown anchors and edited deletion targets block.

Detach retains source. Removal deletes only confirmed unchanged owned files; remaining or unknown consumers prevent cleanup. Materialization freezes the plan, checks source drift and journals each write under a shared local project lock. Interrupted work needs explicit resume/restore; unknown concurrent bytes require reconciliation. Local restoration never rolls back business data. Preserve active bases and unresolved journals.

## Authoring and qualification

Use `npm run composer:author` for a contained source package, explicit license and reviewed ID/version. Capture produces declaration facts, not runtime equivalence. Local packages require an independent tracked content-digest review. Run `npm run composer:catalog`, `npm run composer:check` and `npm run composer:verify` for catalog/build and real offline compiler checks.

Source-only drafts require explicit `--validation source-only` and `composerSourceDrafts` policy; they remain unqualified. Shared-resource ownership, broader property/fault cases and authenticated Oracle/browser behavior still need work. See [acceptance](acceptance.json), [testing](testing.md) and [next actions](next-actions.md). Missing required qualification blocks release readiness.
