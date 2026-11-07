# APEX release/source upgrade

Use this only when the task is an APEX release/source upgrade.

1. Read `oracle:26.2:guide/upgrade-audit` with `version:26.2` before editing.
2. Confirm the target release and toolchain. Protect both local source and server changes before a full import and re-export.
3. Obtain the new source structure and `.apex/apexlang.json` from that authorized DEV/QA/TEST import and re-export; never change the MMD version by hand.
4. Reconcile the fresh export in disposable staging, including removed files and project-owned files, before adopting it as the working-copy baseline.
5. Keep the structural refresh separate from feature changes.

A reference or skill refresh alone does not authorize an application upgrade. An explicitly requested application upgrade uses the authorization rules in [work](../SKILL.md).
