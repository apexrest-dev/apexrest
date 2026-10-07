# Publishing policy

[apexrest-dev/apexrest](https://github.com/apexrest-dev/apexrest) is the canonical source repository. Git commits, registry packages, signed release artifacts and a deployed website are separate distribution outcomes.

The authorized 2.0.0 npm publication requires both publisher opt-ins, `enabled` and `npmEnabled`. Its explicit `npmReadiness` exception is bound to version `2.0.0`: the three current local reports (`composer-local.json`, `local-checks.json`, `oracle-local.json`) block npm when missing, failed or stale. The six external Composer runtime/new-chat, native macOS/Linux/Windows and connected Oracle reports are advisory for this npm version. Their actual missing, blocked and stale states remain visible; they still block full qualification. A different package version does not inherit this exception.

Run `npm run check-release-readiness -- --npm` for npm eligibility. The default `npm run check-release-readiness` continues to require all nine reports for full qualification and signed release packaging. Both commands report `npmReady`, `stableReady`, qualification status and each report's required scope. npm eligibility does not establish full Oracle/native qualification.

These settings run no publication command. Keep local checks, successful CI on the final source, package inventory/integrity, verified registry ownership and fresh registry installation with CLI/MCP/reference checks. The release and trusted Oracle/native integration workflows remain disabled in GitHub, and their jobs use `if: ${{ false }}`. CI runs automatically only on pushes to `main`. GitHub release/tag and integration execution require separate authorization.

Full qualification and signed releases require current evidence bound to the exact immutable source, archive integrity, protected target/approval settings and an externally managed signing key where required. Missing, blocked or stale required evidence fails its applicable gate. Database deployment safeguards, production refusal and unknown-outcome recovery are unchanged.

## Documentation on GitHub Pages

The documentation website is [apexrest-dev.github.io/apexrest](https://apexrest-dev.github.io/apexrest/). The repository's Pages configuration serves the `/docs` directory on `main`, with no custom domain. Its entry point is `docs/index.html`, and all page, asset and search routes use the `/apexrest/` base path.

The existing Markdown renderer builds the website locally:

```sh
npm ci --ignore-scripts
npm run site:build
npm run site:check
npm run docs:check
npm run site:preview
```

Open the preview at `http://127.0.0.1:4173/apexrest/`. It serves the same tracked HTML and assets that Pages will serve. Search uses a local JSON index; the website needs no server-side runtime, external fonts or third-party search service. The optional `APEXREST_SITE_PORT` changes the preview port.

Edit the Markdown sources and `site/` theme/configuration, then rebuild. Commit the generated HTML, CSS, JavaScript, search index, `.nojekyll` and `docs/site-manifest.json` together with their sources. The manifest lists files owned by the generator; the build preserves authored Markdown, catalog/reference data, diagrams and examples. `site:check` detects stale tracked output. The `.nojekyll` file lets Pages serve the prepared static files directly, following [GitHub's static-site instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). Existing flat `.html` guide URLs remain readable with their original anchors.

`site-dist/` remains an ignored staging directory for release packaging. For an alternate local preview only, use `APEXREST_SITE_BASE_PATH=/ node scripts/build-site.mjs --preview`; this does not update the branch-hosted `docs/` output. `scripts/publish-site.sh` supports an explicitly authorized mounted copy, with `--dry-run` before `--apply`; it is not needed for GitHub Pages.

Building or previewing changes publishes nothing. An authorized push to `main` updates the branch-hosted Pages site independently of the disabled product-release publisher. Confirm the live Pages build and browser result separately after that push. No additional Pages workflow is required for this configured branch source.

See [release notes](release-notes.md), [testing](testing.md) and [next actions](next-actions.md).
