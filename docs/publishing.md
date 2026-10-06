# Publishing policy

[apexrest-dev/apexrest](https://github.com/apexrest-dev/apexrest) is the canonical source repository. Git commits, registry packages, signed release artifacts and a deployed website are separate distribution outcomes.

Repository deployment is disabled: the release and trusted Oracle/native integration workflows are disabled in GitHub, and their jobs use `if: ${{ false }}`. Publisher configuration keeps `enabled` and `npmEnabled` false. CI runs automatically only on pushes to `main`. Publication requires a separately authorized configuration change.

An authorized release requires current evidence bound to its exact immutable source, archive integrity, protected target/approval settings and an externally managed signing key where required. Missing, blocked or stale evidence fails readiness. Registry publication also requires verified package ownership and clean-install checks; it does not establish Oracle or native-host qualification.

Site output is generated locally by `npm run site:build`. A separately authorized site copy may target only `site-dist/` beneath the existing `/codex/` path with `scripts/publish-site.sh --dry-run DEST`; applying it requires explicit `--apply` and a mounted authorized destination. Do not alter the root homepage, DNS or TLS without their own authorization.

See [release notes](release-notes.md), [testing](testing.md) and [next actions](next-actions.md).
