# ADR 006: migration-ownership

Status: accepted for local beta; integration claims require evidence.

Amended by [ADR 007](007-clean-apex-deployment.md): service tables are not prerequisites; local durable migration history is the default. Superseded in part (2026-10-04): the administrator-installed control tables were removed entirely; migration history is local only. The immutability, started-before-execution and no-blind-retry rules below remain in force.

The target administrator explicitly installs APEXREST control tables. Migration filename and checksum are immutable; started/unresolved records block retries. Full SQLcl scripts run in order without splitting PL/SQL or claiming DDL rollback. Application restore does not restore schema data.
