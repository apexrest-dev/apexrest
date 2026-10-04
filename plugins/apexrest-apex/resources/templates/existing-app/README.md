# Adopt an existing application

Create an `existing-app` project skeleton, configure the exact existing test target and named read connection, then run `project adopt --env dev --app-id ID`. It exports through a private staging directory and installs only into a new source directory. If that directory exists, adoption fails with LOCAL_EDITS_CONFLICT; local edits are preserved. For later exports use a fresh `apex export --env dev --output review/export-UUID` directory.

Keep `.apex`, Oracle IDs, shared LOVs, authentication and all page files under version control. `apex diff --env dev` compares source file hashes with a fresh Oracle export. It is a textual inventory, not proof of complete semantic component coverage. SQLcl exports use original IDs and omit export timestamps; no invented normalization removes metadata.

A release integration run must export before and after a no-op full import and compare every file/component, then change one page and verify that another page and a shared LOV remain functional. The current local run has no authorized database and cannot attest those scenarios. Unsupported components must fail validation/export with a useful diagnostic; never silently drop them or hand-edit internal APEX tables.
