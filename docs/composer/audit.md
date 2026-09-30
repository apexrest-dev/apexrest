# Composer implementation audit — 2026-09-29

English | [Українська](audit.uk.md)

The current implementation is an experimental local Composer, not completed CMP-000–041 acceptance. The [ledger](ledger.json) and [local evidence](../evidence/composer-local.json) supersede earlier blanket completion statements. Existing tests and real offline compilation establish the behavior they exercise; they do not establish unimplemented requirements.

## Corrections made during verification

- Recovery now rechecks each preimage immediately before writing and validates all resulting images. Deployment blocks any pending journal, including interruption before the first state/receipt exists.
- Fault tests interrupt every source/base/state/lock write and each journal/receipt boundary, then exercise explicit resume and restore. Unknown concurrent bytes are retained.
- A reviewed no-op can establish a missing private receipt in a fresh checkout without rewriting tracked source/state.
- Exact procedure binding rejects extra arguments, ambiguous overloads, changed defaults and unsupported compound signatures. Contract variants reject fields belonging to other variants; case-colliding item names are rejected.
- Concurrent changes inside opaque code literals require explicit conflict resolution. Hosted summary/page detach must preserve their shared source together.
- Project-local drafts are discoverable with an explicit project. Withdrawing package review changes the catalog digest and invalidates reviewed plans.
- Panel controls discard old plans after blueprint changes and prevent duplicate composition starts. A release/status read tolerates a lease removed by a completed runner while still rejecting corrupt leases.

## Second verification pass

Independent code review reproduced failures outside the previous green test matrix. Regression coverage now includes nested YAML mapping order, a summary becoming a standalone page, incomplete form/API input mappings, aliased key/version outputs, ambiguous logical/physical keys, incomplete journals, late source drift and asynchronous panel invalidation. Recovery planning reports compiler evidence only when compilation actually ran. Panel status retries retain the accepted job ID and stop after bounded transport failures; retry observes the same job.

These corrections strengthen the existing local adapters. They do not close the remaining roadmap requirements below or establish live Oracle behavior.

## Remaining local requirements

| Roadmap | Observed limitation | Required completion |
| --- | --- | --- |
| CMP-003, 013, 017 | Strict schemas cover the current finite adapters; they do not implement the full contract dialect and independently configurable typed routes. | Expand and test structural producer/consumer compatibility and route mappings. |
| CMP-008–009 | Discovery uses lexical aliases and exact profile IDs. Qualification remains conservative; source/generator evidence staleness is checked, but configuration/fixture/toolchain policy is incomplete. | Explain profile dimensions, enforce independent evidence requirements and test stale/copy/failed evidence. |
| CMP-011, 016, 021, 033 | Allocation and ownership cover pages plus the hosted summary. Shared LOV semantic deduplication, complete resource consumers and typed migration references are absent. | Add shared-resource span ownership, retain unmanaged/unknown consumers and implement a reviewed migration reference seam. |
| CMP-031 | Catalog supports text previews, JSON parameters, blueprint review and jobs. It lacks the full schema-driven parameter/compatibility experience. | Finish structured fields and full plan/diff navigation; retain stale-plan and safe-preview checks. |
| CMP-035 | Authoring clones a supported native factory and captures declaration facts. It does not normalize arbitrary captured APEXlang into a new executable block. | Implement and verify the selected-declaration normalization workflow. |
| CMP-037–038 | Regression tests cover the current adapters and complete write-boundary recovery. Benchmarks measure a small local harness. | Add remaining property/adversarial/deployment cases and matched recipe-adaptation measurements. Do not claim token savings or end-to-end speedups. |
| CMP-040–041 | CI definitions, paired documentation and release blockers exist; the full local roadmap is still incomplete. | Close local gaps and update task-specific acceptance before marking the roadmap complete. |

## Separate external qualification

Live Oracle metadata, fixture DDL/DML, application import, PL/SQL execution, authorization and authenticated application browser checks were not run. G4 and dependent runtime gates stay open as agreed. Actual Linux/Windows CI results and tool loading in a new Codex chat are separate from macOS tests and installed-payload verification. No publication, tag or production deployment is included.
