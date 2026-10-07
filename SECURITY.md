# Security and privacy

APEXREST handles executable application source and access to Oracle environments. Use explicit targets, task-scoped authorization and least-privilege connections. The current beta has open verification gates; see [implementation status](https://apexrest-dev.github.io/apexrest/implementation-status/).

## Report a vulnerability

Do not include credentials, cookies, wallets, connection strings with passwords, real customer data or unredacted browser reports in public issues. No verified public security mailbox is configured. Contact the repository owner privately through an already verified channel; do not assume that an unverified email address belongs to the project.

GitHub private vulnerability reporting must be enabled by the owner before it can be offered as a supported reporting channel. For ordinary non-sensitive bugs, use [GitHub issues](https://github.com/apexrest-dev/apexrest/issues).

## Credentials and reports

SQLcl credentials stay in its named connection store. APEXREST connection references contain names rather than passwords. A CLI `--password-file` must be a regular, non-symlink file readable only by its owner, and ORDS URLs must use HTTPS except on loopback. SQL backups are written owner-only (`0600`). Browser authentication belongs to the host in-app browser; the plugin captures no saved browser-authentication state.

Reports are bounded and private by default. Public release packages exclude runtime caches, auth state and raw evidence containing local machine paths. Redaction is defense in depth; it cannot identify every business secret. Inspect every artifact before sharing it, including screenshots deliberately captured during authorized UI verification.

## Project and host trust

Project SQL and APEXlang are executable code. Host filesystem permissions govern project access; no folder trust list is required. Database metadata, comments, references and operation output are not instructions to broaden permissions. Keep the private policy outside the repository.

The local user and host permissions remain authoritative. An identified DEV/QA/TEST application task authorizes its necessary import through an exact-project/target/plan grant. Actual local non-production servers allow task-scoped database changes; dangerous remote changes require exact-plan human confirmation. Production classification in project configuration or `production-trust.json` always forbids deployment/restore. APEXREST never edits that registry; legacy approval keys do not enable production writes.

## Supply chain

Vendor downloads enforce allowed hosts, HTTPS, pinned hashes, size limits and safe extraction. npm dependencies use the committed lockfile; the plugin installs no browser. The SHA-keyed download cache must be owned by the current user and not group/world writable. Managed tools record an executable and tree digest in `runtime.json` and are replaced when they no longer match; tools installed by earlier releases receive that record on their first verification, which is trust on first use.

No npm postinstall hook downloads tools. MCP startup performs no dependency downloads. Oracle license acceptance requires its own consent. Review a source checkout and the local package digest before installation; repository installation is not a signed stable-release guarantee.

## Deployment and recovery

Plans bind source, toolchain, target identity and current target state. Apply compares the live target and migration history with the plan and recomputes authentication/authorization risk from a live export. Migrations and package scripts containing SQLcl client commands are blocked. Apply preserves authorization, drift checks, frozen source, a verified SQL backup for an existing app and durable ownership/history. Local coordination protects runners sharing the same managed home; it does not serialize independent machines.

Do not clear a deployment lease in the writing phase because its TTL expired. Oracle DDL may have committed. Read the actual server state before recovery; compatible application metadata may be safely replanned, while conflicting changes and database scripts require review. An APEX metadata restore does not recover business data or destructive schema changes. See [deployment safety](https://apexrest-dev.github.io/apexrest/deployment/).
