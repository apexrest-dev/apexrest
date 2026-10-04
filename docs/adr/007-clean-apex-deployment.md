# ADR 007: clean APEX deployment

Status: accepted user amendment, 2026-09-12. Supersedes the mandatory DB-control-table portions of ADR 005/006 and the preserved original build specification.

Superseded in part, 2026-10-04: the optional database backend described below was removed. Local coordination is the only backend; the local safeguards and the cross-machine limitation stay as written. Statements about an opt-in database backend are historical.

A clean supported APEX installation is a valid deployment target. No APEXREST service tables, framework installation or setup DDL are prerequisites for ordinary application plan/apply. Local durable migration history and schema-scoped ownership are the default. Both plan and apply select the same backend; plans bind the store identity to prevent accidental movement to an empty history on another runner.

Local control uses atomic private files in the managed home, immutable migration checksums, started-before-execution records, and retained writing ownership after unknown outcomes. It serializes apps sharing a schema within one managed home. It does not coordinate unrelated machines/homes. Cross-machine use requires a durable serialized CI runner/history or the explicit optional database backend. Never claim local coordination satisfies the entire distributed-runner acceptance criterion.

The database backend remains opt-in and has no silent downgrade when its tables or grants are absent. Silent fallback could reinterpret prior migrations as unapplied. Neither backend weakens target identity, backups, approval, drift detection, required tests or reconciliation. utPLSQL is a SQL-test dependency only. Preserve the original specification unchanged and record evidence boundaries in the acceptance matrix.
