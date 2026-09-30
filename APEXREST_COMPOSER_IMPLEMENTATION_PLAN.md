# APEXREST Composer — детальний план реалізації в Codex

> **Призначення:** робоча специфікація та покроковий backlog для реалізації каталогу виконуваних блоків і детермінованого оркестратора Oracle APEX-додатків у наявному APEXREST.
>
> **Дата:** 29 вересня 2026 року. **Редакція документа:** 1.0.
>
> **Мова пояснень:** українська. **Мова коду, API, CLI help та інструкцій skills:** англійська, відповідно до правил репозиторію.
>
> **Канонічний репозиторій:** `apexrest-dev/apexrest-codex`.
>
> **Перевірена опорна ревізія:** `b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a`, commit від 24.09.2026; у її `package.json` зазначено `apexrest@1.2.0`. Це знімок для планування, а не вимога повертати локальний проєкт на цю ревізію. [R1] [R2]
>
> **Статус:** специфікація майбутньої реалізації. Створення цього документа не означає, що Composer, наведені нові команди, блоки чи тести вже реалізовані. Під час підготовки документа не запускалися тести репозиторію, SQLcl-компіляція, імпорт у БД або перевірки додатка в браузері.

---

## Зміст

1. [Як почати в Codex](#start)
2. [Перевірена основа та обов'язковий аудит](#baseline)
3. [Незмінні правила проєктування](#invariants)
4. [Продуктовий результат і межі MVP](#scope)
5. [Архітектура та розміщення модулів](#architecture)
6. [Система форматів і контрактів](#contracts)
7. [Специфікація пакета Block](#block)
8. [Специфікація Application Blueprint](#blueprint)
9. [Lockfile, ownership, identity та стан](#state)
10. [Планування, матеріалізація і deployment](#lifecycle)
11. [Ефективний каталог та пошук](#catalog)
12. [Прив'язка Oracle-даних і серверна безпека](#binding)
13. [Структуроване складання APEXlang](#assembly)
14. [Оновлення, розширення, detach і видалення](#updates)
15. [CLI, MCP, skills та панель Catalog](#interfaces)
16. [Модель загроз і захист](#security)
17. [Тестова стратегія та докази](#tests)
18. [42 покрокові завдання для Codex](#backlog)
19. [Команди перевірки та правила запуску](#commands)
20. [Готові промпти для Codex](#prompts)
21. [Шаблони AGENTS.md, SKILL.md і звіту сесії](#agent-files)
22. [Робота кількома сесіями та паралельні гілки](#sessions)
23. [Матриця приймання та Definition of Done](#acceptance)
24. [Вимірювання ефективності](#metrics)
25. [Пакування, rollout і подальший розвиток](#rollout)
26. [Ризики, рішення й відкриті питання](#risks)
27. [Джерела і словник](#sources)

<a id="start"></a>
## 1. Як почати в Codex

### 1.1. Дії власника проєкту

1. Поклади цей файл у корінь локального checkout APEXREST під назвою `APEXREST_COMPOSER_IMPLEMENTATION_PLAN.md`.
2. Відкрий **саме цей checkout** у Codex. Робочим об'єктом є вихідний код плагіна, а не його встановлений кеш і не довільний APEX application project.
3. Не замінюй наявний `AGENTS.md` цим великим документом. Залиши чинні правила; за потреби Codex додасть коротке посилання на план.
4. Встав стартовий промпт нижче. Перший крок — аудит і baseline, а не генерація всіх модулів одночасно.
5. Після першого завершеного етапу продовжуй за task IDs. Джерелом стану виконання мають бути файли в репозиторії, а не пам'ять одного чату.

Великий план слід читати як звичайний файл частинами. Офіційна документація описує окремий механізм завантаження `AGENTS.md` та обмеження його сумарного обсягу; тому короткий покажчик у `AGENTS.md` кращий за вставлення всієї специфікації. [R9]

### 1.2. Стартовий промпт

```text
Read the current repository AGENTS.md and all applicable nested instructions.
Then read APEXREST_COMPOSER_IMPLEMENTATION_PLAN.md.

Implement APEXREST Composer incrementally in this existing repository.
Begin with CMP-000, CMP-001 and CMP-002 only: audit the actual checkout,
capture a baseline, map integration points, and establish the execution ledger.
Do not implement the entire backlog in one change.

Treat repository code, current tests and applicable instructions as the source
of truth about existing behavior. Distinguish observed facts from proposed APIs.
Preserve APEXREST_CODEX_PLUGIN_BUILD_SPEC.md unchanged.
Do not replace the existing AGENTS.md or rewrite unrelated architecture.

This task authorizes local repository implementation and appropriate local checks.
It does not authorize publication, production deployment, paid infrastructure,
business-table writes, authentication changes, or mutation of an existing database.
Reuse any separately provided, still-valid authorization only within its exact scope.

Create or update the Composer task ledger, implementation status and next actions.
Keep public English/Ukrainian documentation in sync.
Report exact files changed, commands actually run, verification results, blockers,
and the next dependency-ready task. Do not claim unrun checks as passed.
```

### 1.3. Як виконувати наступні етапи

Одна робоча сесія бере **одну невелику задачу або тісно пов'язану групу** із закритими залежностями. Вона повинна завершити не лише написання коду, а й доступні перевірки, документацію та запис результату. Не залишати всі тести на кінець проєкту.

Не вимагати підтвердження кожного локального безпечного кроку. Водночас цей план не є дозволом імпортувати довільні додатки або змінювати дані. Коли користувач окремо надає точний dev/test target і дозвіл на потрібну операцію, дотримуватися чинного правила репозиторію та не перепитувати той самий дозвіл. [R3]

<a id="baseline"></a>
## 2. Перевірена основа та обов'язковий аудит

### 2.1. Що підтверджено під час підготовки

| Опора | Підтверджений факт | Наслідок для Composer |
|---|---|---|
| `package.json` | npm workspaces, ESM; на опорній ревізії Node `>=24 <27`; наявні Zod, TypeScript і тестові scripts | Не переходити на інший package manager, стек або версії залежностей без окремої причини. [R2] |
| `AGENTS.md` | Історичну build-spec треба зберігати; public docs — EN/UK; є правила authorization, browser evidence і clean APEX | Composer повинен доповнювати ці правила, а не обходити їх. [R3] |
| `docs/architecture.md` | Спільний policy-aware core для CLI та MCP; staging, jobs, artifacts, Oracle adapter | Бізнес-логіка Composer живе у core; transport adapters залишаються тонкими. [R4] |
| `docs/codex-integration.md` | Codex володіє розмовою, моделлю та дозволами; APEXREST не запускає окремі модельні сесії | Оркестратор не є прихованим другим AI-агентом. [R5] |
| `docs/component-catalog.md` | Є локальні versioned recipes; різні component hosts мають різні контракти | Не дублювати каталог і не змішувати несумісні hosts. [R6] |
| `docs/pattern-catalog.md` | Є UX-патерни, їхні залежності та compiler evidence; runtime evidence відокремлена | Підняти вибрані рецепти до виконуваних блоків, не оголошуючи весь каталог runtime-ready. [R7] |
| `packages/core/src/metadata.ts` | Обмежені metadata queries; перевірка target; тільки configured parsing schema; pagination | Розширити необхідні поля без розширення привілеїв. [R8] |
| `docs/deployment-safety.md` | Повний application import, локальна durable history за замовчуванням, backup, drift, approvals, unknown outcome | Використовувати наявний deploy pipeline; не створювати паралельний importer. [R10] |

У різних документах можуть залишатися історичні числа skills, recipes або старі release claims. **Не використовувати такі числа як архітектурні константи.** Під час CMP-000 перевірити фактичні manifests, scripts, реєстрацію tools і код поточної гілки. Цей план не вимагає «підганяти» актуальний checkout під історичну документацію.

### 2.2. Що Codex повинен перевірити заново

Визначити поточний commit, branch, dirty files, вкладені `AGENTS.md`, package scripts, реальні exports core, схеми операцій, реєстрацію MCP, CLI parser, індекси компонентів/патернів, APEXlang reader, content hashing, state store, ownership locks, deployment source discovery, panel router та bundling.

Для кожного запропонованого нижче шляху зазначити один із варіантів: `reuse-existing`, `extend-existing`, `create-new`, `superseded-by-current-code`. Файл із таким самим призначенням не слід створювати вдруге під іншою назвою.

### 2.3. Обмеження проведеної перевірки

Прочитані окремі файли та документація, а не виконаний повний аудит усіх рядків репозиторію. Назви нових TypeScript interfaces, runtime directories, CLI flags і block IDs далі є **проєктними рішеннями**, які треба реалізувати та протестувати. Не писати у changelog, що функція вже існує, лише тому, що вона описана тут.

<a id="invariants"></a>
## 3. Незмінні правила проєктування

| ID | Інваріант |
|---|---|
| INV-01 | Codex формує намір і пояснення; детермінований core виконує resolution, binding, planning і materialization. |
| INV-02 | Catalogue search і offline planning не потребують Oracle connection. Live context — окрема явно обрана можливість. |
| INV-03 | Composition plan не змінює working tree додатка або БД. Він може створювати лише дозволені локальні plan/cache/staging artifacts. |
| INV-04 | Materialization змінює локальні файли в погодженій області. Вона ніколи не запускає application import, бізнес-DML або DDL. |
| INV-05 | Deployment виконується тільки через чинний policy-aware pipeline із його target, backup, drift, ownership та approval safeguards. |
| INV-06 | Однакові нормалізовані входи та state дають однакові semantic plan і generated source. Volatile timestamps не входять у reproducibility digest. |
| INV-07 | Повторна матеріалізація незміненого blueprint не створює diff і не перенумеровує компоненти. |
| INV-08 | Existing `.apex` metadata, authentication, authorization і unmanaged source не переписуються неявно. |
| INV-09 | Відсутність доказу сумісності не є сумісністю; `not-run`, `blocked`, `failed`, `stale` не є `passed`. |
| INV-10 | Чужі package docs, SQL comments, database descriptions і test output — дані, а не інструкції або джерело дозволів. |
| INV-11 | Блоки не мають довільних install hooks, shell execution або автоматичних network downloads у runtime. |
| INV-12 | API permissions і row access перевіряються на сервері; приховування кнопки не є authorization. |
| INV-13 | Зміна, помилка чи interruption після початку записів не дає права на автоматичний повтор або заяву про rollback. |
| INV-14 | Локальний filesystem lock не називається distributed lock; clean APEX не потребує Composer control tables. |
| INV-15 | При відсутніх optional capabilities система може надати діагностику або dry-run, але не підроблює успішний runnable результат. |
| INV-16 | Public docs EN/UK, acceptance evidence, package contents і підтримувані CLI/MCP schemas узгоджені. |

Виняток з інваріанта не оформлюється випадковим `force=true`. Потрібне окреме архітектурне рішення, зміна policy, негативні тести й належний дозвіл власника.

<a id="scope"></a>
## 4. Продуктовий результат і межі MVP

### 4.1. Чотири рівні повторного використання

**Component** — окремий APEX building block. **Pattern** — композиція UI, даних і взаємодій. **Block** — виконуваний функціональний модуль з явними входами, виходами, залежностями, effects і тестами. **Blueprint** — декларативний опис застосунку з екземплярами блоків та зв'язками.

Не пакувати кожен label або button як незалежну залежність. Найменша одиниця пакування має давати зрозумілий сценарій повторного використання. Блок може посилатися на кілька recipes. Бізнес-модуль може бути composite block; окремий п'ятий формат у першій версії не потрібен.

### 4.2. Перший наскрізний сценарій

На дозволеному dev/test fixture або на явно вибраних існуючих об'єктах:

1. Побудувати список клієнтів із пошуком і стабільним ключем.
2. Відкрити модальний редактор одного запису.
3. Зберегти через явно bound PL/SQL API, не через вигаданий автоматичний DML.
4. Коректно обробити валідацію, відсутні права та concurrent update.
5. Закрити діалог лише після успішного завершення операції.
6. Оновити список та підсумки за статусами.
7. Повторно зібрати без diff.
8. Додати другий екземпляр того самого блока без collision.
9. Змінити параметр у blueprint без втрати unmanaged source.
10. Показати provenance, план, результати перевірок і невиконані перевірки.

Початкові block IDs: `block:crud/report-dialog` та `block:analytics/status-summary`. Це **нові** ідентифікатори, не твердження про наявні записи каталогу. Read-only частину CRUD реалізувати першою, щоб перевірити transformation до ввімкнення write behavior.

### 4.3. Межі першої версії

Почати з extension існуючого додатка, одного explicitly tested compatibility profile, trusted bundled/local blocks, однорівневих скалярних полів і одного scalar primary key для runnable CRUD. Формати ключів і contracts одразу проєктувати без втрати інформації про composite keys, але непідтримувані операції з ними явно блокувати.

Новий застосунок створювати лише через наявний initializer/scaffold, не відтворюючи його у Composer. Якщо для scaffold потрібно окремо вибрати authentication, це не робиться «за замовчуванням із прикладу».

У MVP немає marketplace, віддалених виконуваних hooks, довільного SQL-builder, автоматичного проєктування production schema, drag-and-drop canvas або власної LLM-сесії. Ці обмеження зменшують scope, але не прибирають безпечне повторне складання, diagnostics чи integration tests.

<a id="architecture"></a>
## 5. Архітектура та розміщення модулів

### 5.1. Розподіл відповідальності

```text
User requirement
      |
      v
Codex + focused Composer skill
      |  chooses candidates and writes explicit intent
      v
Blueprint + selected block contracts
      |
      v
Shared Composer core
  parse -> validate -> resolve -> bind -> allocate -> wire -> plan
      |
      v
Reviewed composition plan + staged deterministic output
      |
      v
Materializer -> local APEXlang source + ownership state + lockfile
      |
      v
Existing deployment core
  compile -> target/drift/approval/backup -> import -> verification
```

Це текстова схема відповідальності, а не новий runtime service. Немає обов'язкового окремого сервера, БД каталогу чи vector database.

### 5.2. Пропонована структура — адаптувати після CMP-000

```text
packages/core/src/composer/
  index.ts
  schemas/
    block.ts
    blueprint.ts
    contract.ts
    plan.ts
    lockfile.ts
    state.ts
    evidence.ts
  catalog/
    loader.ts
    index.ts
    search.ts
    compatibility.ts
    provenance.ts
  context/
    project.ts
    oracle.ts
    snapshot.ts
  resolver/
    dependencies.ts
    capabilities.ts
    contracts.ts
  binding/
    entity.ts
    command.ts
    authorization.ts
  symbols/
    allocator.ts
    resources.ts
    references.ts
  transform/
    reader-adapter.ts
    edits.ts
    emitter.ts
  planner.ts
  materializer.ts
  recovery.ts
  update.ts
  diagnostics.ts

resources/blocks/
  manifest.json
  contracts/
  packages/crud/report-dialog/0.1.0/
  packages/analytics/status-summary/0.1.0/

resources/blueprints/
  crm-minimal/
  service-desk-minimal/

plugins/apexrest-apex/skills/apexrest-compose/
  SKILL.md
  references/

# Local development skill, only if needed after auditing current .agents:
.agents/skills/apexrest-composer-dev/SKILL.md

docs/composer/
  audit.md / audit.uk.md
  architecture.md / architecture.uk.md
  contracts.md / contracts.uk.md
  task-ledger.json
  implementation-status.md / implementation-status.uk.md
  next-actions.md / next-actions.uk.md
  evidence/
  adr/

tests/
  fixtures/composer/
  unit/<composer tests using the existing runner layout>
  contracts/<composer operation tests>
  packaging/<bundled catalog and skills tests>
```

Не створювати всі ці файли порожніми «на майбутнє». Створювати модулі, коли task приносить реальну функцію та тест. Якщо нинішня архітектура використовує інші шляхи чи naming, зберігати її conventions.

### 5.3. Межі модулів

`planner` — чиста функція над валідованими snapshots і registry; зовнішні reads виконує context adapter. `materializer` не вирішує залежності заново, а застосовує перевірений immutable plan. `resolver` не читає LLM responses. `transform` не знає credentials. CLI/MCP не містять власної версії planner. Каталог не знає target connection; live compatibility validator знає лише дозволений context.

Dependency injection використовується для файлової системи, clock, catalog storage, Oracle context reader, compiler adapter та artifact registry. Mock adapters потрібні для unit tests, але їхні результати позначаються як mock evidence.

<a id="contracts"></a>
## 6. Система форматів і контрактів

### 6.1. Джерело істини для схем

Використовувати чинні strict Zod conventions для публічних input/output моделей. JSON Schema для редакторів і package validation генерувати або механічно перевіряти проти цього джерела. Не підтримувати два вручну розбіжні визначення одного формату.

Кожен persisted документ має `schemaVersion`. Непідтримувана major-версія дає контрольовану помилку. Міграція формату — explicit local plan із backup; читач не повинен непомітно переписувати старий файл.

### 6.2. Основні сутності

| Формат | Для чого потрібен | Власник |
|---|---|---|
| `BlockManifest` | Версія пакета, compatibility, ports, dependencies, resources, effects | Maintainer блока |
| `DataContract` | Поля, nullable, keys, semantics, required capabilities | Maintainer / reviewed project adapter |
| `ApplicationBlueprint` | Бажані блоки, параметри, bindings, connections | Користувач / Codex за його запитом |
| `CompositionLockfile` | Точні artifacts, digests, solver result, toolchain profile | Resolver |
| `CompositionState` | Ownership, symbols, applied generation, base content references | Materializer |
| `CompositionPlan` | Preconditions, resolved graph, staged operations, diagnostics | Planner |
| `VerificationEvidence` | Реально виконана перевірка та її точний scope | Verifier |
| `DeploymentBinding` | Посилання на materialization receipt і semantic digest | Existing deploy integration |

### 6.3. Не плутати три види типізації

**JSON Schema** перевіряє структуру повідомлення. **Oracle binding** перевіряє відповідність columns/arguments. **Business contract** визначає semantics: row access, transaction ownership, optimistic lock, validation errors.

Процедура з потрібними аргументами не обов'язково реалізує потрібні права. View з колонкою `ID` не обов'язково має унікальний ключ. Ці властивості потребують явної declaration та відповідної перевірки; їх не можна «довести» однаковими назвами.

### 6.4. Обмежений dialect contract compatibility

Не намагатися вирішувати довільну логічну еквівалентність JSON Schema. Для MVP підтримати явну таблицю правил: scalars, bounded strings, decimal metadata, nullable, required fields, enum inclusion, array of key parts і versioned event payloads. Невідомі `oneOf`, custom keywords або складні conditional schemas не вгадувати; вимагати reviewed adapter або повертати `CONTRACT_FEATURE_UNSUPPORTED`.

Сумісність напрямлена: producer повинен гарантувати все, що потрібно consumer. Producer, який може повернути `null`, не сумісний із non-null consumer. Додаткові поля дозволяти лише за правилом відповідного контракту. Події й commands перевіряти окремо від datasets.

### 6.5. Безпечний input parsing

Визначити document size, nesting, collection і string limits; відхиляти duplicate keys, custom YAML tags, unsafe object keys, надмірні aliases та ambiguous merges. У MVP можна заборонити YAML aliases/merge keys повністю. JSON-compatible YAML є лише authoring syntax; execution model після parsing — JSON data, не JavaScript objects із поведінкою.

`$ref` дозволяти тільки в межах валідованого package root або pinned reviewed contract registry. Remote reference resolution та довільні absolute paths заборонити. Усі paths нормалізувати й перевіряти на вихід за межі root, symlink і special files.

<a id="block"></a>
## 7. Специфікація пакета Block

### 7.1. Структура одного пакета

```text
report-dialog/0.1.0/
  block.yaml
  contracts/
    parameters.schema.json
    entity-records.schema.json
    save-record.schema.json
    record-saved.schema.json
  source/
    list.apx
    dialog.apx
    shared.apx
  adapters/
    bindings.json
  tests/
    cases.json
  previews/
    manifest.json
  README.md
  README.uk.md
```

`adapters/bindings.json` описує дозволені symbol/field bindings. Це не довільний executable plugin. APEXlang templates є reviewed source; materialization використовує обмежений transformer. Previews необов'язкові до появи справжніх fixture screenshots; не генерувати фальшивий доказ вигляду.

### 7.2. Приклад manifest

**Нижче — узгоджений приклад запропонованого формату, не чинний APEXREST config.** Версія `0.1.0` стосується майбутнього блока. Compatibility profile має бути створений і реально перевірений, а не прийнятий через його назву.

```yaml
schemaVersion: 1
id: block:crud/report-dialog
version: 0.1.0
kind: block
name: Report with modal editor
license: Apache-2.0
compatibility:
  profileRefs:
    - profile:apex261-ut261-mmd3102
parametersSchema: contracts/parameters.schema.json
ports:
  inputs:
    records:
      kind: dataset
      contract: contracts/entity-records.schema.json
    saveRecord:
      kind: command
      contract: contracts/save-record.schema.json
  outputs:
    saved:
      kind: event
      contract: contracts/record-saved.schema.json
exports:
  routes: [list, edit]
  actions: [refresh]
requires:
  capabilities:
    - record-read-authorization
    - record-write-authorization
    - optimistic-lock
  blocks: []
source:
  files:
    - source/list.apx
    - source/dialog.apx
    - source/shared.apx
ownership:
  defaultMode: managed
  extensionPoints: [beforeSaveValidation, afterSaveNotification]
effects:
  local: [write-owned-apexlang, write-composer-state]
  deployment: [application-import]
  applicationRuntime: [read-bound-source, execute-bound-command]
  schemaMigrations: []
  authentication: preserve
```

Важливо розділити **runtime effects додатка** та **effects операції Composer**. `execute-bound-command` описує поведінку встановленої форми; воно не дозволяє planner викликати цю процедуру.

### 7.3. Обов'язкові поля поза прикладом

Manifest validation також має враховувати origin, source recipe references, human-readable limitations, supported parameter combinations, static resources, required auth contracts, permitted extension point types і versioned generator identity. Metadata походження не копіює приватні connection names, raw exports або credentials.

Registry прив'язує manifest до переліку файлів і їхніх hashes. Evidence зберігати **поза незмінним payload пакета**, щоб додавання нового test run не змінювало package digest і не створювало циклічне hash-посилання.

### 7.4. Contract event `record-saved`

Payload має містити `entityRef`, `recordKey` як упорядкований typed object або canonical key structure, `operation`, `originInstance`, `correlationId` та, якщо контракт вимагає, `recordVersion`. Не включати повний рядок із приватними даними без необхідності.

`record-saved` означає успішно завершений write workflow, а не натискання кнопки Save. Два екземпляри одного блока мають різний `originInstance`. Маршрут чи отримувач не повинен реагувати на подію іншого tenant/context через глобальний нечіткий selector.

### 7.5. Публікаційний статус і evidence

Registry status: `draft`, `experimental`, `verified`, `deprecated`, `revoked`. Це стан підтримки, не заміна незалежних evidence fields. Для `verified` задається конкретний maintained compatibility profile і qualification policy. Один успішний offline compile не робить write block `verified` для реального CRUD.

Evidence kinds: `source-review`, `schema`, `unit`, `compiler`, `sql-read`, `sql-write`, `import`, `browser-observation`, `browser-automation`, `authorization`, `upgrade`, `packaging`. Для кожного: status, source digest, fixture digest, configuration digest, tool identities, observed target profile, timestamp, runner kind, artifact refs і reason.

<a id="blueprint"></a>
## 8. Специфікація Application Blueprint

### 8.1. Повний сценарний приклад

Цей YAML демонструє бажану форму API. Назви `CRM_*`, auth schemes та procedure arguments умовні; без явної відповідності реальній схемі він не повинен ставати deployable plan.

```yaml
schemaVersion: 1
application:
  mode: extend
  environment: dev
  compatibilityProfile: profile:apex261-ut261-mmd3102
  preserve:
    authentication: true
    authorization: true
    unmanagedSource: true

entities:
  customers:
    read:
      kind: oracle-view
      object: CRM_CUSTOMERS_V
      key: [CUSTOMER_ID]
      fields:
        id: { column: CUSTOMER_ID, type: integer, nullable: false }
        label: { column: CUSTOMER_NAME, type: string, nullable: false }
        status: { column: STATUS, type: string, nullable: false }
        version: { column: ROW_VERSION, type: integer, nullable: false }
    authorization:
      readContract: project:customer-read-v1
      writeContract: project:customer-write-v1
    capabilities:
      optimisticLock:
        field: version

commands:
  saveCustomer:
    kind: oracle-procedure
    package: CRM_CUSTOMER_API
    procedure: SAVE_CUSTOMER
    signatureRef: project:save-customer-v1
    transaction: caller-owned
    inputs:
      P_CUSTOMER_ID: { from: record.id, mode: in-out }
      P_CUSTOMER_NAME: { from: record.label, mode: in }
      P_STATUS: { from: record.status, mode: in }
      P_EXPECTED_VERSION: { from: record.version, mode: in }
    outputs:
      recordKey: { from: P_CUSTOMER_ID }
      recordVersion: { from: P_NEW_VERSION }
    errorContract: project:customer-save-errors-v1
    authorizationContract: project:customer-write-v1

blocks:
  customerWorkspace:
    use: block:crud/report-dialog@0.1.0
    parameters:
      title: Customers
      editableFields: [label, status]
      createEnabled: true
      editEnabled: true
      deleteEnabled: false
    bindings:
      records: entity:customers
      saveRecord: command:saveCustomer

  customerSummary:
    use: block:analytics/status-summary@0.1.0
    parameters:
      title: Customers by status
      groupField: status
    bindings:
      records: entity:customers

connections:
  - from: customerWorkspace.events.saved
    to: customerSummary.actions.refresh
    behavior:
      coalesce: true
```

`outputs` не замінюють metadata перевірку режиму OUT/IN OUT відповідного argument. `signatureRef` посилається на reviewed contract, а не на текстову обіцянку. APEX environment визначає exact target через чинну конфігурацію; blueprint не містить credentials, connection string або права самостійно змінити application ID.

### 8.2. Семантичні правила

- Усі `use` у materializable plan мають exact versions із lockfile. Floating selectors дозволені тільки в explicit resolve/update, якщо такий режим доданий після MVP.
- `preserve` задає захист. Вимкнення захисту — новий sensitive effect, а не звичайний cosmetic parameter.
- `bindings` використовують імена портів manifest; невідомий порт — error, а не проігнорована властивість.
- Кожен connection пов'язує існуючий output із сумісною action/input. Немає implicit string matching за label.
- Entity key повинен бути обґрунтований constraints або explicit reviewed key contract для view. Декларація key у YAML сама по собі не є доказом унікальності.
- Read-only сценарій без write port допустимий тільки як явно підтримуваний режим блока. Не створювати активну кнопку Save без handler.
- Залежності та shared resources не можна додавати без відображення у плані.

### 8.3. Preview і diagnostics

Plan summary показує сторінки, регіони, shared components, прив'язки, routes, events, generation ownership, database effects і нерозв'язані вимоги. Користувач повинен бачити, що саме буде **створено**, **оновлено**, **збережено без змін**, **заблоковано** або **від'єднано**.

Не трактувати HTML preview панелі як доказ Oracle runtime. Не візуалізувати приватні target rows у каталозі; використовувати синтетичні fixtures.

<a id="state"></a>
## 9. Lockfile, ownership, identity та стан

### 9.1. Чотири класи даних

| Клас | Приклад | Зберігання |
|---|---|---|
| Бажаний стан | `app.blueprint.yaml` | Git, reviewable, без secrets |
| Відтворюваний стан складання | `apexrest.blocks.lock.json`, symbol/ownership map, generation bases | Git або інше явне versioned project storage, без машинних absolute paths |
| Операційний стан | locks, journals, job IDs, heartbeat, private target snapshots, staging | Чинний private runtime home/state store; не публікувати |
| Докази перевірок | sanitized evidence summaries та локальні raw artifacts | Public summaries — лише після redaction; raw data — private artifacts |

Шлях для tracked composition state спочатку погодити з фактичним `.gitignore` і правилами application project. Пропонований tracked namespace — `.apexrest-composer/`, **але його треба перевірити під час CMP-006**. Не розміщувати tracked ownership у вже ігнорованому каталозі випадково. Не змінювати значення Oracle `.apex`.

### 9.2. Lockfile

Містить `schemaVersion`, `blueprintSemanticDigest`, `generatorVersion`, `resolverPolicyVersion`, compatibility profile, catalog revision, exact block IDs/versions, package content digests, transitive dependencies, contract digests, static resource identities та resolution decisions.

Lockfile не містить credentials, grants, timestamps, machine-specific absolute paths чи live session IDs. Network fetch під час відтворення за lockfile не відбувається неявно. Відсутній artifact дає `PACKAGE_NOT_AVAILABLE_OFFLINE`; отримання пакета — окрема explicit operation.

Не включати digest lockfile в нього самого. Hash обчислювати над визначеним payload без self-reference. Те саме правило діє для package manifest, plan і evidence.

### 9.3. Ownership на рівні декларацій

Один файл може містити кілька managed та unmanaged declarations. Модель ownership повинна бути достатньо дрібною, щоб не оголошувати весь файл власністю Composer тільки через один новий регіон.

Для кожного owned artifact зберігати:

- `instanceId`, `blockId`, exact version, logical declaration key;
- фактичний source path і stable structural anchor;
- режим `managed`, `extended` або `detached`;
- current symbol allocation та dependencies;
- digest попереднього generated base і посилання на його доступний content;
- digest матеріалізованої локальної версії;
- provenance: recipe, transformer version, input contract digest.

Hash без доступного попереднього base недостатній для three-way merge. Base має бути або збережений, або відтворюваний з exact package + generator + bindings; просте сподівання, що старий generator завжди доступний, не підходить.

### 9.4. Ідентичність

Розділити `logical block instance`, `source declaration identity`, `human-readable static ID` та `Oracle internal identity`. Перший стабільний між recompilation. Останній визначається наявними Oracle mechanisms та `.apex` metadata, а не самостійно вигаданим числовим counter.

Allocator спочатку читає існуючі сторінки, application/page items, aliases, region static IDs, dynamic actions, shared components і reserved namespaces. Він зберігає попередні mappings; нові значення призначає стабільно у визначеному порядку. Перестановка YAML keys не повинна перенумеровувати компоненти.

Колізія після truncation або case folding теж є колізією. Враховувати byte-length rules відповідного target, не лише кількість Unicode characters. Непідтримувані quoted identifiers блокувати явно.

### 9.5. Стан після materialize і після deploy

Успішний `materialize` означає тільки готовий локальний source. Зберігати окремо `lastMaterializedCompositionDigest` та receipt успішного deployment. Невдалий deploy не повертає непомітно source назад і не робить state «deployed».

Після crash filesystem journal може залишити mixed local state. Його reconciliation не має змінювати target DB. Стан Oracle deployment після невизначеного outcome обробляється existing deploy recovery, а не Composer journal.

<a id="lifecycle"></a>
## 10. Планування, матеріалізація і deployment

### 10.1. Composition pipeline

1. **Load:** strict parse blueprint; перевірити schemaVersion, paths, sizes і trust.
2. **Snapshot:** read local project, current state, catalog revision, toolchain profile; за explicit mode — дозволений Oracle metadata snapshot.
3. **Resolve:** exact versions, dependency DAG, capability providers, compatibility constraints.
4. **Bind:** datasets, commands, auth contracts, key mappings і typed parameters.
5. **Allocate:** page/item/region/resource symbols зі збереженням існуючих identities.
6. **Wire:** routes, dialog lifecycle, actions, submitted items, event payload mappings.
7. **Generate:** сформувати обмежені structural edits та staged source без запису у working tree.
8. **Validate:** schema/structural checks; реальний compiler, коли capability доступна й входить у scope.
9. **Plan:** freeze payload, operations, preconditions і artifact hashes; повернути summary + diagnostics.
10. **Materialize:** revalidate inputs, take local ownership, apply journaled local writes, verify output, emit receipt.
11. **Deploy:** existing deploy plan/apply із binding на materialization receipt.
12. **Verify:** scoped Oracle та browser checks; evidence окремо від generation success.

### 10.2. Вхід і вихід planner

Концептуальна TypeScript boundary:

```typescript
interface ComposeInput {
  blueprint: ValidatedBlueprint;
  catalog: ImmutableCatalogSnapshot;
  project: ProjectSnapshot;
  previousState: CompositionState | null;
  policy: CompositionPolicy;
  targetContext: VerifiedTargetSnapshot | OfflineTargetAssumptions;
}

interface ComposeResult {
  status: 'materializable' | 'blocked';
  semanticPlan: CompositionPlan;
  diagnostics: readonly CompositionDiagnostic[];
}
```

Це контури контракту, не готовий production code. Реальний implementation повинен мати точні immutable types і використовувати існуючий result/error envelope репозиторію.

Не приховувати частково розв'язаний план. `blocked` може містити пояснення і proposed alternatives, але materializer відхиляє його. Offline assumption та live verification завжди розрізняються.

### 10.3. Preconditions immutable plan

Plan фіксує exact blueprint/lock/state digests, generator і transform identities, catalog artifact hashes, scope relevant source tree, expected existing/absent paths, compatibility profile, target-context provenance, operation policy та staged output digest.

Особливо важливо: перевіряти **відсутність нових unmanaged collisions**, а не тільки hash раніше прочитаних файлів. Інший процес може створити сторінку після plan. Перед materialize повторно сканувати identity scope та inventory, потрібні для allocation.

Commit SHA сам по собі недостатній: working tree може бути dirty. Hash тільки `.apx` також недостатній: binding contracts, blueprint, resources або ownership state можуть змінити результат.

### 10.4. Semantic digest і volatile envelope

Canonical serialization повинна сортувати object keys, але не змінювати семантичний порядок arrays. Unicode normalization і line ending policy мають бути явно визначені. Для unmanaged source зберігати original bytes. Generated source використовує фіксовані UTF-8 та LF.

`planDigest` обчислюється над immutable semantic payload. `createdAt`, artifact delivery IDs, локальні runtime paths і job heartbeat — поза цим payload. Expiry/authorization envelope при цьому захищений окремим existing policy mechanism; його не можна змінювати без перевірки лише тому, що він не входить у reproducibility hash.

### 10.5. Crash-safe materializer

Немає універсальної atomic transaction на багато файлів working tree. Не називати набір `rename` гарантовано атомарною збіркою. Реалізувати journaled protocol:

1. Отримати exclusive ownership для project composition scope.
2. Revalidate plan, paths, source hashes, target-independent preconditions та absence constraints.
3. Підготувати всі нові bytes і локальні backups у contained staging на відповідному filesystem.
4. Записати durable journal із фазою `prepared` і per-file preimage/postimage hashes.
5. Перед кожною заміною перевірити preimage; записувати прогрес після завершення заміни.
6. Після source writes перевірити всі postimages; тільки тоді записати lock/state і completion receipt.
7. Зняти ownership після фінального durable стану.
8. При interruption записати `recovery-required`; повторний run спочатку виконує reconciliation, а не нову матеріалізацію.

Recovery порівнює files із відомими preimage/postimage. Невідомі зовнішні зміни не перезаписуються; вони створюють conflict. Не видаляти backups до підтвердженого завершення або explicit retention policy.

### 10.6. Deployment binding

Composer receipt додається до чинного deployment plan як typed extension або через existing source-manifest mechanism. Потрібно bind: blueprint digest, lock digest, state generation digest, generated source digest, static resources, local adapter code, generator identity і composition plan digest.

Після зміни blueprint старий deploy plan має відхилятися, навіть якщо `.apx` ще не перематеріалізований. Legacy projects без Composer продовжують працювати без нових обов'язкових файлів. Для Composer-managed generation існуючі tests/policy залишаються чинними.

Чинний pipeline імпортує повний application, навіть коли змінено одну сторінку. Composer не може вважати таку зміну ізольованою від решти source. [R10]

### 10.7. Offline drafts і перевірена generation

Offline mode означає відсутність target reads, а не обов'язково відсутність локального Oracle compiler. Коли compiler доступний і profile вимагає compile gate, виконувати його у staging без connection. Compiler failure блокує відповідний materializable plan.

Для authoring без compiler можна підтримати explicit project policy `source-only draft`: structural checks обов'язкові, output позначений unverified, runtime-ready/deployment-ready claims заборонені. Це не `force` для обходу failed compiler — відомий failure не можна перетворити на missing capability. Такий режим має бути відображений у plan, receipt та UI й не скасовує обов'язкову реальну компіляцію в existing deploy pipeline.

No-op materialization не переписує tracked state заради нового timestamp або plan ID. Вона повертає наявну generation identity із новим, за потреби, приватним operation record. Так зберігається нульовий Git diff, а історія запусків не губиться.

<a id="catalog"></a>
## 11. Ефективний каталог та пошук

### 11.1. Два різні запити

**Discovery** відповідає «що є схоже на задачу?». **Resolution** відповідає «яка точна композиція сумісна з контрактами й policy?». Вони не повинні бути одним нечітким semantic search.

Результат discovery містить candidate IDs, коротке призначення, required inputs, profile compatibility, independent evidence summary, effects і причини відповідності. Resolver читає повні машинні manifests сам, а не через обмежений текстовий snippet, переданий LLM.

### 11.2. Алгоритм відбору

1. Нормалізувати query, мову та explicit filters.
2. Відібрати дозволені packages за trust/revocation policy.
3. Відкинути несумісні target/profile/host/contract/capability candidates.
4. Ранжувати решту за exact ID match, business aliases, lexical relevance, ступенем покриття contract, evidence і adaptation cost.
5. Стабільно розв'язати однакові scores за deterministic ID ordering.
6. Повернути короткий shortlist, reason codes і continuation cursor, bound до index digest.

У безконтекстному пошуку compatibility показується як `unknown`, а не «підходить». Відсічені кандидати можуть бути доступні у режимі `explain`, щоб користувач розумів причину відмови.

### 11.3. Progressive disclosure

Рівень 1 — компактні картки кількох кандидатів. Рівень 2 — contracts і dependencies обраного блока. Рівень 3 — конкретний source file або bounded recipe fragment. Повний artifact читає core; LLM отримує його лише для review або modification, коли це потрібно.

Розмір відповіді, кількість кандидатів і pagination не повинні залежати від випадково дуже великого README. Не розрізати JSON contract довільним string truncation. Для великих документів повертати registered artifact ref і explicit continuation.

### 11.4. Перший пошуковий engine

Локальний deterministic JSON index, словник англійських/українських aliases і структуровані filters. Не вводити vector infrastructure до baseline вимірювань. Embeddings у майбутньому можуть покращити discovery, але не можуть обходити compatibility filter або lockfile.

Index build — maintainer operation. Runtime search не виконує source capture і не читає reference Oracle application. Поточні `apexlang`, `components` і `patterns` corpora зберігають defaults та semantics. [R6] [R7]

### 11.5. Cache та invalidation

Ключ кешу включає catalog payload digest, index schema, locale normalization і search policy version. Package source cache — content-addressed. Evidence cache окремий від source payload. Ніколи не кешувати authorization grants або живий target state як незмінний доказ придатності до apply.

Зміна package bytes без зміни digest — corruption. Зміна bytes за тим самим ID/version — mutable-version conflict. Runtime не повинен «виправляти» це автоматичним оновленням lockfile.

<a id="binding"></a>
## 12. Прив'язка Oracle-даних і серверна безпека

### 12.1. Metadata розширення

До existing bounded metadata reader додати потрібні facts: column length, precision, scale, character semantics, nullable, column order, identity/generated details за підтримкою target; constraint columns і їх position; FK referenced owner/table/columns; enabled/validated state; package overload/argument identity та defaults.

`ALL_CONS_COLUMNS` описує колонки constraints та порядок через `POSITION`; саме порядок потрібен для коректного mapping складених ключів. [R11] Реальний query повинен враховувати `OWNER` і constraint name з обох боків FK, а не join лише за назвою.

Не переходити на `DBA_*` views і не просити broad grants для зручності. Cross-schema FK можна показати як restricted reference без автоматичного розширення allowed schema. Не завантажувати business rows для «пошуку прикладу».

### 12.2. View keys

View може не мати usable declared constraint. У такому випадку потрібен explicit key contract із provenance. Read-only uniqueness check можна виконати лише в узгодженому scope, з limits і розумінням вартості; він доводить стан перевірених даних у момент перевірки, не вічну гарантію.

Без надійного key contract дозволити лише справді read-only представлення без row-targeted actions або заблокувати write block. Не вважати `ROWNUM`, label, позицію рядка чи `ROWID` універсальним бізнес-ключем.

### 12.3. Типи

Oracle NUMBER не завжди безпечно перетворюється на JavaScript number. Для великих integer keys і exact decimals визначити canonical string representation та явні adapters. Окремо описати DATE, TIMESTAMP і TIMESTAMP WITH TIME ZONE; не переносити дати через locale-dependent format без контракту.

Для strings врахувати byte/character length, nullable і case-sensitive values. Oracle empty-string semantics перевірити у fixture, а не переносити бездумно JSON validation. BLOB/CLOB, collection arguments, records і polymorphic overloads позначити unsupported до спеціальних adapters.

### 12.4. SQL generation

У MVP генерувати лише reviewed select projections, predicates і aggregation templates. Object identifiers — тільки з verified allowlist. Values — bind variables. Sort field/direction — explicit whitelist, не вставлений користувацький текст.

Не називати довільний `SELECT` безпечним лише за першим словом: він може викликати functions із побічними ефектами. Planner metadata використовує наперед визначені queries. Перевірку custom source SQL трактувати як execution reviewed project input у дозволеному environment, не як повністю нешкідливий parse.

Заборонити приховані DML, SQLcl substitution/invocation tricks, shell execution та unknown statements у inputs, які визначені як metadata-only.

### 12.5. Write command contract

Потрібні exact package/procedure/overload, direction і datatype arguments, mapped form inputs, new key output, optimistic-lock behavior, error categories, transaction owner і authorization boundary.

Не визначати semantics процедури за назвою `SAVE_*`. Adapter contract reviewed людиною або підтриманий tests повинен гарантувати, що procedure не commits неочікувано, перевіряє права і повертає необхідні outputs.

Для demo `caller-owned` API не робить internal COMMIT. Спосіб завершення request transaction визначається перевіреним APEX process lifecycle; success event має походити тільки від підтвердженого server success. Перевірити, що subsequent refresh бачить запис, а помилка validation не залишає часткового update.

### 12.6. Authorization і optimistic locking

Відокремити authentication identity, application authorization scheme, record-level authorization та runtime tenant scope. Scope, який впливає на доступ, отримувати з довіреного server context; hidden page item не є довіреним tenant selector.

Для update використовувати expected row version або інший reviewed concurrency token. Zero rows updated через version mismatch — conflict, не success. Перевірити, що користувач не може змінити key і редагувати чужий запис через direct request. Підсумки й count queries повинні мати ті самі row filters, що й список.

### 12.7. Read record, create draft і edit draft — різні контракти

У read dataset `id` та `version` можуть бути non-null для кожного збереженого запису. Це не означає, що форма створення повинна мати вже існуючий key. Ввести окремі operation-aware draft contracts: create дозволяє відсутній/null key та expected version до save; edit вимагає valid existing key і concurrency token.

Не послаблювати read contract, щоб пропустити create form. Generator має явно переходити від draft до persisted record після отримання key/version outputs. Відсутній generated key після нібито успішного create є contract violation, а не записом із випадковим client-side ID.

Read-only fields, server-managed version, audit timestamps і tenant identity не можна mass-assign із browser payload. Editable field allowlist застосовується і в form rendering, і на server API boundary. Перевірити, що undeclared input field, підмінений version або переданий на create чужий key не обходять operation rules.

<a id="assembly"></a>
## 13. Структуроване складання APEXlang

### 13.1. Обмежений parser/transformer

Спочатку інвентаризувати існуючий reader і реальні fixture constructs. Відсутність compiler error після читання не доводить lossless edit support. Ввести supported structural subset і coverage fixtures.

Мінімальні operations: insert declaration, set typed property, bind field reference, rename owned symbol із reference map, add reviewed shared resource, add route/action wiring. Глобальні regex replacements за page number, `P42_` або label заборонені.

### 13.2. Збереження unmanaged text

Для untouched spans вимагати byte-for-byte preservation, зокрема comments, ordering, quoted keys, repeated keys у різних scopes та anonymous declarations. Для managed spans — canonical emitter. Якщо parser не може безпечно знайти boundary, повертати unsupported edit, а не переписувати весь файл formatter-ом.

Кожен edit має precondition на початковий node/span digest, reason, owner instance і reference updates. Overlapping edits — conflict. Staging compile виконується над повним додатком зі збереженою Oracle metadata.

### 13.3. Shared resources

Deduplication key включає resource type, semantic contract, version, configuration digest та compatibility host. Не зливати дві LOV з однаковою назвою, але різним SQL чи access scope.

Вести explicit consumers graph. Existing unmanaged resource можна bind як external reference, але не переймати ownership автоматично. При видаленні останнього managed consumer ресурс не видаляється, якщо є unmanaged/unknown consumers.

### 13.4. Події і маршрути

Compile-time dependency DAG не тотожний runtime interaction graph. DAG cycles блокуються resolver. Runtime cycles вимагають явної поведінки; для MVP заборонити несанкціоновані cycles і підтримати тільки bounded reviewed event patterns.

Handlers namespaced by logical instance. Re-render не реєструє дублікати. Після save список може оновлюватися внутрішньою логікою блока, а summary — зовнішнім connection; не генерувати два refresh на той самий target без потреби. Coalescing не має втрачати останній стан.

Для modal flow перевірити створення та редагування окремо, cancel без DML, validation без close, close із поверненим key, focus return, server error та повторне відкриття. URLs/checksums/session state формувати через підтримувані APEX mechanisms, не конкатенацією unchecked strings.

<a id="updates"></a>
## 14. Оновлення, розширення, detach і видалення

### 14.1. Managed / extended / detached

`managed`: engine може оновлювати declaration, але manual drift спочатку виявляється. `extended`: змінюються лише базові managed частини; typed extension points збережені. `detached`: Composer більше не змінює source, але зберігає мінімальний provenance й dependency relationship для коректної діагностики.

Detach не означає, що спільна LOV або API більше нікому не потрібні. Після detach explicit external dependency може залишатися. Reattach — окремий adoption/migration plan із review, не implicit match за names.

### 14.2. Three-way update

Позначення: `B` — попередній generated base, `L` — local actual source, `N` — newly generated source.

| Умова | Дія |
|---|---|
| `L = B`, `N ≠ B` | Застосувати нову generated версію за plan |
| `N = B`, `L ≠ B` | Зберегти local change; зафіксувати drift/extension classification |
| Зміни `L` і `N` стосуються різних supported fields | Зробити structural merge і показати обидва набори змін |
| Обидві сторони змінюють один semantic field | Повернути conflict із B/L/N, не писати source |
| Base відсутній або parser unsupported | Заблокувати автоматичний update; запропонувати explicit recovery/adoption |

Conflict markers не записуються у deployable `.apx`. Conflict report живе в private artifacts або reviewable plan. Рішення конфлікту породжує новий plan із новими hashes.

### 14.3. Version upgrade

Upgrade спочатку оновлює explicit desired version/lock candidate, виконує dependency impact analysis, binding compatibility та generation у staging. Patch/minor semver сам по собі не дозволяє destructive effect. Changes in auth/row scope/transaction/resource ownership завжди видимі.

Зміна parameter defaults також змінює semantics. Якщо blueprint не задавав значення, upgrade report повинен показати old effective default та new effective default. Непомітно змінювати behavior через новий default не можна.

### 14.4. Removal і database migrations

При видаленні instance сформувати consumers analysis, перелік owned declarations і orphan candidates. Зберегти unmanaged source та references невідомого походження. Таблиці, дані, packages або privileges ніколи не видаляються лише через зникнення блока з blueprint.

Schema migrations, коли їх додано після MVP, проходять чинний immutable migration pipeline. Не створювати власний Composer migration executor. Oracle DDL має implicit commit semantics, тому звичайний ROLLBACK не є універсальним способом відновлення schema changes. [R12]

Expand/contract migrations, data backfill, irreversible operations і business-data recovery мають окремий plan та authorization. APEX metadata backup не називається backup бізнес-даних.

<a id="interfaces"></a>
## 15. CLI, MCP, skills та панель Catalog

### 15.1. Новий CLI — цільовий контракт

Наведені команди потрібно **реалізувати**; не запускати їх як наявні до завершення CMP-028.

```bash
apexrest compose plan --blueprint app.blueprint.yaml --out plans/compose.json --json
apexrest compose materialize --plan plans/compose.json --json
```

Existing reference search/read розширюються `blocks` і `blueprints` corpus. Точний shape нових filters узгодити зі strict operation schemas, не додавати довільний `options` bag.

`compose plan` default — local/offline. Explicit connected mode додається з однозначною назвою і environment, але не активується випадково через наявність saved credentials. CLI повертає зрозумілі exit codes через існуючу Fault/result систему; stderr logs не псують stdout JSON.

Recovery і update можуть спочатку бути внутрішніми reviewed workflows, викликаними через plan. Окремі публічні команди додавати тільки за доведеної потреби, із власними schemas і tests.

### 15.2. Дві нові MCP operations

| Tool | Input | Output | Effects |
|---|---|---|---|
| `apexrest_compose_plan` | project/env reference за conventions, blueprint path, explicit mode | bounded summary, immutable plan artifact ref, diagnostics або existing job handle | local artifacts; optional explicitly scoped reads |
| `apexrest_compose_materialize` | registered plan ref або contained plan path, expected digest | generation receipt, changed files summary, state digest | local writes лише в проєкті |

`materialize` не позначати read-only. `plan` не називати side-effect-free, якщо він пише локальні artifacts; tool description має точно описувати межу «без змін application source та БД».

Використовувати existing jobs, status, cancel і artifact read. Не додавати власний detached worker framework. Existing job handle не є підставою повторно запускати те саме завдання. Якщо core operation довга, transport працює через чинний job lifecycle. [R4]

### 15.3. Production skill і development skill

**`apexrest-compose`** допомагає користувачу зібрати application із готових блоків. **`apexrest-composer-dev`** допомагає реалізувати сам Composer у цьому repository. Це різні tasks; skill для розвитку плагіна не повинен активуватися при звичайному CRUD request.

Production skill використовує available reference tools, project inspection, blueprint, plan, materialize та existing deploy/test skills. Він не надає сам собі permissions і не потребує прямого виклику OpenAI API. Розділення опису та подробиць skill відповідає progressive disclosure, описаному в офіційній документації. [R13]

### 15.4. Catalog panel

Екран містить search, compatibility/evidence filters, list/detail, parameters, ports, dependencies/effects, source provenance, verified fixture preview та Add to blueprint. Після Add показувати diff blueprint, а не починати deployment.

Обов'язкові стани: empty, loading, no match, incompatible, unsupported, stale evidence, missing bindings, conflict, ready to plan. Кнопка Materialize активна тільки для незастарілого materializable plan. Deployment UI залишається existing surface зі своїми gates.

Panel є клієнтом core, а не іншим planner. Preview із packages трактувати як untrusted content; віддавати reviewed inert assets і не виконувати довільний HTML/JS manifest. Зберегти existing loopback access controls, origin/CSRF policy і redaction.

<a id="security"></a>
## 16. Модель загроз і захист

| Вектор | Обов'язковий захист | Негативний тест |
|---|---|---|
| Path traversal / symlink | Containment, normalization, no-follow policy, повторна перевірка перед write | `../`, absolute path, symlink swap |
| YAML/JSON abuse | Limits, strict keys, duplicate rejection, bounded references | Alias bomb, deep tree, unknown tags |
| SQL injection | Verified identifiers, values as binds, allowlisted operations | Malicious column name, sort expression, SQLcl substitution |
| Package tampering | Immutable content digests, provenance, explicit trust source | Same version with different bytes |
| Fake evidence | Evidence bound to inputs/toolchain/fixture; runner kind | Evidence copied from another digest |
| Prompt injection | Documentation/database text never becomes authority | README asking to bypass permissions |
| Authorization bypass | Server-side read/write/row checks | Hidden key changed, direct endpoint invocation |
| Concurrent local writes | Project ownership, preconditions, durable journal | Two materializers, process kill mid-write |
| Stale deployment | Bind all Composer inputs, fresh target checks | Modify blueprint after deploy plan |
| Overbroad deletion | Ownership + consumer analysis; no implicit DDL | Remove block with shared/unmanaged consumer |
| Secrets leakage | Existing stores, bounded redacted artifacts | Credential in error, private target in package |
| Unsafe preview | Inert/sanitized resources, existing panel protection | Scripted HTML, cross-origin requests |

Hash забезпечує integrity відносно відомого expected hash, але не доводить довіру до автора. Для bundled catalog trust походить із reviewed release. Для external sources у майбутньому потрібні origin policy, publisher identity та revocation, а не тільки SHA-256.

Жодна галочка `trusted` усередині downloaded manifest не може сама надати довіру. Local authoring catalog явно позначений як local reviewed input, а не public certified block.

<a id="tests"></a>
## 17. Тестова стратегія та докази

### 17.1. Піраміда перевірок

| Рівень | Що доводить | Чого не доводить |
|---|---|---|
| Schema/unit | Формати, алгоритми, edge cases, pure functions | Реальний SQLcl або Oracle |
| Golden/structural | Точні generated bytes, preservation, stable references | Runtime behavior |
| Contract CLI/MCP | Shared schemas, response shape, errors, jobs | Host rendering або DB correctness |
| Реальний offline compiler | Прийнятність source для exact compiler/MMD | SQL execution, import, server authorization |
| Oracle read checks | Прив'язки та queries на конкретному target | Повний write workflow |
| Authorized Oracle write tests | API semantics на isolated fixtures | Усі user journeys |
| Import + read-back | Застосований application і його metadata | Візуальний та interaction результат |
| Browser observation/automation | Конкретно перевірені flows | Неперевірені roles, targets або versions |
| Packaging/clean install | Артефакт містить runtime/resources/skills | Реальний Codex host rendering |

### 17.2. Мінімальний test corpus

Позитивні fixtures: empty managed section; existing unmanaged page; report-dialog + summary; два instances; shared LOV reused; Unicode labels; exact decimal field; manual extension; update із non-conflicting customization; missing optional preview.

Негативні fixtures: dependency cycle; unsatisfied version; unsupported MMD; missing PK; composite key unsupported by MVP write adapter; ambiguous procedure overload; nullable mismatch; absent auth contract; SQL identifier injection; corrupted artifact; stale base; ownership collision; interrupted local write; unknown DB outcome; revoked dependency; preview script; missing required verification.

### 17.3. Властивості, які перевіряються автоматично

- Permuting unordered YAML mappings не змінює semantic plan.
- Два runs з однаковим input snapshot дають однаковий output digest.
- Materialize + replan дає no-op.
- Generated symbols не перетинаються з current inventory і один з одним.
- Усі generated references мають resolved target.
- Unmanaged bytes не змінюються.
- Plan зі зміненим input не застосовується.
- Dependency failure не залишає частково оновлений lockfile.
- Interrupted materialization ніколи не записує success receipt завчасно.
- Жодна compose operation не викликає Oracle import або schema write adapter.

### 17.4. Приклад evidence envelope

```json
{
  "schemaVersion": 1,
  "kind": "browser-automation",
  "status": "not-run",
  "subject": "block:crud/report-dialog@0.1.0",
  "sourceDigest": null,
  "fixtureDigest": null,
  "toolchainProfile": null,
  "runnerKind": "none",
  "artifacts": [],
  "reason": "No authorized target and browser run were provided."
}
```

Для `passed` відповідні digests, runner identity, actual command/case IDs, timestamp і evidence artifact обов'язкові. `null` тут допустимі тільки тому, що приклад чесно показує `not-run`. Не створювати фіктивні hashes для красивого звіту.

### 17.5. Відсутнє середовище

Якщо SQLcl, Oracle target чи browser controls недоступні, завершити доступний implementation і локальні tests; поставити `blocked`/`not-run` для конкретної перевірки з причиною. Можна продовжувати незалежні offline tasks. Не обходити required release gate і не заявляти runtime-ready.

Не встановлювати utPLSQL лише заради порожнього suite чи application-only імпорту. Якщо SQL suite справді required проєктом, не прибирати його для зеленого status. Це вже визначено чинними правилами репозиторію. [R3] [R10]

<a id="backlog"></a>
## 18. 42 покрокові завдання для Codex
### 18.1. Правила виконання карток

Кожна картка — окремий reviewable delivery unit. Шляхи нижче є очікуваними точками роботи; використовувати перевірені аналоги із CMP-000, не створювати дублікати. `LOCAL` означає реалізацію і безпечні локальні перевірки в репозиторії, а не дозвіл на довільні скрипти з мережі.

До завершення картки належать реалізація, релевантні tests, docs та evidence/ledger update. Написані case definitions не є виконаними tests. Для connected задач дозволено завершити локальну частину та зафіксувати окремий verification blocker.

Dependencies — порядок реалізації. Якщо predecessor implemented, але має лише external verification blocker, незалежний offline successor можна виконати з явним записом цієї обставини. Це не закриває відповідний release gate. Не робити всю розробку залежною від доступності production чи browser.

### 18.2. Фази

| Фаза | Задачі | Вихід |
|---|---|---|
| P00 — Foundation audit | CMP-000–CMP-002 | G0: фактологічна основа, baseline, ADR і ledger |
| P01 — Formats and durable state | CMP-003–CMP-006 | Schemas, safe parsing, hashes і ownership model |
| P02 — Executable catalog | CMP-007–CMP-010 | G1: offline catalog та qualification model |
| P03 — Context and Oracle binding | CMP-011–CMP-014 | Verified inventory і typed entity/API bindings |
| P04 — Deterministic planning | CMP-015–CMP-018 | G2: resolved, reviewable immutable plan |
| P05 — Safe materialization | CMP-019–CMP-022 | G3: source generation, no-op, recovery і deploy binding |
| P06 — Runtime vertical slice | CMP-023–CMP-027 | G4: реальна кваліфікація list/dialog/summary |
| P07 — Product interfaces | CMP-028–CMP-031 | G5: CLI/MCP/skills/panel parity |
| P08 — Maintenance and reuse | CMP-032–CMP-035 | G6: upgrade/remove, додаткові blocks і authoring |
| P09 — Hardening and measurement | CMP-036–CMP-038 | G7: security suite і benchmarks |
| P10 — Distribution and acceptance | CMP-039–CMP-041 | G8: packaged, documented, qualified release candidate |

### 18.3. Зведений backlog

| Task | Назва | Залежності | Початковий стан |
|---|---|---|---|
| [CMP-000](#cmp-000) | Аудит checkout і карта інтеграції | — | pending |
| [CMP-001](#cmp-001) | Baseline перевірок і журнал виконання | CMP-000 | pending |
| [CMP-002](#cmp-002) | ADR, threat model і acceptance IDs | CMP-000, CMP-001 | pending |
| [CMP-003](#cmp-003) | Strict schemas та contract dialect | CMP-002 | pending |
| [CMP-004](#cmp-004) | Безпечне читання YAML/JSON і package paths | CMP-003 | pending |
| [CMP-005](#cmp-005) | Canonical snapshots і content digests | CMP-003, CMP-004 | pending |
| [CMP-006](#cmp-006) | Tracked state, base store і runtime journal model | CMP-003, CMP-005 | pending |
| [CMP-007](#cmp-007) | Executable block registry поверх існуючих каталогів | CMP-003, CMP-004, CMP-005 | pending |
| [CMP-008](#cmp-008) | Пошук, filters і explainable shortlist | CMP-007 | pending |
| [CMP-009](#cmp-009) | Compatibility profiles та evidence policy | CMP-007 | pending |
| [CMP-010](#cmp-010) | Immutable local cache і index lifecycle | CMP-007, CMP-008, CMP-009 | pending |
| [CMP-011](#cmp-011) | Project inventory і reader adapter | CMP-000, CMP-005, CMP-006 | pending |
| [CMP-012](#cmp-012) | Oracle metadata для keys, types і signatures | CMP-003, CMP-005 | pending |
| [CMP-013](#cmp-013) | Dataset contracts і entity binding | CMP-003, CMP-009, CMP-011, CMP-012 | pending |
| [CMP-014](#cmp-014) | Commands, auth contracts і transaction semantics | CMP-003, CMP-012, CMP-013 | pending |
| [CMP-015](#cmp-015) | Deterministic dependency і capability resolver | CMP-007, CMP-009, CMP-013, CMP-014 | pending |
| [CMP-016](#cmp-016) | Stable allocator і shared resource ownership | CMP-006, CMP-011, CMP-015 | pending |
| [CMP-017](#cmp-017) | Typed event, action і route wiring | CMP-013, CMP-014, CMP-016 | pending |
| [CMP-018](#cmp-018) | Composition plan і diagnostics | CMP-005, CMP-006, CMP-015, CMP-016, CMP-017 | pending |
| [CMP-019](#cmp-019) | Bounded APEXlang structural transformer | CMP-011, CMP-016, CMP-017, CMP-018 | pending |
| [CMP-020](#cmp-020) | Journaled local materialization і recovery | CMP-006, CMP-018, CMP-019 | pending |
| [CMP-021](#cmp-021) | Idempotence та базові ownership modes | CMP-020 | pending |
| [CMP-022](#cmp-022) | Binding із чинним deployment pipeline | CMP-020, CMP-021 | pending |
| [CMP-023](#cmp-023) | Ізольований CRM fixture і API contract | CMP-013, CMP-014, CMP-022 | pending |
| [CMP-024](#cmp-024) | Перший runnable read-only список | CMP-019, CMP-020, CMP-023 | pending |
| [CMP-025](#cmp-025) | Модальна форма зі збереженням через API | CMP-014, CMP-017, CMP-023, CMP-024 | pending |
| [CMP-026](#cmp-026) | Summary block і міжблокові refresh events | CMP-017, CMP-024, CMP-025 | pending |
| [CMP-027](#cmp-027) | Наскрізна Oracle/browser кваліфікація | CMP-022, CMP-023, CMP-024, CMP-025, CMP-026 | pending |
| [CMP-028](#cmp-028) | Public CLI surface | CMP-018, CMP-020, CMP-022 | pending |
| [CMP-029](#cmp-029) | MCP tools, jobs і artifacts | CMP-018, CMP-020, CMP-022, CMP-028 | pending |
| [CMP-030](#cmp-030) | Focused Codex skills і task routing | CMP-028, CMP-029 | pending |
| [CMP-031](#cmp-031) | Catalog panel із reviewable blueprint changes | CMP-008, CMP-009, CMP-018, CMP-028, CMP-029 | pending |
| [CMP-032](#cmp-032) | Version upgrade і structural three-way merge | CMP-006, CMP-019, CMP-021, CMP-022 | pending |
| [CMP-033](#cmp-033) | Remove/detach, dependency cleanup і migration seam | CMP-021, CMP-022, CMP-032 | pending |
| [CMP-034](#cmp-034) | Розширення бібліотеки і два application blueprints | CMP-026, CMP-032, CMP-033 | pending |
| [CMP-035](#cmp-035) | Локальне авторство та захоплення готового блока | CMP-007, CMP-019, CMP-032, CMP-034 | pending |
| [CMP-036](#cmp-036) | Trust, provenance і supply-chain hardening | CMP-007, CMP-010, CMP-029, CMP-035 | pending |
| [CMP-037](#cmp-037) | Security/property/fault regression suite | CMP-020, CMP-022, CMP-031, CMP-032, CMP-033, CMP-036 | pending |
| [CMP-038](#cmp-038) | Benchmarks і agent workflow evaluation | CMP-008, CMP-010, CMP-018, CMP-027, CMP-030, CMP-034, CMP-037 | pending |
| [CMP-039](#cmp-039) | Bundling і clean-install перевірки | CMP-028, CMP-029, CMP-030, CMP-031, CMP-036 | pending |
| [CMP-040](#cmp-040) | Cross-platform CI і release gates | CMP-022, CMP-032, CMP-037, CMP-038, CMP-039 | pending |
| [CMP-041](#cmp-041) | Документація, приймання і release readiness | CMP-027, CMP-031, CMP-032, CMP-033, CMP-034, CMP-035, CMP-038, CMP-039, CMP-040 | pending |

### 18.4. Детальні картки

---

### Фаза P00 — Foundation audit

**Результат:** G0: фактологічна основа, baseline, ADR і ledger.

<a id="cmp-000"></a>
#### CMP-000 — Аудит checkout і карта інтеграції

**Залежності:** немає. **Scope:** `LOCAL`.

**Мета:** Знайти фактичні точки розширення, щоб Composer не став дублюючим продуктом усередині APEXREST.

**Точки роботи / артефакти:** AGENTS.md; package.json; docs/acceptance.json; packages/core, cli, mcp; resources; plugins; нові docs/composer/audit.md та audit.uk.md.

**Порядок реалізації:**

1. Зафіксувати git HEAD, branch, status, applicable instructions і відмінність від опорного commit цього плану. Не checkout/reset стару ревізію.
2. Прочитати current source dispatch: CLI → operation schema → core → jobs/artifacts → Oracle/deploy. Записати реальні symbol names та paths.
3. Знайти каталоги, build scripts, recipe registries, metadata reader, source hashing, safe filesystem utilities і panel API. Визначити, що reuse, extend, create.
4. Перевірити існуючий APEXlang reader на anonymous declarations, repeated/quoted keys, source spans та mutability. Не робити висновок про lossless editing без fixtures.
5. Зіставити current docs та code; зафіксувати розбіжності й обмеження audit. Не виправляти сторонні bugs у цьому task.

**Обов’язкові перевірки:**

- [ ] Перевірити, що кожне integration point посилається на існуючий файл/symbol.
- [ ] Перевірити відсутність змін історичної build-spec, користувацьких dirty files і installed plugin cache.
- [ ] Підтвердити, що audit не виконав жодних Oracle writes або publication commands.

**Критерії завершення:**

- [ ] Є коротка карта current architecture і proposed extension points з provenance.
- [ ] Невідомі місця позначені unknown із конкретним наступним способом перевірки, не припущенням.
- [ ] Ledger `CMP-000`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-001"></a>
#### CMP-001 — Baseline перевірок і журнал виконання

**Залежності:** `CMP-000`. **Scope:** `LOCAL`.

**Мета:** Відокремити існуючі проблеми від регресій Composer та створити надійний стан між сесіями.

**Точки роботи / артефакти:** docs/composer/task-ledger.json; docs/composer/evidence/; чинні implementation-status та next-actions; existing test scripts.

**Порядок реалізації:**

1. Перевірити versions Node/npm, lockfile й dependency installation policy. Не оновлювати toolchain тільки через появу цього плану.
2. Прочитати scripts до запуску; визначити offline, compiler-only і connected suites. Виконати доступні релевантні локальні baseline checks.
3. Записати command, cwd, exit code, timestamps, environment category та artifact refs. Sanitize secrets; не включати user-specific absolute paths у public summary.
4. Створити ledger для CMP-000…CMP-041 зі states та dependencies. Не позначати задачі completed за фактом їх опису.
5. Зафіксувати baseline failures із поясненням, scope та способом reproduction; додати next dependency-ready tasks.

**Обов’язкові перевірки:**

- [ ] Ledger schema відхиляє unknown task ID, cycle і done без evidence.
- [ ] Unrun Oracle/browser suites відображені окремо від successful unit tests.
- [ ] Existing failing test не зникає з baseline після додавання Composer.

**Критерії завершення:**

- [ ] Baseline придатний для порівняння після кожної фази.
- [ ] Нова сесія може визначити current task і blockers без читання попереднього чату.
- [ ] Ledger `CMP-001`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-002"></a>
#### CMP-002 — ADR, threat model і acceptance IDs

**Залежності:** `CMP-000`, `CMP-001`. **Scope:** `LOCAL`.

**Мета:** Заморозити вузькі початкові рішення й межі дозволів до появи великого коду.

**Точки роботи / артефакти:** docs/composer/adr/; architecture.md/uk.md; доповнення docs/acceptance.json за чинним форматом.

**Порядок реалізації:**

1. Оформити ADR: deterministic core; exact versioned blocks; bounded structural transformer; local durable state; reuse deployment; no plugin-owned LLM.
2. Визначити MVP profile і strategy: один scalar key для write CRUD, trusted local/bundled sources, extension existing app, explicit API binding.
3. Скласти trust boundaries і threat cases із розділу 16, including plan tampering, stale snapshots і TOCTOU.
4. Завести acceptance IDs для інваріантів INV-01…INV-16 і gates G0…G8. Не змінювати existing required gates.
5. Узгодити tracked state path, evidence storage, schema version policy та format ownership; alternative залишити documented, не прихованим TODO.

**Обов’язкові перевірки:**

- [ ] Кожен sensitive effect має конкретну policy boundary та негативний test owner.
- [ ] Кожне рішення містить наслідки й причину відхилення очевидної альтернативи.
- [ ] EN/UK docs узгоджені; історична build-spec незмінена.

**Критерії завершення:**

- [ ] G0 закритий: відомий baseline, інваріанти й task dependency graph.
- [ ] Немає невизначеності, яка змусить transport самостійно виконувати business logic.
- [ ] Ledger `CMP-002`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P01 — Formats and durable state

**Результат:** Schemas, safe parsing, hashes і ownership model.

<a id="cmp-003"></a>
#### CMP-003 — Strict schemas та contract dialect

**Залежності:** `CMP-002`. **Scope:** `LOCAL`.

**Мета:** Створити перевірюваний public format до реалізації resolver.

**Точки роботи / артефакти:** packages/core/src/composer/schemas/; schema fixtures; contract tests; generated editor schemas за existing conventions.

**Порядок реалізації:**

1. Визначити BlockManifest, DataContract, Blueprint, Plan, Lockfile, State, Evidence та Diagnostic як strict schemas.
2. Реалізувати version discriminator, discriminated unions для dataset/command/event, scope-specific effects і identifiers.
3. Узгодити grammar references: block IDs, entity refs, command refs, contract refs та instance event/action paths. Не розбирати їх глобальним split без validation.
4. Задати допустимий contract subset і напрямлені compatibility rules; unsupported constructs — явна помилка.
5. Додати JSON-compatible schema fixtures з прикладів цього документа, виправивши лише ті поля, що рішення ADR конкретизувало. Підтримати generate/check editor schema.

**Обов’язкові перевірки:**

- [ ] Unknown keys, invalid versions, malformed refs, prototype-sensitive keys і inconsistent unions відхиляються.
- [ ] Позитивні manifest/blueprint приклади проходять validation.
- [ ] Golden public JSON Schema не розходиться з runtime validation.

**Критерії завершення:**

- [ ] Є один перевірюваний source of truth для public types.
- [ ] Помилки містять machine code, JSON path і зрозумілий англійський message.
- [ ] Ledger `CMP-003`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-004"></a>
#### CMP-004 — Безпечне читання YAML/JSON і package paths

**Залежності:** `CMP-003`. **Scope:** `LOCAL`.

**Мета:** Гарантувати, що документи каталогу не стають executable code або виходом за межі проєкту.

**Точки роботи / артефакти:** composer/catalog/loader.ts; existing filesystem helpers; parser adapter; malformed-input fixtures.

**Порядок реалізації:**

1. Спочатку перевірити наявність parser dependency. За потреби додати одну reviewed pinned YAML library через чинний dependency process, не власний YAML parser.
2. Реалізувати JSON-compatible parsing із byte/depth/collection limits, duplicate-key rejection та забороною custom tags/aliases у MVP.
3. Обмежити $ref resolution локальним package root і explicit contract registry; заборонити network references.
4. Нормалізувати paths, відхиляти absolute/traversal/special files/symlinks відповідно до existing containment policy.
5. Повертати bounded diagnostic без raw secret-bearing input; зберігати bytes digest прочитаного payload.

**Обов’язкові перевірки:**

- [ ] Alias bomb, nested payload, duplicate port і ../../secret відхиляються до semantic execution.
- [ ] Windows separators, Unicode paths і symlink escape перевіряються на підтримуваних OS.
- [ ] Loader не викликає shell, import() package hooks або мережу.

**Критерії завершення:**

- [ ] Untrusted manifest лишається даними.
- [ ] Небезпечний пакет відхиляється до generation, cache publication і target reads.
- [ ] Ledger `CMP-004`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-005"></a>
#### CMP-005 — Canonical snapshots і content digests

**Залежності:** `CMP-003`, `CMP-004`. **Scope:** `LOCAL`.

**Мета:** Зробити plan та generated source відтворюваними й коректно виявляти drift.

**Точки роботи / артефакти:** composer/context/snapshot.ts; shared digest utilities; canonicalization fixtures.

**Порядок реалізації:**

1. Reuse current hashing conventions там, де вони відповідають новій semantic model; задокументувати відмінності.
2. Визначити canonical JSON, ordering arrays, string/number handling, source byte policy та excludes.
3. Відокремити semantic payload від volatile delivery envelope, timestamps і job IDs.
4. Створити inventory digest, що враховує important absent paths і symbol namespace, а не тільки modified file hashes.
5. Виключити self-referential digest fields; протестувати graph of package/lock/plan/evidence hashes.

**Обов’язкові перевірки:**

- [ ] Object key permutation не змінює digest; semantic array permutation змінює, коли порядок важливий.
- [ ] Одна змінена contract/resource byte робить relevant plan stale.
- [ ] Зміна timestamps не змінює source digest; tampered policy envelope усе одно відхиляється.

**Критерії завершення:**

- [ ] Canonicalization має golden test vectors.
- [ ] Немає циклічного hashing і прихованих nondeterministic inputs.
- [ ] Ledger `CMP-005`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-006"></a>
#### CMP-006 — Tracked state, base store і runtime journal model

**Залежності:** `CMP-003`, `CMP-005`. **Scope:** `LOCAL`.

**Мета:** Підготувати ownership і recovery ще до першого writer.

**Точки роботи / артефакти:** composer/state storage adapters; recovery schema; application project fixture .gitignore; docs state policy.

**Порядок реалізації:**

1. Підтвердити tracked namespace та private runtime namespace. Перевірити, що state не губиться через existing .gitignore.
2. Описати instance/declaration ownership, symbol maps, generation bases і lastMaterialized/lastDeployed distinction.
3. Зберігати retrievable generated base content, не тільки hash; прив’язати до instance і source identity.
4. Визначити journal states prepared/writing/source-written/state-written/completed/recovery-required та per-file hash transitions.
5. Передбачити format migration і missing/corrupt state без автоматичного adoption unmanaged files.

**Обов’язкові перевірки:**

- [ ] Roundtrip serialization зберігає всі identities і не містить credentials/machine paths.
- [ ] Missing base та corrupt journal дають контрольовані errors.
- [ ] Fresh clone з tracked state відтворює ті самі symbol allocations.

**Критерії завершення:**

- [ ] State model достатня для no-op та three-way update.
- [ ] Operational journal не плутається з deployment history.
- [ ] Ledger `CMP-006`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P02 — Executable catalog

**Результат:** G1: offline catalog та qualification model.

<a id="cmp-007"></a>
#### CMP-007 — Executable block registry поверх існуючих каталогів

**Залежності:** `CMP-003`, `CMP-004`, `CMP-005`. **Scope:** `LOCAL`.

**Мета:** Додати новий рівень Blocks, не дублюючи Components і Patterns.

**Точки роботи / артефакти:** resources/blocks/; composer/catalog/index.ts; existing reference index builder; packaging source map.

**Порядок реалізації:**

1. Створити мінімальний registry schema з immutable id/version/digest і separate evidence references.
2. Додати recipe references до existing component/pattern IDs, з validation existence та host identity.
3. Запакувати два мінімальні draft manifests для майбутнього vertical slice; не ставити ready або runtime-verified.
4. Створити deterministic builder/check mode, який перевіряє файли, local refs, dependencies, provenance та duplicate IDs.
5. Залишити existing IDs, corpus defaults і search semantics backward-compatible.

**Обов’язкові перевірки:**

- [ ] Same id/version different payload — error; duplicate source anchor — diagnostic.
- [ ] Missing recipe reference не ігнорується.
- [ ] Existing reference corpus tests проходять без Composer-specific environment.

**Критерії завершення:**

- [ ] Каталог читається offline і без project.
- [ ] Draft blocks discoverable, але не видаються за runnable certified modules.
- [ ] Ledger `CMP-007`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-008"></a>
#### CMP-008 — Пошук, filters і explainable shortlist

**Залежності:** `CMP-007`. **Scope:** `LOCAL`.

**Мета:** Зменшити agent context і кількість невдалих підборів без введення vector service.

**Точки роботи / артефакти:** composer/catalog/search.ts; alias dictionaries; existing reference search schema; relevance fixtures.

**Порядок реалізації:**

1. Додати англійські/українські business aliases й exact identifier lookup.
2. Розділити hard filters, ranking і rejected-candidate explanation. Unknown context не прирівнювати до match.
3. Повернути compact card: contract requirements, effects, compatibility, evidence dimensions, adaptation reasons.
4. Реалізувати stable paging bound до index digest та bounded detail/source reads.
5. Створити невеликий judged query set: CRUD, довідник, модальна форма, показники, master-detail unsupported.

**Обов’язкові перевірки:**

- [ ] Несумісний semantic match не перемагає придатний кандидат.
- [ ] EN/UK aliases ведуть до однакових IDs.
- [ ] Перебір сторінок не губить/дублює results; stale cursor відхиляється.

**Критерії завершення:**

- [ ] Є reproducible ranking і пояснення відбору.
- [ ] Search не читає Oracle й не вантажить повні recipes без запиту.
- [ ] Ledger `CMP-008`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-009"></a>
#### CMP-009 — Compatibility profiles та evidence policy

**Залежності:** `CMP-007`. **Scope:** `LOCAL`.

**Мета:** Перевіряти конкретні конфігурації, а не довільні версійні назви.

**Точки роботи / артефакти:** composer/catalog/compatibility.ts; evidence schemas/store; toolchain profile adapters.

**Порядок реалізації:**

1. Описати APEX, UT, MMD, SQLcl/compiler, generator та required features як окремі dimensions.
2. Взяти initial profile із реально наявного pinned toolchain; перевірити facts. Назва profile не доводить support.
3. Реалізувати statuses compatible/incompatible/unknown і diagnostic reasons; no silent nearest-version fallback.
4. Прив’язати evidence до source/configuration/fixture/toolchain digests і позначати stale після їх зміни.
5. Визначити qualification policy для read-only і write blocks; compiler-only evidence не задовольняє runtime-ready gate.

**Обов’язкові перевірки:**

- [ ] Однаковий APEX major із різним unsupported MMD не дає false compatibility.
- [ ] Copied evidence з іншого source digest відхиляється.
- [ ] not-run/failed/blocked не агрегуються в зелений ready.

**Критерії завершення:**

- [ ] Кожен compatibility verdict пояснюється facts.
- [ ] UI/CLI/MCP використовують однакові independent evidence dimensions.
- [ ] Ledger `CMP-009`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-010"></a>
#### CMP-010 — Immutable local cache і index lifecycle

**Залежності:** `CMP-007`, `CMP-008`, `CMP-009`. **Scope:** `LOCAL`.

**Мета:** Зробити offline discovery і replay передбачуваними.

**Точки роботи / артефакти:** composer/catalog cache adapter; existing managed resources home; corruption/rebuild tests.

**Порядок реалізації:**

1. Reuse existing safe artifact/cache storage; додати content-addressed block payload storage.
2. Розділити source payload, search index і evidence updates, щоб зміна test run не перепаковувала block.
3. Задати cache keys, manifest revision, invalidation і explicit missing artifact errors.
4. Заборонити implicit downloads, execution hooks і auto-update locked version під час search/plan/materialize.
5. Додати read-only check integrity та maintainer rebuild без зміни business project.

**Обов’язкові перевірки:**

- [ ] Corrupt payload не потрапляє в planner.
- [ ] Cold/warm cache дають однаковий shortlist і semantic result.
- [ ] Offline missing artifact дає actionable error без network attempt.

**Критерії завершення:**

- [ ] G1 закритий для validated formats і offline catalog.
- [ ] Runtime catalog не залежить від checkout maintainer scripts.
- [ ] Ledger `CMP-010`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P03 — Context and Oracle binding

**Результат:** Verified inventory і typed entity/API bindings.

<a id="cmp-011"></a>
#### CMP-011 — Project inventory і reader adapter

**Залежності:** `CMP-000`, `CMP-005`, `CMP-006`. **Scope:** `LOCAL`.

**Мета:** Отримати повний scope identities та unmanaged source для безпечного extension.

**Точки роботи / артефакти:** composer/context/project.ts; composer/transform/reader-adapter.ts; existing source reader; export fixtures.

**Порядок реалізації:**

1. Побудувати adapter над фактичним reader, не переносити build-only script у runtime без оцінки dependencies.
2. Інвентаризувати pages/items/regions/actions/shared resources/routes та relevant .apex metadata.
3. Зберігати source spans і original bytes для untouched constructs; позначати unknown constructs.
4. Побудувати reference inventory з known/unknown edges. Unknown consumers враховувати при updates/removal.
5. Сформувати immutable project snapshot із existing ownership та absent-path constraints.

**Обов’язкові перевірки:**

- [ ] Anonymous declarations, repeated keys, comments і quoted keys не губляться.
- [ ] Непідтримуваний construct не зникає з inventory мовчки.
- [ ] Read-only inventory не змінює файлів.

**Критерії завершення:**

- [ ] Є collision-safe source inventory.
- [ ] Підтверджена supported read/edit boundary із реальними fixtures.
- [ ] Ledger `CMP-011`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-012"></a>
#### CMP-012 — Oracle metadata для keys, types і signatures

**Залежності:** `CMP-003`, `CMP-005`. **Scope:** `LOCAL + optional authorized ORACLE_READ`.

**Мета:** Надати binder достатню інформацію без broad schema access.

**Точки роботи / артефакти:** packages/core/src/metadata.ts; composer/context/oracle.ts; bounded query tests.

**Порядок реалізації:**

1. Додати окремі bounded metadata kinds або backwards-compatible fields за current schema conventions.
2. Реалізувати PK/UK/FK column ordering, referenced owners/columns, constraint state і column precision/scale/length.
3. Додати exact argument identity для overload mapping, direction, defaults і supported complex-type diagnostics.
4. Зберегти target verification, parsing-schema restriction, pagination, parameter binds і current backend mode.
5. Позначити metadata snapshots provenance/freshness; не використовувати stale read як fresh apply identity.

**Обов’язкові перевірки:**

- [ ] Composite FK із переставленими columns виявляється.
- [ ] Cross-schema access залишається denied або restricted.
- [ ] Overload ambiguity і pagination boundaries не дають fabricated success.
- [ ] За доступного дозволеного target виконати actual read-only query verification; інакше status not-run.

**Критерії завершення:**

- [ ] Binder отримує ordered structured facts.
- [ ] Existing metadata consumers і CLI/MCP contracts збережені.
- [ ] Ledger `CMP-012`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-013"></a>
#### CMP-013 — Dataset contracts і entity binding

**Залежності:** `CMP-003`, `CMP-009`, `CMP-011`, `CMP-012`. **Scope:** `LOCAL`.

**Мета:** Надійно з’єднати generic fields блока з реальними джерелами.

**Точки роботи / артефакти:** composer/binding/entity.ts; contract compatibility rules; view/table fixtures.

**Порядок реалізації:**

1. Реалізувати explicit field mapping, nullability, enum/length compatibility і exact numeric serialization.
2. Перевіряти keys за constraints або reviewed key contract; view без proof не стає editable автоматично.
3. Відокремити filter inputs, sort allowlist, pagination та tenant/row scope contract.
4. Підтримати scalar-key runnable MVP; composite keys зберегти в model і блокувати unsupported adapter.
5. Побудувати typed BoundDataset із source provenance та required source-query checks.

**Обов’язкові перевірки:**

- [ ] Missing key, nullable mismatch, high-precision NUMBER і unsupported timezone mapping діагностуються.
- [ ] Довільний sort expression не потрапляє в SQL.
- [ ] Status summary успадковує той самий access scope, що й list.

**Критерії завершення:**

- [ ] Entity binding не ґрунтується лише на схожості назв.
- [ ] Кожна unsafe ambiguity блокує materializable plan.
- [ ] Ledger `CMP-013`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-014"></a>
#### CMP-014 — Commands, auth contracts і transaction semantics

**Залежності:** `CMP-003`, `CMP-012`, `CMP-013`. **Scope:** `LOCAL`.

**Мета:** Не допустити робочого на вигляд CRUD без підтвердженої серверної поведінки.

**Точки роботи / артефакти:** composer/binding/command.ts; authorization.ts; reviewed adapter contracts; API fixtures.

**Порядок реалізації:**

1. Розв’язувати exact package/procedure/overload і typed IN/OUT/IN OUT mapping.
2. Вимагати write/read/row-level authorization contract, output key, error mapping та optimistic-lock capability.
3. Описати caller-owned/API-owned transaction semantics; не визначати їх лише з dictionary signature.
4. Відхиляти hidden-item tenant authority, missing server check і процедури з невідомими побічними effects.
5. Побудувати BoundCommand, який generator використовує без довільної PL/SQL string substitution.

**Обов’язкові перевірки:**

- [ ] Wrong direction/type і ambiguous overload — blocked.
- [ ] Missing authorization або expected version — blocked для write mode.
- [ ] Мок authorization contract не записується як runtime security evidence.

**Критерії завершення:**

- [ ] Усі write bindings мають explicit reviewed behavioral contract.
- [ ] Plan відрізняє runtime DML від effects compose operation.
- [ ] Ledger `CMP-014`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P04 — Deterministic planning

**Результат:** G2: resolved, reviewable immutable plan.

<a id="cmp-015"></a>
#### CMP-015 — Deterministic dependency і capability resolver

**Залежності:** `CMP-007`, `CMP-009`, `CMP-013`, `CMP-014`. **Scope:** `LOCAL`.

**Мета:** Побудувати точну сумісну композицію з контрольованими conflicts.

**Точки роботи / артефакти:** composer/resolver/dependencies.ts; capabilities.ts; solver fixtures.

**Порядок реалізації:**

1. Для MVP підтримати exact versions; constraints майбутніх ranges тримати за explicit unsupported gate.
2. Завантажувати transitive manifests через verified registry, виявляти missing/revoked dependencies і cycles.
3. Розв’язувати required capabilities через explicit provider choices; ambiguous providers не вибирати довільно.
4. Побудувати deterministic topological ordering, limits nodes/depth і стабільне conflict explanation.
5. Повернути proposed lock payload без його запису; failure не змінює existing lock.

**Обов’язкові перевірки:**

- [ ] Diamond dependency deduplicates тільки однаковий artifact.
- [ ] Version/capability conflict має короткий dependency path до причини.
- [ ] Input ordering не змінює resolved graph.

**Критерії завершення:**

- [ ] Resolver pure над immutable inputs.
- [ ] Не існує неявного dependency upgrade або partial lockfile write.
- [ ] Ledger `CMP-015`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-016"></a>
#### CMP-016 — Stable allocator і shared resource ownership

**Залежності:** `CMP-006`, `CMP-011`, `CMP-015`. **Scope:** `LOCAL`.

**Мета:** Збирати два екземпляри однакового блока без конфліктів і перенумерації.

**Точки роботи / артефакти:** composer/symbols/allocator.ts; resources.ts; references.ts; allocation snapshots.

**Порядок реалізації:**

1. Завантажувати prior allocations і current reserved namespace inventory.
2. Визначити stable logical keys для pages, items, regions, actions і shared resources.
3. Призначати нові symbols у deterministic order з перевіркою byte lengths, truncation і case collisions.
4. Deduplicate shared resources за semantic identity/config/version, не тільки name.
5. Зберігати external/unmanaged references без adoption; повертати complete consumers graph.

**Обов’язкові перевірки:**

- [ ] Два CRUD instances, Unicode titles і однакові shortened names не collide.
- [ ] Зміна порядку blocks не змінює existing allocations.
- [ ] Same-name different-SQL LOV не зливається.

**Критерії завершення:**

- [ ] Allocator дає stable identities й пояснювані conflicts.
- [ ] Oracle internal IDs залишаються відповідальністю existing Oracle metadata mechanisms.
- [ ] Ledger `CMP-016`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-017"></a>
#### CMP-017 — Typed event, action і route wiring

**Залежності:** `CMP-013`, `CMP-014`, `CMP-016`. **Scope:** `LOCAL`.

**Мета:** Перетворити набір блоків на узгоджену взаємодію.

**Точки роботи / артефакти:** composer wiring module; event contracts; modal/refresh fixtures.

**Порядок реалізації:**

1. Валідувати endpoint grammar, exported actions/events і direction payload compatibility.
2. Розділити dependency DAG та runtime interaction graph; визначити allowed cycle policy.
3. Генерувати instance-scoped wiring model, submitted items, route params і returned key mapping.
4. Описати save success, cancel, error, coalescing і handler cleanup/reinitialization.
5. Перевірити, що кожний declared visible action має implementation або явно disabled mode.

**Обов’язкові перевірки:**

- [ ] Connection до missing action, invalid payload або cross-instance selector відхиляється.
- [ ] Не виникає duplicate refresh handler після повторного render.
- [ ] Cancel і failed save не емітять saved event.

**Критерії завершення:**

- [ ] Усі UI connections мають typed resolved targets.
- [ ] Список і summary можуть реагувати на один успішний write без event loop.
- [ ] Ledger `CMP-017`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-018"></a>
#### CMP-018 — Composition plan і diagnostics

**Залежності:** `CMP-005`, `CMP-006`, `CMP-015`, `CMP-016`, `CMP-017`. **Scope:** `LOCAL`.

**Мета:** Об’єднати контракти в immutable local plan без side effects для додатка.

**Точки роботи / артефакти:** composer/planner.ts; diagnostics.ts; plan schemas; artifact registry integration.

**Порядок реалізації:**

1. Зібрати pure planner pipeline з окремими context reads.
2. Сформувати operations, identity allocations, dependencies, effects, preconditions і expected outputs.
3. Реалізувати statuses materializable/blocked, stable diagnostic codes, input paths, remediation і bounded summary.
4. Записувати plan лише у дозволені local artifacts; output file collision не перезаписувати без existing policy.
5. Зберегти compile status як independent field; missing compiler не видавати за passed. Визначити materialization policy для unverified draft.

**Обов’язкові перевірки:**

- [ ] Plan не змінює source, state, lock і DB.
- [ ] Невалідний один block блокує apply всього plan без прихованого partial execution.
- [ ] Plan byte/semantic snapshots стабільні між runs.

**Критерії завершення:**

- [ ] G2: із fixture blueprint виходить повний пояснюваний deterministic plan.
- [ ] Blocked plan неможливо подати materializer як approved.
- [ ] Ledger `CMP-018`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P05 — Safe materialization

**Результат:** G3: source generation, no-op, recovery і deploy binding.

<a id="cmp-019"></a>
#### CMP-019 — Bounded APEXlang structural transformer

**Залежності:** `CMP-011`, `CMP-016`, `CMP-017`, `CMP-018`. **Scope:** `LOCAL`.

**Мета:** Створити source edits, які не руйнують ручний код і Oracle metadata.

**Точки роботи / артефакти:** composer/transform/edits.ts; emitter.ts; source span adapter; golden fixtures.

**Порядок реалізації:**

1. Реалізувати лише supported insert/set/bind/rename operations із preconditions на node/span.
2. Використати typed mapping для identifiers, values, SQL projections і item references; не global replace.
3. Зберігати untouched original bytes, comments, repeated keys і anonymous declarations.
4. Виявляти overlapping edits, ambiguous anchors, unknown references і unsupported syntax.
5. Створити full-application staging source із preserved .apex metadata; підключити existing compiler adapter без DB import.

**Обов’язкові перевірки:**

- [ ] Golden untouched spans byte-identical.
- [ ] String literal зі схожим P42_ не змінюється при symbol rename.
- [ ] Compiler smoke реальний за доступності; compiler mock лишається unit evidence.

**Критерії завершення:**

- [ ] Transform не має silent fallback на whole-file rewrite.
- [ ] Generated source проходить structural/reference validation у supported scope.
- [ ] Ledger `CMP-019`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-020"></a>
#### CMP-020 — Journaled local materialization і recovery

**Залежності:** `CMP-006`, `CMP-018`, `CMP-019`. **Scope:** `LOCAL`.

**Мета:** Безпечно застосувати локальний план із revalidation та crash recovery.

**Точки роботи / артефакти:** composer/materializer.ts; recovery.ts; existing safe writes/locks; fault injection fixtures.

**Порядок реалізації:**

1. Використати exclusive project ownership і revalidate всі source/contract/catalog/state/absence preconditions.
2. Підготувати complete staged output та local backups; перевірити containment і symlink races перед write.
3. Записати durable prepared journal; виконувати per-file replacement із preimage/postimage checks.
4. Оновити tracked lock/state лише після source postimage validation; success receipt останнім.
5. Реалізувати interrupted run reconciliation, known pre/post state handling і conflict при невідомих bytes. Не автоматично overwrite зовнішні зміни.

**Обов’язкові перевірки:**

- [ ] Kill/fault injection після кожного journal transition не дає false success.
- [ ] Другий materializer блокується, stale plan відхиляється.
- [ ] Recovery торкається тільки local files; DB adapter write methods ніколи не викликаються.

**Критерії завершення:**

- [ ] Local materialization має документований crash-safe protocol, не неправдиву multi-file atomicity.
- [ ] Partial state видимий і відновлюється без втрати ручних змін.
- [ ] Ledger `CMP-020`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-021"></a>
#### CMP-021 — Idempotence та базові ownership modes

**Залежності:** `CMP-020`. **Scope:** `LOCAL`.

**Мета:** Зробити повторне складання no-op і підтримати явне збереження ручних доробок.

**Точки роботи / артефакти:** composer state/materializer; extension schemas; idempotence and detach fixtures.

**Порядок реалізації:**

1. Replan materialized project і порівняти semantic output, references, file bytes та state.
2. Заборонити regeneration timestamps або випадкові IDs у generated files.
3. Реалізувати managed/extended/detached ownership transitions через explicit plan.
4. Додати typed extension points для validation/notification без довільного evaluator у Composer.
5. Manual drift у managed declaration показувати як conflict або explicit adoption decision, не автоматично стирати.

**Обов’язкові перевірки:**

- [ ] Два послідовні materialize дають нуль змінених source/state files у другому run.
- [ ] Unmanaged додаткова сторінка та existing auth scheme залишаються незмінними.
- [ ] Detached declaration не змінюється після нового generate.

**Критерії завершення:**

- [ ] INV-07 та INV-08 перевірені автоматично.
- [ ] Ownership transitions мають audit/provenance.
- [ ] Ledger `CMP-021`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-022"></a>
#### CMP-022 — Binding із чинним deployment pipeline

**Залежності:** `CMP-020`, `CMP-021`. **Scope:** `LOCAL`.

**Мета:** Забезпечити, що deployment застосовує саме переглянуту Composer generation.

**Точки роботи / артефакти:** Existing deployment plan/source discovery; composer receipt adapter; deploy regression tests.

**Порядок реалізації:**

1. Знайти current plan extension/source manifest seam і додати typed composition binding, не другий deploy implementation.
2. Включити blueprint/lock/state-generation/resources/adapter/generator digests до relevant source drift checks.
3. Виявляти mismatch між materialized source та updated blueprint до apply.
4. Зберегти existing target identity, full import, backup, grants, local history, external production approval та unknown-outcome semantics.
5. Забезпечити backward compatibility для projects без Composer; не створювати нових control tables або mandatory suites.

**Обов’язкові перевірки:**

- [ ] Edit blueprint after deploy plan → stale error до DB write.
- [ ] Edit adapter/resource або state → відповідна drift error.
- [ ] Legacy project має попередню deploy behavior.
- [ ] Production approval cannot be replaced by Composer flag or package metadata.

**Критерії завершення:**

- [ ] G3: Composer source готовий для existing deployment без обходів.
- [ ] Старий apply не може мовчки пропустити нові Composer inputs.
- [ ] Ledger `CMP-022`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P06 — Runtime vertical slice

**Результат:** G4: реальна кваліфікація list/dialog/summary.

<a id="cmp-023"></a>
#### CMP-023 — Ізольований CRM fixture і API contract

**Залежності:** `CMP-013`, `CMP-014`, `CMP-022`. **Scope:** `LOCAL; fixture execution requires explicit DEV_DDL_DML authorization`.

**Мета:** Створити відтворювану тестову бізнес-модель без доступу до реальних даних користувача.

**Точки роботи / артефакти:** tests/fixtures/composer/crm/; reviewed SQL setup/teardown scripts; API/error/auth contracts; fixture docs.

**Порядок реалізації:**

1. Описати synthetic customers із stable key, label, status та version; передбачити принаймні два різні access scopes.
2. Написати reviewed fixture DDL/API: explicit create/update, caller-owned transactions, server-side auth і optimistic locking.
3. Додати seed із синтетичних даних, ownership markers і scoped cleanup. Ніколи не використовувати production schema або generic drop-all.
4. Описати saved input/output, validation і error contracts, deterministic fixture reset strategy та allowed test mutations.
5. Setup scripts лише створити локально. Виконувати їх тільки за окремого точного дозволу на isolated dev/test DDL/DML.

**Обов’язкові перевірки:**

- [ ] Static SQL review і contract fixtures доступні offline.
- [ ] У live run перевірити unauthorized write, stale version та validation without partial commit.
- [ ] Cleanup відмовляється на wrong target/owner/marker.

**Критерії завершення:**

- [ ] Fixture можна відтворити без private data або hidden prerequisites.
- [ ] API behavior documented; live evidence відокремлена від написаних scripts.
- [ ] Ledger `CMP-023`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-024"></a>
#### CMP-024 — Перший runnable read-only список

**Залежності:** `CMP-019`, `CMP-020`, `CMP-023`. **Scope:** `LOCAL`.

**Мета:** Довести component-to-block path на вузькому безпечному сценарії.

**Точки роботи / артефакти:** resources/blocks/packages/crud/report-dialog/0.1.0/; reviewed existing report recipe; source and golden tests.

**Порядок реалізації:**

1. Вибрати реально підтримуваний report host і recipe; зберегти source provenance.
2. Реалізувати projection, row key, filtering/sorting allowlists і explicit read-only mode.
3. Додати empty/error/loading behavior у межах підтримуваного APEX host.
4. Матеріалізувати у fixture application, перевірити full-source compile та reference inventory.
5. Додати second instance fixture, щоб виявити hidden static IDs до write form.

**Обов’язкові перевірки:**

- [ ] Report source SQL і key mapping коректні для fixture.
- [ ] У read-only mode немає active unsupported write buttons.
- [ ] Два instances не мають collision; repeat generate no-op.

**Критерії завершення:**

- [ ] Є перший end-to-end local block build.
- [ ] Compiler/import/browser evidence записана лише для реально виконаних levels.
- [ ] Ledger `CMP-024`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-025"></a>
#### CMP-025 — Модальна форма зі збереженням через API

**Залежності:** `CMP-014`, `CMP-017`, `CMP-023`, `CMP-024`. **Scope:** `LOCAL`.

**Мета:** Додати справжній CRUD write path із серверними гарантіями.

**Точки роботи / артефакти:** report-dialog source/contracts; PL/SQL process adapter; browser case definitions.

**Порядок реалізації:**

1. Додати create/edit modal із окремими draft contracts: create без persisted key/version, edit із required key/concurrency token. Визначити editable fields та server validation.
2. Генерувати reviewed procedure invocation за exact BoundCommand; values as binds, server authorization independent від UI.
3. Розділити create key output, edit version conflict, validation error і unexpected server error.
4. Емітити saved тільки з server-success path; close/cancel і focus return відповідно до verified APEX lifecycle.
5. Після save оновити owned list без duplicate event handler; зберегти unsaved input при validation error.

**Обов’язкові перевірки:**

- [ ] Create із новим server-returned key, edit із expected version, cancel, validation error, unauthorized request, mass-assignment rejection і repeated open.
- [ ] Directly tampered key не дає edit чужого запису.
- [ ] Unexpected server error не витікає stack/credentials у user-facing message.

**Критерії завершення:**

- [ ] Write block має повний declared behavior, не просто кнопки.
- [ ] Live write qualification лишається blocked, поки isolated target не перевірений.
- [ ] Ledger `CMP-025`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-026"></a>
#### CMP-026 — Summary block і міжблокові refresh events

**Залежності:** `CMP-017`, `CMP-024`, `CMP-025`. **Scope:** `LOCAL`.

**Мета:** Перевірити композицію незалежних блоків на реальній зміні даних.

**Точки роботи / артефакти:** resources/blocks/packages/analytics/status-summary/0.1.0/; wiring fixtures; integration case definitions.

**Порядок реалізації:**

1. Реалізувати count/group summary для allowed categorical field із exact dataset access scope.
2. Expose typed refresh action; підключити до customerWorkspace.saved через blueprint connection.
3. Додати empty status buckets, ordering і null handling відповідно до data contract.
4. Перевірити instance namespace, refresh coalescing і teardown при повторній ініціалізації.
5. Створити combined fixture: дві customer workspaces із різними filters та summary, без cross-talk.

**Обов’язкові перевірки:**

- [ ] Create/status edit змінює правильний summary; failed save не змінює.
- [ ] Summary не розкриває counts недоступних rows.
- [ ] Repeated refresh не подвоює handlers або DOM IDs.

**Критерії завершення:**

- [ ] Композиція перевіряється як ціле, не тільки сума compile results.
- [ ] Blueprint event graph відповідає фактичним generated actions.
- [ ] Ledger `CMP-026`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-027"></a>
#### CMP-027 — Наскрізна Oracle/browser кваліфікація

**Залежності:** `CMP-022`, `CMP-023`, `CMP-024`, `CMP-025`, `CMP-026`. **Scope:** `Explicit authorized ORACLE_READ + APP_IMPORT + fixture DML/DDL as separately scoped`.

**Мета:** Отримати реальні докази роботи vertical slice і не сплутати їх із unit tests.

**Точки роботи / артефакти:** docs/composer/evidence/; existing deploy/test tools; isolated target fixtures; browser observations.

**Порядок реалізації:**

1. Підтвердити конкретний dev/test target, exact allowed application import та окремий scope fixture writes. Existing valid authorization не перепитувати.
2. Виконати real compiler та дозволені source-query checks; existing deploy plan/apply із backup/identity/drift protections.
3. Перевірити фактичний imported target і runtime metadata, не лише SQLcl exit code.
4. Пройти list/create/edit/cancel/validation/conflict/authorization/summary cases у доступному selected browser; automation та manual observation розділити.
5. Зберегти sanitized evidence із digests, versions, cases і artifacts. Не доступний рівень позначити not-run/blocked і продовжувати незалежні offline tasks.

**Обов’язкові перевірки:**

- [ ] Як мінімум позитивний flow і негативні authorization/concurrency flows на isolated data.
- [ ] Відновлення після failed import використовує existing recovery; unknown outcome не повторюється автоматично.
- [ ] Browser evidence не записується як passed automated suite без actual automation run.

**Критерії завершення:**

- [ ] G4 закривається тільки після потрібної реальної runtime qualification.
- [ ] До G4 продукт може бути позначений experimental/local-verified, але не runtime-verified.
- [ ] Ledger `CMP-027`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P07 — Product interfaces

**Результат:** G5: CLI/MCP/skills/panel parity.

<a id="cmp-028"></a>
#### CMP-028 — Public CLI surface

**Залежності:** `CMP-018`, `CMP-020`, `CMP-022`. **Scope:** `LOCAL`.

**Мета:** Надати користувачу компактні команди над готовим core.

**Точки роботи / артефакти:** packages/cli/ current parser; shared operation schemas; CLI contract tests; help docs.

**Порядок реалізації:**

1. Додати compose plan/materialize у existing command tree та strict argument parsing.
2. Узгодити project/env conventions, plan refs, explicit offline/connected mode і JSON output.
3. Reuse existing Fault/exit-code/result formatting; no business logic у parser.
4. Додати actionable errors для absent blueprint, stale plan, unsupported block, missing toolchain і recovery-required.
5. Оновити help англійською, public examples EN/UK; усі examples виконувати проти local fixtures.

**Обов’язкові перевірки:**

- [ ] Unknown flags, extra fields, invalid plan path, conflicting mode options відхиляються.
- [ ] stdout JSON parseable; stderr logs bounded.
- [ ] Legacy CLI commands і default reference corpus не змінили semantics.

**Критерії завершення:**

- [ ] Нові команди задокументовані як implemented лише після contract tests.
- [ ] CLI та direct core дають equivalent semantic result.
- [ ] Ledger `CMP-028`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-029"></a>
#### CMP-029 — MCP tools, jobs і artifacts

**Залежності:** `CMP-018`, `CMP-020`, `CMP-022`, `CMP-028`. **Scope:** `LOCAL`.

**Мета:** Відкрити ту саму функціональність Codex без дублювання runtime.

**Точки роботи / артефакти:** packages/mcp/ registration; shared schemas; existing jobs/artifacts; MCP contract fixtures.

**Порядок реалізації:**

1. Додати apexrest_compose_plan та apexrest_compose_materialize з precise annotations/effect descriptions.
2. Reuse strict shared schemas; не приймати unbounded code blobs або arbitrary options.
3. Короткі outputs bounded; великі plans/diffs через registered artifact refs і continuation.
4. Довгі operations через existing job worker/status/cancel; повторний polling не запускає нову operation.
5. Перевірити artifact containment/redaction і однакову error taxonomy CLI/MCP.

**Обов’язкові перевірки:**

- [ ] Tool schema parity, malformed request, cancelled job, oversized output і stale artifact refs.
- [ ] Materialize не має readOnly annotation.
- [ ] MCP runtime не стартує LLM, не downloads dependencies і не виконує deploy приховано.

**Критерії завершення:**

- [ ] Дві bounded operations доступні у stdio tool catalog.
- [ ] Transport tests не оголошуються native Codex host evidence.
- [ ] Ledger `CMP-029`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-030"></a>
#### CMP-030 — Focused Codex skills і task routing

**Залежності:** `CMP-028`, `CMP-029`. **Scope:** `LOCAL`.

**Мета:** Навчити Codex користуватися каталогом і Composer у поточній розмові.

**Точки роботи / артефакти:** plugins/apexrest-apex/skills/apexrest-compose/; plugin metadata; optional .agents dev skill; skills packaging tests.

**Порядок реалізації:**

1. Написати англійський SKILL.md із name/description і вузьким scope; використати template із цього плану.
2. Workflow: inspect → shortlist → contracts → blueprint → plan → review → materialize → existing authorized deploy/test.
3. Додати references для supported blocks, conflicts, missing bindings, upgrade і evidence; не завантажувати весь каталог у skill.
4. Окремо, за потреби, створити repo-only composer-dev skill для роботи над backlog; не пакувати його як production application skill.
5. Оновити manifest та routing без видалення current skills; перевірити trigger/non-trigger prompts.

**Обов’язкові перевірки:**

- [ ] CRUD assembly trigger працює; catalog maintenance і plugin development не плутаються.
- [ ] Skill не вимагає direct OpenAI API keys, child model session чи permission bypass.
- [ ] Package містить потрібні references, але не private planning artifacts.

**Критерії завершення:**

- [ ] Codex може виконати supported workflow з bounded tools.
- [ ] Instructions не стверджують support для ще не реалізованих commands.
- [ ] Ledger `CMP-030`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-031"></a>
#### CMP-031 — Catalog panel із reviewable blueprint changes

**Залежності:** `CMP-008`, `CMP-009`, `CMP-018`, `CMP-028`, `CMP-029`. **Scope:** `LOCAL`.

**Мета:** Дати користувачу огляд блоків без створення другого engine у UI.

**Точки роботи / артефакти:** Existing panel router/frontend; core catalog handlers; UI state/interaction tests; EN/UK docs.

**Порядок реалізації:**

1. Додати search/list/detail із contracts, evidence, compatibility, effects і provenance.
2. Додати parameter editor, що спирається на supported schema subset; unknown schema features read-only або unsupported.
3. Add to blueprint створює reviewable diff; conflict із concurrent edit не перезаписує файл.
4. Plan summary показує create/update/preserve/block effects; materialize працює тільки з verified current plan.
5. Показати actual fixture previews тільки з matching digest; підтримати no-preview, stale, empty/error/loading states; зберегти existing panel security.

**Обов’язкові перевірки:**

- [ ] Неявного apply/deploy після Add немає.
- [ ] Malicious preview HTML не виконується.
- [ ] Keyboard navigation, labels, empty/error states і visible write-effects перевірені.
- [ ] Generated JSON UI plan збігається із CLI/MCP core result.

**Критерії завершення:**

- [ ] G5: доступні узгоджені CLI/MCP/skill/panel workflows.
- [ ] Host rendering перевірений окремо або явно зазначено missing evidence.
- [ ] Ledger `CMP-031`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P08 — Maintenance and reuse

**Результат:** G6: upgrade/remove, додаткові blocks і authoring.

<a id="cmp-032"></a>
#### CMP-032 — Version upgrade і structural three-way merge

**Залежності:** `CMP-006`, `CMP-019`, `CMP-021`, `CMP-022`. **Scope:** `LOCAL`.

**Мета:** Оновлювати блоки без втрати customization.

**Точки роботи / артефакти:** composer/update.ts; base store; conflict report artifacts; upgrade golden fixtures.

**Порядок реалізації:**

1. Згенерувати N для exact new version, завантажити B і прочитати actual L.
2. Реалізувати field-aware three-way rules для supported constructs; unknown/overlapping changes блокувати.
3. Показувати зміни defaults, contracts, auth/effects, dependencies і resource consumers.
4. Створювати conflict report без markers у source; resolved decisions перетворювати на новий immutable plan.
5. Не оновлювати lock/version state до успішної materialization; preserve old generation base для recovery.

**Обов’язкові перевірки:**

- [ ] Clean upgrade, manual-only change, disjoint edits, conflicting field, missing base, changed default.
- [ ] Custom validation у extension point зберігається.
- [ ] Semver minor з sensitive effect не проходить тихо.

**Критерії завершення:**

- [ ] Upgrade не містить автоматичного перезапису вручну зміненого source.
- [ ] Update plan так само bound до deployment, як initial build.
- [ ] Ledger `CMP-032`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-033"></a>
#### CMP-033 — Remove/detach, dependency cleanup і migration seam

**Залежності:** `CMP-021`, `CMP-022`, `CMP-032`. **Scope:** `LOCAL`.

**Мета:** Безпечно видаляти композиційні елементи без прихованого руйнування даних.

**Точки роботи / артефакти:** composer removal planning; consumers graph; migration references; docs/recovery cases.

**Порядок реалізації:**

1. Планувати removal тільки для managed artifacts із confirmed ownership.
2. Обчислювати all consumers shared resources, including detached/unmanaged/unknown references.
3. Відокремити detach від delete; unknown references лишають resource і explanatory diagnostic.
4. Schema objects не видаляти. Для майбутніх explicit migrations додати лише typed reference до current immutable migration pipeline.
5. Опрацювати recovery/adoption при missing state; не видаляти за heuristic name prefix.

**Обов’язкові перевірки:**

- [ ] Shared LOV залишається при одному remaining consumer.
- [ ] Deleted blueprint block не запускає DROP TABLE або package uninstall.
- [ ] Unknown consumer і missing owner блокують destructive cleanup.

**Критерії завершення:**

- [ ] Removal plan повністю reviewable і local-first.
- [ ] APEX metadata recovery не рекламується як business-data rollback.
- [ ] Ledger `CMP-033`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-034"></a>
#### CMP-034 — Розширення бібліотеки і два application blueprints

**Залежності:** `CMP-026`, `CMP-032`, `CMP-033`. **Scope:** `LOCAL`.

**Мета:** Перевірити, що архітектура працює не лише на одному demo.

**Точки роботи / артефакти:** resources/blocks/; resources/blueprints/crm-minimal і service-desk-minimal; compatibility/evidence cases.

**Порядок реалізації:**

1. Після стабільних двох initial blocks вибрати наступні: filtered-list, read-only detail, history/timeline і master-detail read view.
2. Кожен новий block проходить manifest/contracts/source/tests/evidence pipeline. Непідтримувані runtime variants залишити draft із reason.
3. Створити CRM blueprint з customers + summary; Service Desk blueprint з tickets + filters + details + history, без вигаданої workflow automation.
4. Використати shared generic entity/command contracts; не hardcode CRM_* у reusable source.
5. Провести combined dependency/resource/event tests; якщо task стає завеликим, оформити child tasks із parent CMP-034 та зберегти його aggregate acceptance.

**Обов’язкові перевірки:**

- [ ] Один block працює з двома різними entity mappings.
- [ ] Blueprint із кількома blocks no-op після другого materialize.
- [ ] Нестворений backend module не маскується mock UI як ready application.

**Критерії завершення:**

- [ ] Є дві відмінні композиції з тих самих primitives.
- [ ] G6 закритий після upgrade/remove та бібліотеки з чесними qualification statuses.
- [ ] Ledger `CMP-034`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-035"></a>
#### CMP-035 — Локальне авторство та захоплення готового блока

**Залежності:** `CMP-007`, `CMP-019`, `CMP-032`, `CMP-034`. **Scope:** `LOCAL + optional separately authorized source ORACLE_READ`.

**Мета:** Дати шлях поповнення каталогу з власних APEX-напрацювань.

**Точки роботи / артефакти:** Maintainer-only capture/normalization workflow; block author guide; fixtures/provenance validation.

**Порядок реалізації:**

1. Використати existing authorized read-only source capture, коли потрібна реальна application source.
2. Вибрати contained declarations/dependencies, замінити application-specific identities на explicit parameters/bindings.
3. Перевірити redistribution rights; raw exports, source credentials та private URLs не пакувати.
4. Створити draft block із unsupported assumptions, contract requirements і original/reviewed recipe refs.
5. Через normal verifier підняти qualification лише після actual checks. Capture не означає import або publication authorization.

**Обов’язкові перевірки:**

- [ ] Hardcoded app ID, auth settings і source-specific secret references виявляються.
- [ ] Same page name із двох sources не collision за block ID.
- [ ] Неповний captured block searchable як draft, але не runtime-ready.

**Критерії завершення:**

- [ ] Maintainer workflow відтворюваний і не потрібен ordinary user runtime.
- [ ] Каталог поповнюється без залежності від доступності source application під час search.
- [ ] Ledger `CMP-035`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P09 — Hardening and measurement

**Результат:** G7: security suite і benchmarks.

<a id="cmp-036"></a>
#### CMP-036 — Trust, provenance і supply-chain hardening

**Залежності:** `CMP-007`, `CMP-010`, `CMP-029`, `CMP-035`. **Scope:** `LOCAL`.

**Мета:** Захистити пакування і використання блоків від tampering та неконтрольованого execution.

**Точки роботи / артефакти:** composer/catalog/provenance.ts; registry policy; package manifest digests; security tests.

**Порядок реалізації:**

1. Перевіряти immutable id/version/content bindings і origin policy для bundled та local reviewed catalogs.
2. Додати deprecated/revoked handling, explicit warning/block rules і offline trust-state limitation.
3. Заборонити package-provided executable hooks, remote refs і dependency downloads у runtime.
4. Задокументувати майбутню external registry signature/publisher model окремо; не реалізовувати слабкий self-signed trusted flag.
5. Перевірити sanitized public provenance, licenses, static assets, SBOM/release metadata за current release process.

**Обов’язкові перевірки:**

- [ ] Same-version tamper, forged evidence, malicious README і untrusted origin.
- [ ] Revoked dependency у новому plan блокується; existing locked artifact не silently upgraded.
- [ ] Installed runtime не вимагає access до maintainer repository або private source.

**Критерії завершення:**

- [ ] Trust не базується лише на package-controlled полях.
- [ ] Integrity та publisher trust чітко розрізняються.
- [ ] Ledger `CMP-036`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-037"></a>
#### CMP-037 — Security/property/fault regression suite

**Залежності:** `CMP-020`, `CMP-022`, `CMP-031`, `CMP-032`, `CMP-033`, `CMP-036`. **Scope:** `LOCAL`.

**Мета:** Перевірити небезпечні межі engine до release candidate.

**Точки роботи / артефакти:** Composer property/fuzz tests; fault injection; CI-negative cases; security evidence.

**Порядок реалізації:**

1. Створити deterministic seeds для malformed inputs, graph cycles, reference collisions і oversize documents.
2. Виконати journal fault matrix: кожний write boundary, two-writer races і unknown pre/postimage.
3. Пройти SQL identifier, auth contract, resource preview, prompt-injection та path traversal cases.
4. Перевірити deployment tamper cases: changed blueprint, adapter, state, package bytes, target/context drift.
5. Зберегти regressions для кожного знайденого дефекту; не вимикати failing cases заради green build.

**Обов’язкові перевірки:**

- [ ] Немає execution поза declared scope.
- [ ] Failure ніколи не пише success receipt або forged passed evidence.
- [ ] Local locks не заявляються як cross-machine coordination guarantee.

**Критерії завершення:**

- [ ] Негативні acceptance cases із розділу 23 мають runnable tests.
- [ ] Critical unresolved security defects блокують release gate.
- [ ] Ledger `CMP-037`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-038"></a>
#### CMP-038 — Benchmarks і agent workflow evaluation

**Залежності:** `CMP-008`, `CMP-010`, `CMP-018`, `CMP-027`, `CMP-030`, `CMP-034`, `CMP-037`. **Scope:** `LOCAL; comparative live/agent runs only when available and authorized`.

**Мета:** Виміряти реальну ефективність порівняно з recipe-copy workflow.

**Точки роботи / артефакти:** Benchmark fixtures/scripts; judged query set; agent eval scenarios; docs metrics/evidence.

**Порядок реалізації:**

1. Визначити fixed hardware/software/corpus/profile для benchmark і відокремити Oracle/network latency.
2. Виміряти cold/warm search, contract reads, pure planning, materialization, token/tool-call budgets і artifact size.
3. Порівняти старий recipe adaptation та Composer на однакових задачах і acceptance criteria.
4. Реєструвати успіхи/невдачі, ручні виправлення, retry count і невиконані cases; не рахувати лише успішні runs.
5. За відсутності live target виконати offline subset, runtime metrics лишити pending. Якщо performance потребує змін, оптимізувати найвужче місце, не вводити vector DB без evidence.

**Обов’язкові перевірки:**

- [ ] Benchmark reproducible і не читає приватні data.
- [ ] No-op ratio визначено на придатних identical-input runs.
- [ ] При відсутніх telemetry token counts значення unknown, не оцінка, видана за вимір.

**Критерії завершення:**

- [ ] G7: є performance baseline і security qualification.
- [ ] Заяви про прискорення підтверджені actual comparison або не робляться.
- [ ] Ledger `CMP-038`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

---

### Фаза P10 — Distribution and acceptance

**Результат:** G8: packaged, documented, qualified release candidate.

<a id="cmp-039"></a>
#### CMP-039 — Bundling і clean-install перевірки

**Залежності:** `CMP-028`, `CMP-029`, `CMP-030`, `CMP-031`, `CMP-036`. **Scope:** `LOCAL`.

**Мета:** Доставити self-contained runtime, а не feature, яка працює лише із source checkout.

**Точки роботи / артефакти:** scripts/build-plugin.mjs та actual packaging adapters; dist resources; packaging/install tests.

**Порядок реалізації:**

1. Додати block manifests, source/contracts, indexes, schemas, blueprint starters і production skill до current build inputs.
2. Перевірити ESM imports, relative resource paths і absence залежності від maintainer scripts.
3. Виключити raw captures, private fixtures/evidence, connection config, dev planning skill і generated temporary files.
4. Протестувати packaged CLI/MCP offline з isolated home, clean project і no source checkout.
5. Не редагувати installed plugin cache вручну і не publish package під виглядом packaging test.

**Обов’язкові перевірки:**

- [ ] Catalog search/read, plan/materialize і skill references доступні з packed artifact.
- [ ] Package source digests збігаються з source registry.
- [ ] No network at MCP startup, no missing imports, no private files.

**Критерії завершення:**

- [ ] Релізний artifact містить усі потрібні runtime resources.
- [ ] Clean-install evidence окрема від Codex host/Oracle/browser evidence.
- [ ] Ledger `CMP-039`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-040"></a>
#### CMP-040 — Cross-platform CI і release gates

**Залежності:** `CMP-022`, `CMP-032`, `CMP-037`, `CMP-038`, `CMP-039`. **Scope:** `LOCAL`.

**Мета:** Зробити regressions видимими до злиття та не витрачати зайві credentials у CI.

**Точки роботи / артефакти:** .github existing workflows; test manifests; controlled live integration job definitions; acceptance artifacts.

**Порядок реалізації:**

1. Додати offline Composer suites до current CI на підтримуваних OS і Node versions, не розширюючи support claims без runs.
2. Перевірити paths, line endings, case collisions, process lifecycle та journal recovery на macOS/Linux/Windows за наявним matrix.
3. Live Oracle jobs зробити окремими protected/explicitly triggered із target-specific secrets і external serialization.
4. Не передавати secrets untrusted PR code; не ослабляти approval ради автоматизації.
5. Агрегувати gates за evidence scope; skipped required job не перетворювати на pass.

**Обов’язкові перевірки:**

- [ ] Offline PR pipeline працює без Oracle credentials.
- [ ] Live job неможливо запустити на довільний target із untrusted input.
- [ ] Artifacts redacted; lost-write outcome лишається blocked.

**Критерії завершення:**

- [ ] Required gates enforced у фактичній CI configuration.
- [ ] Cross-platform support дорівнює перевіреній matrix, не теоретичній переносимості.
- [ ] Ledger `CMP-040`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="cmp-041"></a>
#### CMP-041 — Документація, приймання і release readiness

**Залежності:** `CMP-027`, `CMP-031`, `CMP-032`, `CMP-033`, `CMP-034`, `CMP-035`, `CMP-038`, `CMP-039`, `CMP-040`. **Scope:** `LOCAL`.

**Мета:** Завершити не лише код, а й придатний до використання та підтримки продукт.

**Точки роботи / артефакти:** README EN/UK; docs/composer; docs/acceptance.json; existing status/next-actions; release notes.

**Порядок реалізації:**

1. Оновити user guide, author guide, contract reference, upgrade/removal, recovery, security та limitations двома мовами.
2. Виконати acceptance traceability review: requirement → task → test → actual evidence → supported profile.
3. Пройти fresh user journey: find block → inspect → blueprint → plan → materialize → separately authorized deploy/verify.
4. Позначити incomplete runtime/host/platform qualification точно; визначити experimental/verified release scope без маркетингового завищення.
5. Підготувати release candidate і maintainer handoff. Version bump/tag/npm publication/production rollout виконувати лише за active authorization, не як автоматичний фінал цього документа.

**Обов’язкові перевірки:**

- [ ] Усі public commands у docs існують і відповідають schemas.
- [ ] Немає stale готових claims, fake screenshots або changed historical spec.
- [ ] User can resume/update/detach/recover за документацією.

**Критерії завершення:**

- [ ] G8: implementation, verification і blockers повністю узгоджені.
- [ ] Якщо required live gate не виконаний, release-ready не заявляється; local deliverables все одно збережені.
- [ ] Ledger `CMP-041`, evidence та relevant EN/UK documentation оновлені; наступний task визначений.

<a id="commands"></a>
## 19. Команди перевірки та правила запуску

### 19.1. Безпечний старт у checkout

Нижче наведено inspection commands. Виконувати з кореня перевіреного repository. Вони не замінюють читання applicable instructions і не є дозволом скидати working tree.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
node --version
npm --version
node -p "JSON.stringify(require('./package.json').scripts, null, 2)"
```

Не використовувати `git reset --hard`, `git clean -fd`, примусовий checkout старого commit або автоматичне видалення user's dirty files. Нову branch/worktree створювати за current workflow і без перенесення незакомічених доробок проти волі користувача.

### 19.2. Підтверджені назви scripts

Ці scripts існують у перевіреному `package.json`. Перед запуском звірити їхній актуальний код, prerequisites і scope, оскільки checkout може бути новішим. [R2]

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:contracts
npm run catalog:check
npm run patterns:check
npm run build
npm run test:packaging
npm run docs:check
```

Не запускати весь список механічно після зміни одного речення. Визначати relevant checks для task і comprehensive checks для phase gate. Якщо dependency installation необхідна, використовувати чинний lockfile та repository policy; не виконувати arbitrary package lifecycle scripts без review.

`catalog:verify` і `patterns:verify` пов'язані з реальним offline SQLcl compiler workflow у наявній документації; вони не означають database execution recipes. [R6] [R7] Перевірити доступність toolchain перед запуском і не перетворювати missing compiler на mocked pass.

`test:integration`, installer scripts, plugin synchronization та release-related scripts спочатку прочитати. Назва `dry-run` сама по собі не доводить відсутність зовнішніх effects. Не включати publication, package cache mutation або target writes до звичайного локального baseline без належного scope.

### 19.3. Нові scripts, які потрібно додати за потреби

Назви нижче **пропоновані**, не наявні:

```text
composer:catalog:build
composer:catalog:check
test:composer
test:composer:properties
test:composer:recovery
test:composer:bench
```

Додавати лише scripts, які дійсно потрібні й мають runnable implementation. Якщо current runner уже підтримує потрібний selection, використати його замість шести wrapper-команд. Порожній test suite, що завжди повертає zero, не є реалізацією acceptance gate.

### 19.4. Правила звітування команд

Для кожної виконаної перевірки записати точну command, cwd category, exit code, runner kind, source digest/commit, timestamp та результат. `Not run — missing SQLcl` краще за «тести пройдені» без пояснення, які саме.

Відокремити failed assertion, infrastructure failure, absent capability, policy denial і actual feature defect. Ненульовий exit code не завжди означає дефект Composer; zero exit code не завжди доводить успішний Oracle workflow. Для SQLcl користуватися existing diagnostic classification.

<a id="prompts"></a>
## 20. Готові промпти для Codex

Промпти англійською, щоб відповідати instruction conventions репозиторію. У звітах власнику можна використовувати українську; код, help і production skills залишаються англійськими.

### 20.1. Універсальне виконання однієї задачі

Замінити `CMP-XXX` на потрібний ID.

```text
Read the applicable AGENTS.md files, APEXREST_COMPOSER_IMPLEMENTATION_PLAN.md,
and the current Composer audit, task ledger, implementation status and next actions.

Implement CMP-XXX. Check its dependencies against the actual code and evidence,
not just the ledger label. Reuse existing core, transport, policy and storage seams.
Do not expand this task into a rewrite or implement unrelated backlog items.

First identify the affected contracts and negative tests. Then implement the
smallest complete change, run the relevant available checks, inspect the diff,
and update the ledger, evidence and public EN/UK documentation.
Preserve unowned files, existing permissions and the historical build specification.

Do not claim Oracle, browser, host or packaging verification unless actually run.
When an external capability is unavailable, complete the local work, record the
specific verification blocker and identify an independent next task.

Finish with implementation status, exact checks and results, blockers,
remaining acceptance items and the next dependency-ready task ID.
```

### 20.2. Продовження після завершеної сесії

```text
Resume APEXREST Composer from the repository state.
Read applicable instructions, the implementation plan, task ledger, latest
implementation status and next actions. Inspect git status and the actual changes.
Do not assume the previous conversation is available or accurate.

Reconcile the ledger with code and evidence. Continue the next dependency-ready
local task. Do not repeat completed work or overwrite manual changes.
External verification blockers must stay visible and must not become passes.
No publication or database mutation is authorized by this continuation alone.
```

### 20.3. Промпти за фазами

#### P00 — audit і baseline

```text
Execute CMP-000 through CMP-002. Produce the repository integration map,
relevant baseline evidence, ADRs, threat model and task ledger.
Do not create a second deployment engine, modify the historical build spec,
or begin feature implementation before the baseline is recorded.
```

#### P01 — contracts і state

```text
Execute the dependency-ready tasks CMP-003 through CMP-006 incrementally.
Prioritize strict schemas, safe parsing, canonical hashing, ownership state,
retrievable generation bases and a recoverable journal model.
Use positive and adversarial fixtures. Do not implement an unsafe general evaluator.
```

#### P02 — каталог

```text
Execute CMP-007 through CMP-010. Build the executable-block registry as an
extension of the existing catalogs. Implement bounded offline search,
compatibility/evidence policy and immutable cache behavior.
Keep existing corpus defaults and IDs backward-compatible. No network refreshes.
```

#### P03 — Oracle bindings

```text
Execute CMP-011 through CMP-014. Build a complete local source inventory and
bounded metadata extensions, then typed dataset and command bindings.
Do not infer unique keys, authorization or transaction semantics from names.
Connected reads require the configured target and existing read authorization.
```

#### P04 — planner

```text
Execute CMP-015 through CMP-018. Implement deterministic dependency resolution,
stable symbols, typed interactions and immutable plans with actionable diagnostics.
Planning must not write application source, lockfiles, ownership state or the database.
Blocked plans must never become materializable through a flag.
```

#### P05 — materialization

```text
Execute CMP-019 through CMP-022. Implement bounded APEXlang structural edits,
journaled local materialization, recovery, no-op regeneration and deployment binding.
Test interruption at every write boundary. Preserve unmanaged bytes and Oracle metadata.
Reuse the current deployment safeguards; do not add an importer or control tables.
```

#### P06 — vertical slice

```text
Execute the local implementation in CMP-023 through CMP-027: an isolated CRM fixture,
a list, an API-backed modal editor and a status summary connected by typed events.
Keep fixture DDL/DML and application import authorization separate.
Run live verification only within an explicitly identified authorized scope.
Without that scope, finish local code and tests and mark live qualification blocked.
```

#### P07 — product surfaces

```text
Execute CMP-028 through CMP-031. Add thin CLI and MCP adapters over the same core,
a focused production skill and the Catalog panel with reviewable blueprint edits.
Reuse existing jobs and artifact readers. Add to blueprint must never trigger deploy.
Test behavior parity and distinguish stdio tests from native host observations.
```

#### P08 — maintenance

```text
Execute CMP-032 through CMP-035. Implement structural three-way upgrades,
explicit detach/removal, shared-consumer protection, additional reusable blocks,
two application blueprints and a reviewed local authoring workflow.
Do not delete schema objects or copy unreviewed source application assets.
```

#### P09 — hardening

```text
Execute CMP-036 through CMP-038. Verify package trust and provenance, adversarial
inputs, fault recovery, authorization boundaries, drift rejection and measured performance.
Report actual results including failed and unavailable cases.
Do not introduce a vector service or remote execution to compensate for missing evidence.
```

#### P10 — release candidate

```text
Execute CMP-039 through CMP-041. Verify self-contained packaging, clean installs,
CI gates, bilingual documentation and requirement-to-evidence traceability.
Prepare a release candidate, not a publication. Do not tag, publish, mutate production
or expand permissions without separate active authorization.
Unfinished required runtime checks must remain explicit release blockers.
```

### 20.4. Незалежний code review

```text
Review the current APEXREST Composer changes without editing files first.
Read the plan, applicable instructions, current diff and evidence.

Prioritize correctness and security: determinism, source preservation, stable IDs,
contract directionality, key semantics, server authorization, event lifecycle,
crash recovery, stale-plan rejection, shared resource ownership and deploy boundaries.
Check that mocks, compilation, live Oracle, browser and host evidence are not conflated.

Return concrete findings with file/symbol references, impact and a reproducible test.
Do not approve based on documentation completeness alone. Separate defects from
optional improvements and from unavailable external verification.
```

### 20.5. Перевірка нового блока

```text
Qualify the selected block version for its declared compatibility profile.
Validate the manifest, local references, contracts, source identity, dependencies,
static resources, effects, ownership behavior and fixture test cases.

Run only available authorized checks. Verify the actual combined application,
not only the standalone recipe. Include no-op generation and two-instance collision cases.
Record each evidence dimension independently and keep unrun dimensions visible.
Do not promote the block to runtime-verified from compiler evidence alone.
```

### 20.6. Оновлення блока в application project

```text
Prepare an upgrade plan for the explicitly selected block instance and version.
Read the current blueprint, lockfile, ownership state, generated base and local source.
Compute the dependency/effect impact and a structural three-way merge.

Preserve extensions and unmanaged content. Do not write conflict markers into APEXlang.
Show old/new defaults, contracts, shared resources and required verification.
Materialize only a conflict-free reviewed plan within current local authorization.
Any database deployment still uses the existing exact-target deployment workflow.
```

### 20.7. Live verification із конкретним дозволом

Цей шаблон заповнюється реальними target details і явним дозволом власника. **Незаповнений шаблон не є дозволом.** Reference-only read permissions не розширюються до DDL/DML або application import.

```text
Target: <existing configured dev/test environment and exact application>.
Authorized scope: <explicit read/import/fixture DDL-DML actions>.
Protected or excluded objects: <exact restrictions>.

Within that scope, complete the Composer vertical-slice verification using the
existing validation, plan, apply and browser workflow. Reuse the authorization already
given; do not ask the same permission again or widen it to other effects or targets.
Preserve identity, backups, drift checks, coordination and unknown-outcome safeguards.

Record actual compiler, SQL, import and browser results independently.
If a write outcome is unknown, stop automatic writes and reconcile through the
existing recovery workflow. Do not infer rollback or automatically retry.
```

<a id="agent-files"></a>
## 21. Шаблони AGENTS.md, SKILL.md і звіту сесії

### 21.1. Коротке доповнення до наявного AGENTS.md

Додати лише після audit, не замінюючи чинні розділи. Не копіювати великий план у instruction file.

```markdown
## Composer development

For Composer work, read APEXREST_COMPOSER_IMPLEMENTATION_PLAN.md and the current
Composer audit, task ledger, implementation status and next actions.
Implement one dependency-ready task at a time and record actual verification.
Preserve the existing core, deployment safeguards, source identities and historical spec.
The plan does not authorize publication, production deployment or database mutations.
Keep implementation, verification and blockers separate; update public EN/UK docs.
```

### 21.2. Production SKILL.md

Це початковий шаблон майбутнього `plugins/apexrest-apex/skills/apexrest-compose/SKILL.md`. Додати його лише разом із implemented tools і правильним manifest registration.

```markdown
---
name: apexrest-compose
description: Assemble or update an Oracle APEX application from versioned APEXREST blocks and a blueprint. Use for block selection, bindings, composition planning and local materialization. Do not use for plugin implementation or source-catalog capture.
---

# APEXREST Composer

1. Read the current project configuration, source inventory, compatibility profile
   and applicable authorization. Preserve authentication and unmanaged source.
2. Search the local catalog with bounded queries. Inspect only relevant candidates.
3. Read exact block contracts and dependency requirements. Never infer keys,
   server authorization or write semantics from labels or procedure names.
4. Create or update an explicit blueprint using existing verified bindings.
5. Call the composition planner. Review unresolved contracts, collisions, effects,
   source changes, compatibility and evidence. A blocked plan cannot be applied.
6. Materialize only the exact current plan within local write authorization.
   Do not resolve new versions or call a database importer during materialization.
7. For an authorized application deployment, use the existing APEXREST deploy
   and test workflow with its identity, backup, drift and approval safeguards.
8. Verify the affected behavior with the available selected browser and required
   suites. Record actual observations separately from automated evidence.
9. Report changed artifacts, qualification scope and remaining blockers.

Never start another model session, invent permissions, run package hooks,
replace authentication from a scaffold, or call unrun verification passed.
```

### 21.3. Task ledger example

Це приклад запису, а не твердження, що task уже виконаний. Повний ledger має містити всі 42 IDs із розділу 18. За потреби child tasks зберігаються окремо з `parentTaskId`, не змінюючи root dependency IDs мовчки.

```json
{
  "schemaVersion": 1,
  "project": "APEXREST Composer",
  "tasks": [
    {
      "id": "CMP-003",
      "title": "Strict schemas and contract dialect",
      "status": "pending",
      "implementation": "not-started",
      "dependencies": ["CMP-002"],
      "parentTaskId": null,
      "owner": null,
      "sourceCommit": null,
      "changedFiles": [],
      "checks": [],
      "evidenceRefs": [],
      "blockers": [],
      "nextAction": "Verify CMP-002 and inspect current schema conventions."
    }
  ]
}
```

Task statuses: `pending`, `in-progress`, `blocked`, `done`. Implementation: `not-started`, `partial`, `complete`. Кожна перевірка має власний status: `not-run`, `passed`, `failed`, `blocked`, `stale`, або `not-applicable` з обґрунтуванням. `done` означає виконаний scope конкретного task, а не автоматичну готовність усього продукту.

Результати з іншого commit не перезаписувати. Додавати новий evidence record і позначати applicability попереднього. Shared artifact path повинен мати digest, щоб інший файл із тим самим ім'ям не став «доказом» старого run.

### 21.4. Звіт після сесії

```markdown
# Composer session report

## Scope
- Task IDs:
- Starting commit / ending commit:
- Applicable instructions:
- Authorization used, if any:

## Implementation
- Behavior added or changed:
- Files / symbols:
- Contracts or migrations affected:

## Verification
| Check | Exact command or observed scenario | Result | Evidence | Limitations |
|---|---|---|---|---|

## Safety and compatibility
- Unmanaged source preserved:
- Deployment/authentication behavior changed:
- Source or state migration required:
- Negative cases checked:

## Blockers and next actions
- Implementation blockers:
- Verification blockers:
- Next dependency-ready task:
```

Усі поля заповнювати змістовно. «All tests pass» без переліку команд і scope не підходить. Звіт повинен залишатися коротким; detailed logs — в artifacts, а не дублювання сотень рядків у status document.

<a id="sessions"></a>
## 22. Робота кількома сесіями та паралельні гілки

### 22.1. Стан живе у файлах

До завершення сесії оновити ledger, implementation-status, next-actions і relevant evidence. Не сподіватися, що наступний Codex «згадає», який branch чи target використовувався. У наступній сесії перевірити actual diff перед continuation.

Committed source of truth: desired blueprint, exact lock, owned generation state, code і public docs. Private local truth: operation journals, current locks, live target snapshots і raw artifacts. Не переносити grants або active lock files у Git.

### 22.2. Дозволені паралельні потоки

Після schemas/ADR можуть паралельно виконуватися catalog search та project metadata adapters. Після стабільного core — CLI/MCP wrappers і panel UI. Documentation та tests можуть мати окремого автора, але must use the same contract revision.

Не давати двом сесіям одночасно змінювати schemas, allocator або state semantics без узгодженого interface owner. Не запускати паралельні application imports до одного schema scope. Native Codex collaboration, якщо доступна, — інструмент розробки цього репозиторію, не причина додавати plugin-owned model orchestration. [R5]

### 22.3. Контракт між гілками

Перед паралельною роботою зафіксувати schema revision, exported interfaces, ownership of files і acceptance cases. Кожна branch має незалежний temp/runtime home для tests. Integration branch виконує full relevant contract/golden suites після merge, навіть коли кожна feature branch була зеленою.

Не зливати вручну ledger statuses так, щоб зникло failed evidence. Shared schema conflict вирішувати через новий explicit revision, не створення `any` або lax schemas у transport.

### 22.4. Політика commit і review

Рекомендована одиниця commit — одна завершена task або логічна підчастина з tests. Не вимагати автоматичного commit, якщо користувач працює в review-before-commit режимі. Ніколи не робити automatic push/publish/tag лише тому, що локальна task завершилась.

Перед завершенням перевірити accidental changes у generated resources, lockfile, historical spec, installed cache, credentials і unrelated files. Для source-preserving tasks обов'язково переглянути actual diff, не лише test status.

<a id="acceptance"></a>
## 23. Матриця приймання та Definition of Done

### 23.1. Traceability matrix

Додати ці acceptance IDs до чинного формату `docs/acceptance.json`, не замінюючи існуючі записи. Таблиця визначає вимоги; actual evidence заповнюється під час реалізації.

| Acceptance ID | Вимога | Основні tasks | Необхідний доказ |
|---|---|---|---|
| AC-C01 | Existing CLI/MCP/catalog behavior збережено | 000, 001, 007, 028, 029 | Regression contract suite |
| AC-C02 | Strict safe formats і contained paths | 003, 004, 037 | Positive/negative schema + path tests |
| AC-C03 | Offline search без БД/мережі | 007–010 | Isolated offline execution |
| AC-C04 | Несумісні blocks не проходять resolution | 009, 015 | Exact profile mismatch tests |
| AC-C05 | PK/FK/типи/overloads correctly mapped | 012–014 | Unit + actual scoped metadata reads |
| AC-C06 | Plan deterministic і source-read-only | 005, 018 | Golden + before/after source digests |
| AC-C07 | Stable symbols для двох instances | 011, 016, 024 | Allocation/reference integration tests |
| AC-C08 | Unmanaged bytes та `.apex` preserved | 019, 021 | Byte comparisons + full compiler |
| AC-C09 | Crash-safe materialization | 020, 037 | Write-boundary fault matrix |
| AC-C10 | Second materialize — no-op | 021, 026, 034 | Source/state byte equality |
| AC-C11 | Blueprint/lock drift invalidates deploy | 022 | Stale plan negative tests |
| AC-C12 | Create/edit через API працює | 023, 025, 027 | Actual authorized SQL/browser flow |
| AC-C13 | Authorization і optimistic lock працюють | 014, 023, 025, 027 | Direct negative runtime requests |
| AC-C14 | Saved refreshes list і summary | 017, 026, 027 | Combined application behavior |
| AC-C15 | Read scope не витікає через aggregates | 013, 026, 027 | Multi-scope rows/counts tests |
| AC-C16 | CLI/MCP/core equivalent | 028, 029 | Shared-schema + semantic parity tests |
| AC-C17 | Panel Add не запускає deploy | 031 | UI/API effect assertion |
| AC-C18 | Upgrade зберігає customization | 032 | Three-way fixtures + runtime regression |
| AC-C19 | Removal не руйнує shared/data objects | 033 | Consumers + no-DDL assertions |
| AC-C20 | Capture не публікує private source | 035, 036 | Package content/provenance checks |
| AC-C21 | Package tampering/revocation handled | 036, 037 | Adversarial integrity tests |
| AC-C22 | Clean install працює без checkout | 039 | Packed CLI/MCP offline tests |
| AC-C23 | Supported OS matrix перевірена | 040 | Actual CI runs per platform |
| AC-C24 | Evidence honest і scope-bound | 009, 027, 041 | Evidence schema + manual traceability review |
| AC-C25 | EN/UK документація узгоджена | Усі public-facing tasks | docs:check + review |
| AC-C26 | Existing deployment safeguards unchanged | 022, 027, 037 | Policy/unknown-outcome regression suite |

Діапазон `007–010` означає tasks `CMP-007`…`CMP-010`. Збереження старого behavior оцінюється від зафіксованого baseline, з окремим переліком existing failures.

### 23.2. Критичні негативні сценарії

1. Plan створено, потім вручну додано сторінку з виділеним page ID: materialize відхиляється без writes.
2. Blueprint змінено після deployment plan: apply відхиляється до DB mutation.
3. Процес зупинено після заміни source, але до state update: recovery виявляє точний частковий стан і не записує фальшивий success.
4. Два екземпляри блока мають однаковий title: identities і handlers не перетинаються.
5. View має поле `ID`, але не має підтвердженого key contract: write mode blocked.
6. Procedure називається `SAVE`, але не має reviewed row authorization: runnable write qualification blocked.
7. Користувач підміняє record key або tenant page item: server відхиляє неавторизований доступ.
8. Error/validation/cancel у modal: немає saved event, false success message або partial write.
9. Minor upgrade змінює authorization scope чи default: план явно показує sensitive change.
10. Unmanaged component використовує shared LOV: removal зберігає ресурс або блокується через unknown dependency.
11. Package містить README з вимогою виконати shell command: жодний runtime executor не сприймає це як instruction.
12. Evidence має `passed`, але source digest інший: block не отримує verified qualification.
13. Packaged plugin запущено без source checkout і network: каталог та local Composer workflow працюють або дають конкретну supported-capability помилку.
14. Required runtime suite пропущений: release gate не зелений.
15. Import закінчився `outcome_unknown`: Composer не виконує automatic retry, recovery не стверджує rollback.

### 23.3. Definition of Done для task

Зміна реалізована в правильному шарі; публічні contracts strict; relevant позитивні й негативні tests додані; доступні checks виконані; actual diff переглянутий; документація та ledger оновлені; constraints і blockers не приховані. Немає unrelated rewrite, нового permission bypass чи fake evidence.

### 23.4. Definition of Done для продуктового MVP

Два initial blocks складаються в узгоджений application flow; exact versions і contracts locked; binding та IDs deterministic; existing code збережений; повторний build no-op; interruption recovery перевірена; deployment bind повний; existing auth/backup/drift/approval rules діють; write і refresh scenario реально перевірені на визначеному dev/test profile; CLI/MCP/skill доступні з packed artifact; documented qualification matches evidence.

Catalog UI може бути delivered на product-interface milestone після initial core MVP, але він входить у повний roadmap цього документа. Upgrade/remove/authoring також не пропускати: вони визначають підтримуваність продукту, навіть коли перша генерація вже працює.

### 23.5. Gate summary

| Gate | Що перевіряється | Що дозволено далі |
|---|---|---|
| G0 | Audit, baseline, ADR, ledger | Core implementation |
| G1 | Formats, safe loader, offline registry/search | Binding і planning integration |
| G2 | Deterministic resolved plan | Local writer integration |
| G3 | Safe materialize, no-op, source/deploy binding | Controlled vertical-slice verification |
| G4 | Actual Oracle/browser qualification | Runtime-verified claim лише для перевіреного profile |
| G5 | CLI/MCP/skill/panel parity | User-facing beta workflow |
| G6 | Upgrade/remove/reuse/authoring | Supported maintenance workflow |
| G7 | Security/fault suite і measurement | Release candidate hardening complete |
| G8 | Packaging, CI, docs, traceability | Готовність до separately authorized release |

Незалежна offline робота може продовжуватися без G4. Проте G8 для runtime-verified release не закривається, доки потрібна runtime qualification відсутня.

<a id="metrics"></a>
## 24. Вимірювання ефективності

### 24.1. Визначення метрик

| Метрика | Визначення | Навіщо |
|---|---|---|
| Search relevance@k | Частка judged queries, для яких придатний кандидат є у перших k | Якість discovery, не correctness resolver |
| False-compatible count | Кількість несумісних кандидатів, позначених compatible | Safety; ціль — 0 у regression corpus |
| First-build success rate | Задачі з усіма потрібними acceptance checks без ручного виправлення / усі спроби | Реальна ефективність workflow |
| Manual repair count | Кількість потрібних ручних змін після initial generation | Вартість адаптації |
| Tool calls per accepted task | Фактичні tool invocations до прийнятого результату | Agent overhead |
| Input/output tokens | Реальні доступні usage values на однаковому workflow | Вартість контексту; без telemetry — unknown |
| No-op integrity | Identical-input повтори без source/state diff / усі такі повтори | Відтворюваність; ціль — 100% corpus |
| Upgrade preservation | Cases із збереженою customization або коректним explicit conflict | Підтримуваність |
| Recovery correctness | Injected interruptions, що завершилися known/recoverable state без data loss | Надійність writer |
| p50/p95 local latency | Search/resolve/plan/materialize окремо на pinned fixture | Час engine, без змішування з Oracle/network |

### 24.2. Benchmark datasets

Почати з small/medium/stress fixtures: приблизно 5, 25 і 100 block instances та каталогів різного розміру. Це **тестові розміри, не заявлена підтримувана місткість**. Окремо тестувати довгий dependency chain, широкі shared-resource graphs і великі unmanaged applications.

Для search мати щонайменше 20 вручну judged EN/UK queries із relevant/irrelevant/unsupported cases. Не налаштовувати synonyms тільки під demo «клієнти». Include tasks на tickets, assets, inventory, master-detail і read-only dashboard.

### 24.3. Проєктні performance targets

Початковий орієнтир, який CMP-038 має перевірити на зафіксованій машині: warm search — сотні мілісекунд або менше; local pure planning для medium fixture — одиниці секунд або менше. Це не виміряні результати й не SLA. Зафіксувати конкретні thresholds після baseline й розділити cold startup, file IO, compiler, Oracle і browser time.

Не обіцяти «у 10 разів швидше» до зіставного експерименту. Головні безумовні correctness targets у визначеному corpus: нуль false compatible, нуль silent overwrite, нуль ignored required contract і 100% no-op для identical inputs.

<a id="rollout"></a>
## 25. Пакування, rollout і подальший розвиток

### 25.1. Порядок ввімкнення

Спочатку internal/local experimental core з двома blocks. Потім packaged beta з bounded CLI/MCP і production skill. Далі runtime-verified profile після actual checks, Catalog panel, maintenance workflow та додаткові blueprints.

Feature flag, якщо він потрібен, контролює доступність Composer, а не обходить policy. Existing non-Composer users не повинні бачити нові mandatory files, control tables, extra database grants чи змінений deployment behavior.

### 25.2. Версіювання

Версії Composer schema, block packages, registry revision, generator, APEXREST package і target toolchain — різні осі. Не прирівнювати `block@0.1.0` до версії APEXREST чи APEX. Новий schema major не читається старим runtime без explicit migration.

Визначити release version після audit changes і repository release policy. Цей документ не наказує release `2.0.0` або конкретну дату. Lockfile має дозволяти пояснити, яка саме комбінація створила generation.

### 25.3. Пакетні артефакти

Production artifact включає runtime code, reviewed block payloads, indexes, contracts, supported blueprints, public skill і documentation references. Не включає весь цей internal execution backlog у кожний tool response, private database exports, raw credentials, local grants, CI secrets чи великі evidence logs.

Не пакувати compiler bundle або third-party assets лише тому, що вони доступні на source machine. Використовувати current reviewed toolchain/installer policy і перевірені права розповсюдження. Усі needed local resource paths перевірити з packed artifact без access до source checkout.

### 25.4. Що додавати після стабільної основи

Подальші напрямки: більше composite business blocks, contract-checked grid editing, attachments із окремою storage/security model, audited activity history, conditional workflows, signed organization registry, semantic discovery, profile-specific previews та візуальний blueprint editor.

Для кожного напряму створити окремий task family із threat model та evidence. Не додавати backend effects під виглядом нового UI component. Наприклад, attachments потребують size/type/storage/download authorization, а не тільки File Browse item; workflow потребує state transitions і server policy, а не лише статусного select list.

### 25.5. Відмова від старого experimental feature

Перед видаленням або перейменуванням supported format надати migration path, diagnostic, release note та fixture compatibility tests. Deprecated block залишається discoverable з warning; revoked block має policy-specific block behavior. Не замінювати locked payload іншими bytes мовчки.

<a id="risks"></a>
## 26. Ризики, рішення й відкриті питання

### 26.1. Основні ризики

| Ризик | Як зменшити | Де перевіряється |
|---|---|---|
| Reader не підтримує lossless transformations | Вузький supported subset, span preservation, golden corpus | CMP-011, 019 |
| Актуальна гілка вже має частину Composer | Audit перед створенням файлів; reuse/extend map | CMP-000 |
| Metadata не доводить business semantics | Explicit auth/API/key contracts і actual runtime tests | CMP-013, 014, 027 |
| No-op ламається через timestamps/IDs | Canonical payload і durable allocation | CMP-005, 016, 021 |
| Часткові filesystem writes | Journal, backups, pre/postimage recovery | CMP-020, 037 |
| Upgrade стирає customization | Retrievable base + structural three-way merge | CMP-006, 032 |
| Shared dependencies видаляються передчасно | Consumers graph including unmanaged/unknown | CMP-016, 033 |
| UI/catalog створює false confidence | Independent evidence dimensions, blocked states | CMP-009, 031 |
| План занадто широкий для однієї сесії | Task cards, ledger, limited batches і phase gates | CMP-001 та workflow розділу 22 |
| Немає живого Oracle/browser середовища | Завершувати offline work, не підробляти qualification | CMP-027, 041 |
| Dependency/licensing problem | Reviewed local payloads, provenance і no arbitrary hooks | CMP-035, 036 |
| Plugin працює лише із checkout | Clean-install tests із isolated home | CMP-039 |

### 26.2. Питання, які audit має вирішити без зайвого блокування

**Фактичний parser seam.** Якщо reader достатній для span edits — використати; якщо ні — додати вузький adapter/CST support. Не оголошувати universal parser prerequisite.

**Source of contract schemas.** Обрати чинний strict Zod approach і перевірений шлях editor schema generation. Не вводити новий schema framework без потреби.

**Project state location.** Перевірити real `.gitignore` і existing project scaffolds, після чого зафіксувати tracked/private boundary в ADR.

**Initial compatibility profile.** Взяти exact verified local toolchain і declared target profile; не завантажувати нові releases лише для відповідності прикладу.

**Initial report host.** Обрати recipe із реальним compiler evidence та потрібними row actions. Не називати Interactive Report і Classic Report взаємозамінними без перевірки contracts.

**Required runtime suites.** Зберегти current project policy; додавати лише meaningful tests. Не придумувати порожній suite заради красивого gate.

Ці питання не потребують щоразу зупинятись і просити користувача обрати внутрішній filename. Codex має приймати reversible engineering decisions за кодом і documented defaults. Target identity, production approval або право змінювати бізнес-дані не можна вгадувати — це інший клас рішень.

### 26.3. Уточнення до початкової ідеї

Початкова концепція «каталог + AI-оркестратор» у реалізації означає **AI формує декларативний намір, deterministic Composer збирає source**. Система не потребує агентного runtime усередині плагіна.

«Готовий блок» означає готовий у визначеному contract/profile/evidence scope. «Скласти додаток» означає перевірити не тільки окремі templates, а й їхні dependencies, bindings, identities, events, authorization та maintenance behavior. «Відкотити» не означає універсальний rollback бізнес-даних або Oracle DDL.

### 26.4. Практичне правило завершення

Якщо після виконання roadmap користувач може сказати «додай довідник, під'єднай API, онови показники, збережи мої перевірки», а система формує reproducible reviewable plan, зберігає доробки й чесно доводить runtime behavior, Composer досяг своєї мети.

Якщо ж доводиться знову вручну копіювати recipe, перейменовувати items, здогадуватися про PK і виправляти refresh actions, виконуваний шар ще не завершений, навіть коли каталог виглядає красиво.

<a id="sources"></a>
## 27. Джерела і словник

### 27.1. Як читати посилання

Посилання `[R1]`…`[R13]` підтверджують конкретні facts про перевірену основу або зовнішні платформи. Решта нормативних правил і нові формати цього документа — запропоноване проєктування. При реалізації Codex повинен перевірити поточний checkout і актуальні official docs, а не сприймати dated source як гарантовано найновіший API.

GitHub-посилання прив'язані до опорного commit, щоб audit був відтворюваний. Вони не вимагають checkout саме цього commit. Джерела Oracle наведені для dictionary/transaction facts, не як доказ сумісності всього Composer з Oracle 19c або будь-якою іншою конкретною версією.

| Ref | Джерело | Що використано |
|---|---|---|
| [R1] | GitHub commit `b24a8e3…` | Опорна ревізія та дата |
| [R2] | `package.json` | Версія пакета, Node range, npm scripts і dependencies |
| [R3] | `AGENTS.md` | Мови, historical spec, authorization, browser evidence, clean APEX |
| [R4] | `docs/architecture.md` | Shared core, adapters, jobs, artifacts і safety boundary |
| [R5] | `docs/codex-integration.md` | Codex ownership; відсутність plugin-owned model sessions |
| [R6] | `docs/component-catalog.md` | Catalog hosts, offline references і compiler evidence scope |
| [R7] | `docs/pattern-catalog.md` | Pattern reuse/capture, source provenance та qualification limits |
| [R8] | `packages/core/src/metadata.ts` | Поточні metadata queries, restrictions і pagination |
| [R9] | OpenAI: instructions with AGENTS.md | Розміщення коротких project instructions, окреме читання великого plan |
| [R10] | `docs/deployment-safety.md` | Full import, local history, backup/drift/approval/recovery |
| [R11] | Oracle: `ALL_CONS_COLUMNS` | Constraint column identity та ordered position |
| [R12] | Oracle: `COMMIT` | Межі rollback навколо DDL |
| [R13] | OpenAI: Build skills | SKILL.md та progressive disclosure |

[R1]: https://github.com/apexrest-dev/apexrest-codex/commit/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a
[R2]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/package.json
[R3]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/AGENTS.md
[R4]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/docs/architecture.md
[R5]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/docs/codex-integration.md
[R6]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/docs/component-catalog.md
[R7]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/docs/pattern-catalog.md
[R8]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/packages/core/src/metadata.ts
[R9]: https://developers.openai.com/codex/guides/agents-md
[R10]: https://github.com/apexrest-dev/apexrest-codex/blob/b24a8e3ae54ec4100dbf499c084069c6ff4e9d2a/docs/deployment-safety.md
[R11]: https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_CONS_COLUMNS.html
[R12]: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/COMMIT.html
[R13]: https://developers.openai.com/codex/skills

### 27.2. Словник

| Термін | Значення в цьому плані |
|---|---|
| Block | Versioned функціональний модуль із contracts, source, effects і evidence |
| Blueprint | Бажана структура application та explicit bindings/connections |
| Binding | Перевірена відповідність generic port реальним data/API/auth contracts |
| Capability | Семантична можливість, яку потребує блок, наприклад optimistic lock |
| Compatibility profile | Exact перевірена комбінація platform/toolchain/features |
| Deterministic | Однакові semantic inputs дають однаковий результат |
| Materialization | Застосування composition plan лише до local project files |
| Ownership | Межа source, якою Composer має право керувати |
| Generated base | Попередня відтворювана версія source для three-way merge |
| Evidence | Запис реально виконаної перевірки з exact scope та provenance |
| Drift | Зміна inputs, source, target або state відносно reviewed plan |
| Outcome unknown | Результат write не встановлений; не success і не гарантований rollback |
| Qualification | Достатність окремих evidence dimensions для конкретного support claim |
| Gate | Явний критерій переходу milestone/release, не просто завершений checklist |

---

## Фінальна інструкція для Codex

**Не переписуй цей документ замість реалізації. Почни з CMP-000, звірся з реальним кодом, потім виконуй dependency-ready tasks із тестами та evidence. Будуй один детермінований Composer поверх існуючого APEXREST. Зберігай ручні доробки, права доступу і чинний deployment pipeline.**
