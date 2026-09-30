# APEXREST Composer

[English](composer.md) | Українська

Composer складає локальні APEXlang sources із точних версій виконуваних блоків і явних dataset/API contracts. Він розширює наявний додаток і зберігає Oracle `.apex`, authentication, authorization та unmanaged bytes. Робота залишається в поточному Codex-чаті. Кандидат `1.3.0-beta.1` містить 21 MCP tool і 14 focused skills, зокрема `$apexrest-compose`; опублікований 1.2.0 залишається стабільним випуском.

## Використати блок

```sh
apexrest docs search "форма" --corpus blocks --limit 3
apexrest docs read --id block:crud/report-dialog@1.0.0
apexrest docs read --id blueprint:crm@1.0.0
apexrest compose plan --blueprint app.blueprint.yaml --out plans/composition.json
apexrest compose materialize --plan plans/composition.json --expected-digest SHA256
```

Почніть із bundled CRM або Service Desk blueprint. Замініть fixture objects та authorization contracts погодженими contracts проєкту. Offline — типовий режим; `--mode connected --env NAME` явно читає bounded metadata parsing schema без business rows. Відсутні keys, authorization, точні API signatures або підтримувані adapters блокують planning.

Plan compilation використовує справжній локальний SQLcl compiler для повного staged application. Він не виконує import або fixture SQL. Plans прив’язують digests blueprint, source inventory, state, catalog/generator, configuration і toolchain. Перед materialization перегляньте contracts, effects, allocations і file preimages. MCP повертає durable jobs і bounded artifacts; очікуйте наявний job ID замість повторного запуску.

## Catalog

Catalog у панелі шукає EN/UK aliases і показує contracts, parameters, effects, provenance та незалежну qualification. Add to blueprint показує diff перед явним локальним записом. Plan працює offline; Materialize потребує актуального materializable plan. Source previews є текстом і не виконують catalog HTML/JavaScript. Discovery також підтримує `corpus: blocks|blueprints`; чинний default залишається `apexlang`.

Шість experimental blocks реалізують report/API dialog, status summary, filtered list, read-only detail, history timeline і self-referencing master-detail read view. CRM демонструє list → API dialog → refresh list і summary. Service Desk демонструє read views для tickets. Це обмежені початкові adapters, а не довільні APEX transformers.

## Кваліфікація та підтримка

Дивіться [contracts](composer/contracts.uk.md), [підтримку й recovery](composer/maintenance.uk.md), [authoring](composer/authoring.uk.md), [безпеку](composer/security.uk.md), [qualification](composer/qualification.uk.md), [ledger 42 задач](composer/ledger.json) і [ADR](adr/009-composer-local.uk.md).

Tracked `.apexrest-composer/` містить ownership, lockfile та immutable generation bases. Private `.apexrest/composer/` містить staging, cache, plans, receipts і journals. Source-only drafts потребують одночасно `--validation source-only` та явного `composer.allowSourceOnly: true`; помилка compiler не спричиняє тихий fallback. Materialization записує тільки local source. Deployment окремо використовує чинний policy-aware pipeline, з обома режимами full-export і working-copy, читанням v1/v2 та Composer-bound v3 plans.

Live Oracle metadata, fixture DDL/DML, змінені imports та authenticated application browser qualification залишаються наступним окремо дозволеним етапом. G4 і залежні runtime release gates залишаються відкритими. npm publication, tagging і production deployment не входять у цю доставку.
