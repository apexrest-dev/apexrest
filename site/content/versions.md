# Supported versions and evidence

The source bundle is version {{version}}; this APEX 26.2 update has not been published. Published npm `1.3.0` includes the redesigned 11-tool/5-skill surface but not these partial-import changes; installing that version does not select the current working-tree implementation. [Release notes](../../docs/release-notes.md) distinguish source updates from published npm dist-tags. The older `1.3.0-beta.1` retains 21 MCP tools and 14 skills.

## APEX release profiles

| Profile | Reviewed compiler and source metadata | Import support |
| --- | --- | --- |
| APEX 26.1 | SQLcl `26.1.2.132.1334`, MMD `26.1.0+3102` | Existing full-application workflow; managed install default. |
| APEX 26.2 | SQLcl `26.3.0.260.1620`, MMD `26.2.0+3479` | Full imports and qualified partial imports for existing dev/test apps over direct SQLcl CLI. |

Node 24 LTS is the baseline (supported range 24–26). Oracle operations need the matching Java/SQLcl toolchain; the managed Java baseline is 21. ORDS APEXlang operations require a JDK 21+ containing `jdk.compiler`; the managed JRE alone is insufficient for the Java bridge. Playwright is pinned at 1.63.0 with its matching browser revisions. Use the [26.2 partial-import guide](../../docs/apex-26.2.md) for exact prerequisites and mode selection; the capability gate does not accept arbitrary future compiler/MMD versions.

APEXREST works directly in the existing Codex or Claude Code session; the host controls its model, context and permissions. Validation, planning, references, metadata and sync run inside the MCP server on a pooled SQLcl engine; `ship` apply and remote test suites run in a detached worker and wait within one call (up to 120 seconds) before returning a job ID. UTF-8 bytes are payload measurements, not billed tokens. The offline catalogs contain 109 component families with 138 compiler-checked recipes, plus 58 UX patterns with 84 recipes (69 compiler-checked and 15 explicit gaps). Pattern source review covers 150 pages and 818 variant decisions. See [component evidence](../../docs/evidence/component-catalog-local.json) and [pattern evidence](../../docs/evidence/pattern-catalog-local.json); the [historical 1.0.0 record](../../docs/evidence/current-session-100-local.json) retains its original scope.

- macOS arm64: local native Codex host, client setup, compiler checks and the redesign's local test suites completed; Claude Code manifests validated with `claude plugin validate --strict`.
- Linux x64: locked client artifacts and installer code; hosted quality gates are configured, while native client and Oracle integration remain unverified.
- Windows x64: locked client artifacts and PowerShell bootstrap; hosted quality gates are configured, while native client and Oracle integration remain unverified. Production approval is not supported on Windows.
- WSL2: separate environment; no inherited Windows verification claim.
- Codex compatibility profile: exercised on 0.154.0 for earlier builds; the redesigned surface has not been re-verified in a live host session.
- Claude Code: manifest validation and a local scratch-marketplace install only; no end-to-end session recorded.
- APEXREST-managed sandbox lifecycle: unsupported. The isolated local instance used for 26.2 qualification was independently provisioned.

## Connected partial-import evidence

[APEX 26.2 qualification](../../docs/evidence/apex262-connected.json) records direct SQLcl full, page-only and automatic page-plus-LOV imports on macOS arm64, APEX 26.2.0 and Oracle Database 23.26.3.0.0. The final import preserved 21 unselected files and an independently edited remote page; the page and shared LOV were verified in the Codex in-app browser. This application-only fixture did not run automated SQL/E2E suites.

Existing [ORDS evidence](../../docs/evidence/ords-connected.json) separately confirms one unchanged application round trip on an earlier build. Its browser verification was deferred, and it does not establish ORDS partial imports. SQL restore, real interrupted-write recovery, additional component combinations and other platforms retain their own open checks. Evidence keeps its recorded build versions and source digests.

Compatibility describes observed behavior, not full APEX component coverage. Exact vendor hashes are in the packaged toolchain lock. Future SQLcl library versions require a separate ORDS bridge compatibility check.
