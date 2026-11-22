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

Connected row predicates may reference unquoted columns verified in the selected Oracle object's dictionary metadata. For source-only work, list any non-projected authorization columns in the authorization contract's `predicateColumns`. Write authorization expressions can use the supported server session binds and authorization functions.

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

### Shared enum lists

Writable string fields with a supported literal `enum` use managed native shared LOVs. Identical ordered values in the same pinned profile share one immutable resource across form instances. Values must be distinct, nonempty literal text; use `nullable` for nullability. The shared adapter does not support markup, APEX substitutions or implicit defaults. Native entry nodes preserve punctuation, quotes and Unicode without a delimiter-based `STATIC:` encoding.

Existing numeric, temporal and otherwise valid string enumerations outside that adapter retain their text fields and server validation; the plan explains the shared-LOV limit. Empty, duplicate or explicitly empty-array enum declarations are rejected because they cannot establish the intended Oracle membership check.

APEX 26.1 keeps owned LOV declarations inside the native `shared-components/lovs.apx` container and preserves unrelated declarations and surrounding bytes. APEX 26.2 uses individual files. Resource state is optional, so reading historical state, saved plans and journals does not insert defaults or change their digests. Composer refuses unmanaged alias/name/path collisions and edits to an owned definition.

Changing values allocates another resource. Retired resources remain tracked and unchanged for detached or unknown consumers, with an explicit diagnostic. Automatic resource deletion and adoption are unsupported; at most 512 resources may be tracked within the existing document limits. Review any cleanup separately and preserve active ownership and recovery records.

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

- Source-only drafts require explicit `--validation source-only` and the project setting `composer.allowSourceOnly`. They remain unqualified.
- Managed string-enum LOV ownership has local preservation, legacy-state and both-profile offline compiler checks. Broader property/fault cases and authenticated Oracle/browser behavior still need qualification.
- Missing required qualification blocks release readiness.

## Related

- [Acceptance matrix](acceptance.json)
- [Testing](testing.md)
- [Next actions](next-actions.md)
