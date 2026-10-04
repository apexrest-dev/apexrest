# Supported versions and evidence

English | [Українська](versions.uk.md)

Release {{version}} is packaged as `apexrest@{{version}}` and available through the source repository. `npm install -g apexrest` installs the stable npm `latest` release; pin `apexrest@{{version}}` to install this exact version. [Release notes](../../docs/release-notes.md) record distribution status and npm dist-tags. Native-platform and Oracle integration qualification retains its documented limits.

The supported toolchain targets Node 24 LTS (supported range: Node 24–26), SQLcl 26.1.2.132.1334, Java 21 and APEX 26.1+. ORDS APEXlang operations require a JDK 21+ containing `jdk.compiler`; SQLcl's managed JRE alone is insufficient for the Java bridge. Local generated MMD: 26.1.0+3102. Playwright is pinned at 1.63.0 with its matching browser revisions.

APEXREST works directly in the existing Codex session. Beta 1.3.0-beta.1 provides 21 MCP tools and 14 skills, including experimental Composer and working copies; stable 1.2.0 provides 18 MCP tools and 13 skills. The host controls its model, context and permissions. Six long tools wait within one call; metadata batches, summary inspection, cached references and bounded output reduce routine exchanges while preserving diagnostics, recovery and deployment safety. SQLcl and ORDS operations remain available. UTF-8 bytes are payload measurements, not billed tokens. The offline catalogs contain 109 component families with 138 compiler-checked recipes, plus 58 UX patterns with 84 recipes (69 compiler-checked and 15 explicit gaps). Pattern source review covers 150 pages and 818 variant decisions. See [component evidence](../../docs/evidence/component-catalog-local.json) and [pattern evidence](../../docs/evidence/pattern-catalog-local.json); the [historical 1.0.0 record](../../docs/evidence/current-session-100-local.json) retains its original scope.

- macOS arm64: local native host, client setup and compiler checks completed.
- Linux x64: locked client artifacts and installer code; hosted quality gates are configured, while native client and Oracle integration remain unverified.
- Windows x64: locked client artifacts and PowerShell bootstrap; hosted quality gates are configured, while native client and Oracle integration remain unverified.
- WSL2: separate environment; no inherited Windows verification claim.
- Codex compatibility profile: exercised on 0.154.0.
- Product scope: Codex desktop and CLI only; the former portable profile is discontinued and is not built.
- Sandbox: unsupported until a complete licensed Oracle/APEX/ORDS tuple is provisioned and verified.

Existing [ORDS evidence](../../docs/evidence/ords-connected.json) confirms one unchanged application round trip, 21 byte-identical files, a checksum-verified SQL backup and a matching installed-plugin MCP export. SQL restore, changed imports, additional component/static-file/MMD variants, interrupted-response recovery and Windows remain unverified; application browser verification was deferred. Evidence retains its recorded build versions and source digests and does not become a new connected check when this version changes.

Compatibility describes observed behavior, not full APEX component coverage. Exact vendor hashes are in the packaged toolchain lock. Future SQLcl library versions require a separate ORDS bridge compatibility check.
