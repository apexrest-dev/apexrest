# Авторство для maintainer

[English](authoring.md) | Українська

Зберігайте exact packages у blocks/packages/<family>/<name>/<version>; manifests і declarative renderer source є immutable. Поточний runtime підтримує скінченний набір погоджених native factories, а не довільні package scripts. Чинні component recipe IDs перевіряються під час registry generation. Package hooks, remote references та implicit downloads заборонені.

Використовуйте npm run composer:author з contained source package, новим output, явною license та необов’язковими новими ID/version. Необов’язковий --page захоплює local declaration facts/hashes, виключаючи page IDs/security settings із generated behavior. Raw exports та private URLs/credentials відхиляються або залишаються поза bundle. Capture створює draft, а не runtime equivalence. Перевірте права на redistribution і нормалізуйте application-specific assumptions у blueprint parameters/contracts; custom factories потребують reviewed core change.

Project-local blocks перед planning потребують окремої tracked registry-policy reviewedPackages mapping від exact selector до content digest. --review записує цей явний local review; він не створює Oracle/browser evidence. Searchable drafts залишаються unqualified. Content-addressed cache виявляє corruption; evidence і revocation state зберігаються поза immutable source packages. Composer:catalog перебудовує registry, composer:check перевіряє integrity, composer:verify виконує справжню offline compilation повного fixture.
