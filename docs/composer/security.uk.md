# Довіра та межі

[English](security.md) | Українська

Project trust потрібен для local writes. Package-controlled verified flag не є runtime evidence. Bundled origin перевіряється registry policy; local packages потребують незалежного pinned project review. Integrity визначає exact bytes, а не легітимність publisher. Майбутнім remote registries потрібна погоджена publisher/signature model; self-signed trusted flag відсутній.

Paths відхиляють traversal, symlinks і special files. Strict AST/schema validation передує binding. Catalog data і source previews залишаються untrusted text. Runtime не має network downloads або package hooks. Revoked dependencies блокують new plans і роблять reviewed plans stale. Generator source identity входить у catalog binding; compiler evidence стає stale після source/generator changes.

Plans не можуть перезаписувати application .apex, project configuration, database source або сторонній existing JSON. Materializer перевіряє повний source inventory, кожен preimage/postimage та private receipt. Shared local coordination серіалізує сумісних Composer/deployment writers; це не cross-machine coordination і не OS-level compare-and-swap із довільними external editors. Unknown concurrent changes потребують явної reconciliation.

Materialization не має database effects. Окремо дозволений deployment використовує чинну external policy boundary. Fixture SQL ніколи не виконується planning, catalog search, panel або materialization. Protected live CI працює лише з trusted main ref/environment; offline PR checks не отримують Oracle credentials.
