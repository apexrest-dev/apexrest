---
name: apexrest-oracle-sync
description: Maintain the APEXREST source library by checking and synchronizing the complete official Oracle APEXlang inventory. Use for upstream library maintenance, not ordinary application authoring.
---

# Official Oracle inventory synchronization

Work in the APEXREST source checkout with canonical origin `https://github.com/apexrest-dev/apexrest`; these maintainer helpers live in its `scripts/` directory. An application project or installed runtime is not that checkout.

Inspect the current `toolchains/sources.lock.json` and `resources/references/26.2/oracle-snapshot.json`. Run `node scripts/check-oracle-apexlang-upstream.mjs`; its ignored `docs/evidence/oracle-upstream/upstream.json` records the exact candidate revision, downloaded archive SHA-256 and additions/removals/content changes. Inspect `inventoryStatus`, `bundledSourceChanges`, `licenseChanged` and `releaseDiscovery` separately. A new release directory requires review even when 26.2 bytes are unchanged; the helper never auto-creates a profile or declares the whole library current. A newer commit alone is not a content update. The helper supports `--archive ZIP --commit SHA --out DIRECTORY` for offline comparison.

For authorized 26.2 synchronization, use the verified archive and candidate fields:

```sh
node scripts/build-apexlang-references-26.2.mjs ARCHIVE.zip --commit COMMIT --archive-sha256 SHA256
node scripts/build-apexlang-references-26.2.mjs ARCHIVE.zip --check
npm run build
node scripts/sync-repository-plugin.mjs
node scripts/verify-oracle-apexlang-coverage.mjs --archive ARCHIVE.zip
```

`--check` compares without writing. Review content changes, source MMD and licensing; retain complete Oracle contracts. The search summary is not a contract; full definitions are checksum-verified, lazy-loaded and paginated. Do not restore the former property-group allowlist or copy upstream deploy scripts into the plugin.

Use `corpus:components`, `version:26.2` for contracts. Keep local UX recipes and patterns explicitly bound to their independently verified version. Preserve 26.1 routing; an upstream source refresh does not upgrade target applications or qualify another MMD/compiler.

Run retrieval, contract, packaging and documentation checks. Coverage checks archive/index/search digests, everyday component/property discovery and all paginated documents. Corrupt/missing accelerators rebuild from verified full definitions; keep genuinely unrelated searches empty. Update current implementation/acceptance/next-actions documentation from those results. Distinguish inventory documents, declaration keywords, document/group/property occurrences and compiler MMD bindings; none equals all APEX platform features or runtime qualification.

Publication, global installation, deployments and scheduling require separate requests.
