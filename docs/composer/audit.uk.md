# Аудит реалізації Composer — 2026-09-29

[English](audit.md) | Українська

Поточна реалізація — experimental локальний Composer; приймання CMP-000–041 ще не завершено. [Ledger](ledger.json) та [локальні докази](../evidence/composer-local.json) замінюють попередні загальні твердження про завершення. Наявні тести й справжня offline-компіляція підтверджують перевірену ними поведінку; вони не доводять реалізацію відсутніх вимог.

## Виправлення під час перевірки

- Recovery повторно перевіряє кожний preimage безпосередньо перед записом і всі результати після нього. Deployment блокує будь-який незавершений журнал, зокрема переривання до появи першого state/receipt.
- Fault-тести переривають кожний запис source/base/state/lock та кожну межу journal/receipt, після чого перевіряють явні resume і restore. Невідомі конкурентні зміни зберігаються.
- Перевірений no-op може створити відсутній приватний receipt у свіжому checkout без перезапису tracked source/state.
- Exact procedure binding відхиляє зайві аргументи, неоднозначні overloads, змінені defaults і непідтримувані складені signatures. Варіанти contracts відхиляють чужі поля; імена items з колізіями регістру блокуються.
- Конкурентні зміни всередині opaque code literals потребують явного розв’язання конфлікту. Hosted summary і сторінку-власника потрібно detach разом зі збереженням спільного джерела.
- Project-local drafts доступні в пошуку з явним project. Скасування review пакета змінює catalog digest та робить перевірені плани неактуальними.
- Панель скидає старий план після зміни blueprint і запобігає дубльованим запускам. Читання status допускає lease, видалений завершеним runner, але відхиляє пошкоджений lease.

## Повторна перевірка

Незалежний огляд коду відтворив помилки поза попередньою успішною тестовою матрицею. Регресійні перевірки тепер охоплюють порядок вкладених YAML mappings, перехід summary на окрему сторінку, неповний mapping form/API inputs, спільний аргумент key/version outputs, неоднозначні logical/physical keys, неповні journals, пізній source drift і асинхронне скидання стану панелі. Recovery planning повідомляє compiler evidence лише коли компіляція справді виконувалася. Повторне опитування панелі зберігає прийнятий job ID і зупиняється після обмеженої кількості transport failures; retry перевіряє той самий job.

Ці виправлення посилюють наявні локальні adapters. Вони не закривають решту вимог roadmap нижче й не підтверджують live Oracle behavior.

## Незавершені локальні вимоги

| Roadmap | Виявлене обмеження | Що потрібно завершити |
| --- | --- | --- |
| CMP-003, 013, 017 | Strict schemas охоплюють поточні обмежені adapters; повного contract dialect та незалежно налаштовуваних typed routes немає. | Розширити й перевірити structural producer/consumer compatibility та route mappings. |
| CMP-008–009 | Пошук використовує lexical aliases та exact profile IDs. Qualification консервативна; source/generator staleness перевіряється, але configuration/fixture/toolchain policy неповна. | Пояснювати dimensions профілю, застосовувати незалежні evidence requirements і перевіряти stale/copy/failed evidence. |
| CMP-011, 016, 021, 033 | Allocation і ownership охоплюють сторінки та hosted summary. Shared LOV semantic deduplication, повні resource consumers і typed migration references відсутні. | Додати ownership spans спільних ресурсів, зберігати unmanaged/unknown consumers та реалізувати перевірювані migration references. |
| CMP-031 | Catalog підтримує text previews, JSON parameters, blueprint review і jobs. Повного schema-driven parameter/compatibility інтерфейсу ще немає. | Завершити структуровані поля й навігацію повним plan/diff; зберегти stale-plan та safe-preview перевірки. |
| CMP-035 | Authoring копіює підтримуваний native factory та захоплює declaration facts. Довільний captured APEXlang не нормалізується в новий виконуваний блок. | Реалізувати й перевірити нормалізацію вибраних declarations. |
| CMP-037–038 | Regression-тести охоплюють поточні adapters і recovery на всіх межах запису. Benchmarks вимірюють невеликий локальний harness. | Додати решту property/adversarial/deployment cases і порівняння з recipe adaptation. Не заявляти token savings або наскрізне прискорення. |
| CMP-040–041 | CI definitions, двомовні docs і release blockers є; весь локальний roadmap ще незавершений. | Закрити локальні прогалини й оновити task-specific acceptance перед позначенням roadmap як завершеного. |

## Окрема зовнішня кваліфікація

Live Oracle metadata, fixture DDL/DML, application import, виконання PL/SQL, authorization та authenticated application browser не перевірялися. G4 і залежні runtime gates залишаються відкритими за погодженими межами. Фактичні Linux/Windows CI results і завантаження tools у новому Codex-чаті відділені від macOS tests та перевірки встановленого payload. Публікація, tag і production deployment не входять до цієї роботи.
