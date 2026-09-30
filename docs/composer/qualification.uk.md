# Evidence та release gates

[English](qualification.md) | Українська

Ledger відстежує всі CMP-000–041, але локальну реалізацію ще не завершено. [Аудит](audit.uk.md) перелічує залишок локальних вимог окремо від відкладеного live acceptance. Baseline HEAD і snapshots наявного dirty work приватні; historical build specification незмінна.

Local report містить actual checks, справжні SQLcl offline compiler outputs, fixtures, source digests, package integrity, relocated CLI/MCP/panel parity та installation evidence. Schema/unit/compiler/source/import/browser/authorization/upgrade/packaging evidence є окремими dimensions. Compiler output не є PL/SQL compilation у live Oracle schema, import, успішним DML або role/browser acceptance. Нові блоки залишаються experimental/local-verified.

G4 потребує окремо дозволених exact DEV metadata, fixture DDL/DML, application-only import та authenticated browser qualification, зокрема null/invalid input, create/edit/cancel, stale version, denied roles, two instances, refresh/coalescing і narrow screens. Жодна перевірка не стає тихим pass. Linux/Windows CI та fresh-chat native tool discovery фіксуються окремо від macOS local checks і installed payload verification.

Benchmarks показують local wall time, payload bytes, deterministic cache behavior та judged EN/UK retrieval. Вони не вимірюють native agent reasoning, paid tokens або billing. Publication/tagging/production rollout потребують нового явного запиту. Protected release-readiness checker включає Composer runtime/native evidence і залишається blocked за відсутності required evidence.
