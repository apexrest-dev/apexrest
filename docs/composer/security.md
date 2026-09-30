# Trust and boundaries

English | [Українська](security.uk.md)

Project trust is required for local writes. A package-controlled verified flag is not runtime evidence. Bundled origin is checked against registry policy; local packages need an independently pinned project review. Integrity identifies exact bytes, not publisher legitimacy. Future remote registries need a reviewed publisher/signature model; no self-signed trusted flag exists.

Paths reject traversal, symlinks and special files. Strict AST/schema validation precedes binding. Catalog data and source previews remain untrusted text. Runtime has no network downloads or package hooks. Revoked dependencies block new plans and invalidate stale reviewed plans. Generator source identity is included in the catalog binding; compiler evidence becomes stale after source/generator changes.

Plans cannot overwrite application .apex, project configuration, database source or unrelated existing JSON. Materializer checks complete source inventory, every preimage/postimage and private receipt. Shared local coordination serializes cooperating Composer/deployment writers; it is not cross-machine coordination or an OS-level compare-and-swap against arbitrary external editors. Unknown concurrent changes require explicit reconciliation.

Materialization has no database effects. A separately authorized deployment uses the existing external policy boundary. Fixture SQL is never executed by planning, catalog search, panel or materialization. Protected live CI runs only from the trusted main ref/environment; offline PR checks have no Oracle credentials.
