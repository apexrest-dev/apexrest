# Upgrade, removal та recovery

[English](maintenance.md) | Українська

Змініть точну версію блока або погоджені parameters у blueprint, потім створіть новий plan. Стабільні instance identities зберігають allocations. Three-way merge порівнює retained generated base B, actual local L і new generated N. Незалежні підтримувані declaration/property changes об’єднуються; overlap, unknown anchors, missing base та edited deletion targets блокуються diagnostics без conflict markers у source. Unmanaged children зберігають точні bytes і розташування.

Extension hooks beforeSaveValidation і afterSaveNotification потребують extended ownership та зберігають caller-owned transactions. Detach зберігає source і блокує automatic reattachment. Removal видаляє лише підтверджені незмінені owned artifacts. Remaining/unmanaged page references блокують cleanup, зокрема page alias, посилання `f?p` і `p_page` та динамічно побудовані page links (`UNKNOWN_CONSUMER_RETAINED`); namespace collision checks охоплюють кожне ім’я, derived із block namespace, без урахування регістру (`SYMBOL_COLLISION`); tables/packages не видаляються, business-data rollback не заявляється. Ця бібліотека не генерує shared LOVs; heuristic garbage collection unmanaged resources відсутній.

Materialization фіксує reviewed plan і використовує спільний local project lock та durable preimage/postimage journal. Кожен write перевіряє drift; state/lock записуються після source writes. Перервані plans потребують явного resume або restore plan; unknown concurrent bytes блокують recovery. Recovery потребує immutable frozen plan record і відхиляє writes поза Composer ownership (`JOURNAL_CORRUPT`, `COMPOSITION_SCOPE_DENIED`). No-op apply відновлює відсутній або stale private receipt. Restore відновлює лише local metadata/source. Старі bases і completed journals залишаються доступними.

Deployment v3 прив’язує generation/blueprint/state/lock/catalog receipt. v1/v2 залишаються читабельними, але не обходять Composer binding для managed generation. Обидва deployment modes зберігають чинні backup, target identity, approval, drift, required-suite та unknown-outcome safeguards.
