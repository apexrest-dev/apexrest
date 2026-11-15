# Composer (experimental CLI)

Composer builds local APEXlang from exact executable blocks and explicit dataset/API contracts. This page is for developers who want to try composing an application from a blueprint with `apexrest compose`.

## When to use

- You have a blueprint (`app.blueprint.yaml`) and reviewed dataset/API contracts for your project.
- You want generated source that keeps Oracle `.apex` metadata, authentication, authorization and unmanaged source intact.
- You work from the CLI. Composer is available through `apexrest compose`; MCP reference search/read can inspect block and blueprint data.

Composer is experimental. See [Authoring and qualification](#authoring-and-qualification) for what still needs work.

## Plan and materialize

1. Find and read the blocks and blueprints you need:

   ```sh
   apexrest docs search "report dialog" --corpus blocks --limit 3
   apexrest docs read --id block:crud/report-dialog@1.0.0
   apexrest docs read --id blueprint:crm@1.0.0
   ```

2. Replace fixture objects and authorization declarations with reviewed project contracts.

3. Choose a profile explicitly (see [Profiles](#profiles)).

4. Create the plan:

   ```sh
   apexrest compose plan --blueprint app.blueprint.yaml --out plans/composition.json
   ```

   - Offline planning is the default. `--mode connected --env NAME` explicitly reads bounded parsing-schema metadata.
   - Planning compiles a complete staged application with real local SQLcl. It performs no import and no fixture SQL execution.
   - Missing keys, authorization, exact API signatures or supported adapters block planning.

5. Review the plan. Plans bind blueprint, source inventory, state, catalog/generator, configuration and toolchain digests. Review contracts, effects, allocations and preimages before materializing.

6. Materialize the plan:

   ```sh
   apexrest compose materialize --plan plans/composition.json --expected-digest SHA256
   ```

7. Materialized source then follows the normal validate/ship cycle.

### Profiles

| Version  | Contract                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@1.0.0` | The original blocks and CRM/Service Desk blueprints retain their 26.1 contract.                                                                                    |
| `@1.1.0` | `profile:apex262-ut262-mmd3479`, vendor MMD `26.2.0+3479` and SQLcl build `26.3.0.260.1620`. The blueprint files are `crm-26.2.yaml` and `service-desk-26.2.yaml`. |

- Composer rejects mismatched compiler builds/MMDs with `PROFILE_COMPILER_MISMATCH`. The error names:
  - the pinned build and MMD, and the installed ones;
  - the bundled profile and blueprints that match the installed compiler (for example the 26.2 blueprints for SQLcl `26.3.0.260.1620`);
  - the pinned SQLcl to select with `APEXREST_SQLCL` instead.
- The 26.2 adapters emit the exact report type enums and stable numeric process execution mappings.
- Prior 26.1 compiler records do not qualify 26.2 or the current generator.
- No profile selection rewrites Oracle metadata.

## Contracts and security

**Input validation.** Strict YAML AST/schema validation rejects duplicate keys, aliases, tags, unsafe keys, escaping paths, symlinks and oversized input.

**Entities** require:

- scalar field types;
- an ordered key;
- explicit row-read authorization.

**Write adapters** require:

- exact PL/SQL mappings;
- editable fields;
- version checks;
- write authorization;
- errors;
- caller-owned transaction semantics.

The API independently enforces row authorization and expected versions. A successful save returns authoritative key/version before dialog close.

**Renderers.** Native IR, modal forms, Cards and read views provide six experimental renderers and the CRM/Service Desk blueprints. They are bounded adapters with explicit dependencies.

**Trust.** Catalog data and previews remain untrusted text; search does not execute HTML, JavaScript or SQL. Bundled origin and package hashes do not establish live runtime qualification.

## Ownership and recovery

| Directory             | Kind    | Holds                                           |
| --------------------- | ------- | ----------------------------------------------- |
| `.apexrest-composer/` | Tracked | Ownership, locks and immutable generation bases |
| `.apexrest/composer/` | Private | Staging, cache, plans, receipts and journals    |

- **Merge.** Three-way merge compares generated base, local source and new generated source. Overlap, unknown anchors and edited deletion targets block.
- **Detach.** Detach retains source.
- **Removal.** Removal deletes only confirmed unchanged owned files. Remaining or unknown consumers prevent cleanup.
- **Materialization.** Materialization freezes the plan, checks source drift and journals each write under a shared local project lock.
- **Interrupted work.** Interrupted work needs explicit resume/restore. Unknown concurrent bytes require reconciliation.
- **Restore limits.** Local restoration never rolls back business data.
- Preserve active bases and unresolved journals.

## Authoring and qualification

To author a block package:

1. Use `npm run composer:author` for a contained source package, explicit license and reviewed ID/version. Capture produces declaration facts, not runtime equivalence.
2. Local packages require an independent tracked content-digest review.
3. Run the catalog/build and real offline compiler checks:

   ```sh
   npm run composer:catalog
   npm run composer:check
   npm run composer:verify
   ```

Limits:

- Source-only drafts require explicit `--validation source-only` and `composerSourceDrafts` policy. They remain unqualified.
- Shared-resource ownership, broader property/fault cases and authenticated Oracle/browser behavior still need work.
- Missing required qualification blocks release readiness.

## Related

- [Acceptance matrix](acceptance.json)
- [Testing](testing.md)
- [Next actions](next-actions.md)
