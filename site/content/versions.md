# Supported versions and verification

| Component | Current source support |
| --- | --- |
| Node.js | 24–26; Node 24 LTS recommended |
| Java | 21, matching the selected SQLcl profile |
| Oracle APEX | 26.1 full imports; 26.2 full/eligible partial imports |
| SQLcl | Pinned 26.1 and 26.2 profiles in `toolchains/` |
| Partial imports | APEX 26.2, SQLcl `26.3.0.260.1620`, MMD `26.2.0+3479`, direct SQLcl CLI |
| Hosts | Codex desktop/CLI and Claude Code plugin manifests |
| Operating systems | macOS, Linux and Windows installer paths; WSL2 is a separate environment |

The host owns model execution, context and permissions. APEXREST provides deterministic references, validation, planning, imports, browser handoff, jobs and status. It does not provision a database or manage an Oracle sandbox.

## Verification scope

Local unit, contract, installer and package checks establish source/fixture behavior. Fresh native host discovery, connected Oracle imports and authenticated application/browser checks require their own authorized runs on each target/platform. Production approval is unsupported on Windows.

Read [implementation status](../../docs/implementation-status.md), [testing](../../docs/testing.md) and [next actions](../../docs/next-actions.md). Exact vendor artifacts and hashes are pinned in the packaged toolchain locks. New SQLcl builds and transport modes require qualification before extending support claims.
