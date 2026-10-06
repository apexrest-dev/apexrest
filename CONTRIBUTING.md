# Contributing

APEXREST is developed in [apexrest-dev/apexrest](https://github.com/apexrest-dev/apexrest). Code, CLI help, agent skill instructions, public documentation and diagrams use English. Keep changes focused and make claims match the evidence.

Keep executable examples, configuration keys, paths, version numbers and evidence boundaries accurate in every guide. Keep functional catalog provenance, third-party notices and pinned source locks intact. Generated verification reports belong in ignored `docs/evidence/` and do not substitute for required live checks. Run `npm run docs:check` and the site checks after documentation changes.

## Set up a checkout

Use Node 24 LTS and the committed lockfile:

```sh
git clone https://github.com/apexrest-dev/apexrest.git
cd apexrest
npm ci --ignore-scripts
npm run build
```

After source, dependency, skill or resource changes, run `npm run plugin:sync`. It builds and refreshes the checked-in self-contained plugin bundle used by repository installations, including the Codex manifest (`.codex-plugin/plugin.json`), the Claude Code manifest (`.claude-plugin/plugin.json`) and both repository marketplaces (`.agents/plugins/marketplace.json`, `.claude-plugin/marketplace.json`). Commit the resulting bundle with its source changes. With the `claude` CLI installed, `npm run test:packaging` also runs `claude plugin validate --strict` on the generated manifests. `plugins/apexrest-apex/runtime/` and `plugins/apexrest-apex/resources/` are generated output, marked `linguist-generated` in `.gitattributes`; do not edit them by hand. Change the sources and rerun `npm run plugin:sync`.

The normal build does not deploy an app or install Oracle binaries. Native-host setup, vendor downloads, connection onboarding and remote integration have their own prerequisites. See [getting started](docs/getting-started.md).

## Validate a change

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
npm run test:installers
npm run site:build
npm run test:packaging
```

Run the checks relevant to the changed behavior, including build before packaging tests. Run `npm run plugin:check` after a fresh build to verify that the checked-in plugin matches its generated runtime/resources. `npm run test:repository-plugin` exercises the repository bundle in a fresh isolated Codex profile without connecting to or writing an Oracle target. Native registration changes also need the real isolated Codex lifecycle check; Oracle adapter or application changes need appropriate real compiler/target evidence when a target is authorized and available. If a required environment is absent, record the blocker rather than substituting a mock result. See [testing](docs/testing.md).

## Engineering expectations

- Keep TypeScript strict, use ESM, and synchronize public CLI/MCP schemas with behavior.
- Preserve Oracle-generated `.apex` metadata, IDs, unrelated components and working-tree edits.
- Bind plans to source and target; preserve backup, drift, authorization, coordination and unknown-outcome checks.
- Keep secrets, browser state, local runtimes, raw business data and private backups out of source control.
- Update documentation and the relevant acceptance/evidence records when behavior or verification changes.
- Review dependency upgrades with pinned URLs/hashes, licensing, an architecture decision and actual compatibility evidence.

Keep repository documentation focused on the current contract. Do not commit obsolete plans, rollout archives or generated verification history. Record active requirements in `AGENTS.md`, the acceptance matrix and the relevant guide.

## Open a pull request

Describe the concrete problem and resulting behavior. Include the validation actually run, its environment and any remaining limitation. Explain safety or compatibility tradeoffs when they matter. Reproduce a bug before widening a fix, and avoid unrelated formatting or dependency churn.

Use a `codex/` branch for Codex-created work unless the maintainer requests a different name. Review the staged diff for credentials and private artifacts before committing. A contribution does not authorize deployments, paid resources, release tags or publication.

## Release work

Before packaging a release, run `npm run plugin:sync`, then `npm run plugin:check`, and verify the native repository installation with `npm run test:repository-plugin`. `npm run release:dry-run` creates unsigned local artifacts and a readiness report. Stable readiness requires current evidence bound to the exact immutable source. Publishing requires the separate protected workflow and maintainer authorization; it is not part of a normal build or pull request. See [publisher setup](docs/publishing.md).

Report security issues using [SECURITY.md](SECURITY.md), not public issue attachments containing secrets.
