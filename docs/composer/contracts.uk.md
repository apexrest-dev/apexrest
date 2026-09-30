# Contracts та adapters

[English](contracts.md) | Українська

Blueprint і package schemas — strict Zod v1 models; generated JSON Schema входить у bundle. YAML 2.9.1 зафіксовано. Parsing використовує YAML 1.2 AST із відхиленням duplicate keys, aliases, explicit tags, prototype keys, multiple documents, перевищення size і depth. Порядок mappings не змінює semantic digests.

Entities визначають object, projected scalar fields, ordered key та погоджену row-read authorization. Views потребують явного ordered key contract. Connected reads використовують тільки налаштовану parsing schema і повертають field facets, впорядковані PK/FK columns та точні procedure signatures. Compound keys залишаються в моделі; write і detail adapters потребують одного scalar key. Master-detail adapter підтримує parent field тієї самої entity з типом, сумісним із key.

Writes потребують явних create/edit flags, editable fields, non-null integer version, точних PL/SQL IN/OUT mappings, write authorization, errors і caller-owned transaction semantics. Key/version не можуть бути editable. Підтримуються text/numeric keys і scalar text/number/date/timestamp fields; boolean writes та довільні object/collection types блокуються. Null/empty-string відповідають Oracle semantics; numeric values передаються в browser як strings, dates використовують YYYY-MM-DD, timestamps — фіксоване представлення. Bound API окремо забезпечує row authorization та expected version.

Успішний save повертає authoritative key/version перед закриттям dialog. Saved payload містить entityRef, recordKey, recordVersion, operation, originInstance і correlationId. Receivers перевіряють origin/entity та coalesce correlation IDs. Cancel не викликає API. Renderer використовує native IR, modal forms, Cards і read views; він не визначає security за видимістю controls.
