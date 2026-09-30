# ADR 009: Local deterministic Composer

English | [Українська](009-composer-local.uk.md)

## Decision

Use the current-session core, existing jobs/artifacts and policy-aware deployment rather than a separate application/session controller. Blocks are exact immutable packages selecting reviewed native renderers with typed entity/API contracts. YAML 2.x AST is parsed before strict Zod validation; schema generation has one source of truth. The initial profile binds APEX/UT 26.1 and MMD 26.1.0+3102.

## Storage and safety

Tracked ownership/lock/generated bases live in `.apexrest-composer/`; private staging/cache/journals/receipts live in `.apexrest/`. Materialization is local, deterministic, journaled and drift checked. Unknown or overlapping edits block. Composer and deployment share a local project lock; deployment v3 adds an exact generation binding while v1/v2 and both deployment modes remain readable.

## Threat model and acceptance

Reject malicious YAML, escaping/symlink paths, tampered same-version packages, unreviewed origins, copied/stale evidence, ambiguous API overloads, missing authorization, stale plans, collisions and unknown concurrent writes. Catalog text never becomes instructions or executable previews. Package hooks and implicit downloads are absent. Local compiler evidence never substitutes for live Oracle/roles/browser; G4 and dependent runtime gates stay open. See the [ledger](../composer/ledger.json) and [acceptance](../acceptance.json).
