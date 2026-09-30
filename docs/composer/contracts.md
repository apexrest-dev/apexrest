# Contracts and adapters

English | [Українська](contracts.uk.md)

Blueprint and package schemas are strict Zod v1 models; generated JSON Schema is bundled. YAML 2.9.1 is pinned. Parsing uses YAML 1.2 AST with duplicate-key, alias, explicit-tag, prototype-key, multi-document, size and depth rejection. Mapping order does not change semantic digests.

Entities declare object, projected scalar fields, ordered key and reviewed row-read authorization. Views require an explicit ordered key contract. Connected reads use only the configured parsing schema and expose field facets, ordered PK/FK columns and exact procedure signatures. Compound keys remain in the model; the write and detail adapters require one scalar key. The master-detail adapter supports a same-entity parent field whose type matches the key.

Writes require explicit create/edit flags, editable fields, a non-null integer version, exact PL/SQL IN/OUT mappings, write authorization, errors and caller-owned transaction semantics. Key/version cannot be editable. Text/numeric keys and scalar text/number/date/timestamp fields are supported; boolean writes and arbitrary object/collection types block. Null/empty-string follow Oracle semantics; numeric values cross the browser as strings, dates use YYYY-MM-DD and timestamps use a fixed representation. The bound API must independently enforce row authorization and the expected version.

A successful save returns authoritative key/version before dialog close. The saved payload contains entityRef, recordKey, recordVersion, operation, originInstance and correlationId. Receivers validate the origin/entity and coalesce correlation IDs. Cancel invokes no API. The renderer uses native IR, modal forms, Cards and read views; it does not infer security from controls.
