# ADR 009: Локальний детермінований Composer

[English](009-composer-local.md) | Українська

## Рішення

Використовувати current-session core, чинні jobs/artifacts і policy-aware deployment замість окремого application/session controller. Blocks є точними immutable packages, що вибирають погоджені native renderers із typed entity/API contracts. YAML 2.x AST читається перед strict Zod validation; schema generation має єдине джерело істини. Початковий profile прив’язує APEX/UT 26.1 і MMD 26.1.0+3102.

## Storage та безпека

Tracked ownership/lock/generated bases зберігаються в `.apexrest-composer/`; private staging/cache/journals/receipts — у `.apexrest/`. Materialization є local, deterministic, journaled і перевіряє drift. Unknown або overlapping edits блокуються. Composer і deployment мають спільний local project lock; deployment v3 додає exact generation binding, зберігаючи читання v1/v2 та обох deployment modes.

## Threat model та acceptance

Відхиляються malicious YAML, escaping/symlink paths, tampered same-version packages, unreviewed origins, copied/stale evidence, ambiguous API overloads, missing authorization, stale plans, collisions та unknown concurrent writes. Catalog text не стає instructions або executable previews. Package hooks та implicit downloads відсутні. Local compiler evidence не замінює live Oracle/roles/browser; G4 і залежні runtime gates залишаються відкритими. Дивіться [ledger](../composer/ledger.json) та [acceptance](../acceptance.json).
