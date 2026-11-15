# APEXREST

![APEXREST pencil and ruler symbol](docs/assets/apexrest-logo.svg)

[![Local quality gates](https://github.com/apexrest-dev/apexrest/actions/workflows/ci.yml/badge.svg)](https://github.com/apexrest-dev/apexrest/actions/workflows/ci.yml)

**An Oracle APEX plugin for Codex and Claude Code. An agent writes APEXlang, previews it, runs it and ships it to a development or test application.**

[Features](docs/features.md) · [Get started](https://apexrest-dev.github.io/apexrest/getting-started/) · [Documentation](https://apexrest-dev.github.io/apexrest/docs/) · [Deployment safety](https://apexrest-dev.github.io/apexrest/deployment/) · [Release notes](https://apexrest-dev.github.io/apexrest/release-notes/)

## What it is

[Oracle APEX](https://apex.oracle.com/) is a low-code platform for business web applications on Oracle Database. APEX 26.1 and 26.2 can express an application as **APEXlang**, a readable text source that a coding agent can edit like any other code.

APEXREST gives that agent what it needs to do the work well. One plugin installs into **Codex** (desktop app and CLI) and **Claude Code**. Its six skills and twelve MCP tools share one runtime, which is also available as the `apexrest` CLI for scripts, CI and Codex Cloud.

## What you can do with it

| Step      | What happens                                                                                                      | Read more                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Write** | The agent reads Oracle definitions and compiler-checked recipes offline before it writes APEXlang.                | [Component library](docs/features.md#component-library-read-before-writing) |
| **See**   | Pages render locally with the genuine Universal Theme, without a database or against your own.                    | [Local preview](https://apexrest-dev.github.io/apexrest/local-preview/)     |
| **Check** | The official Oracle compiler validates the sources and reports file, line, column and valid values.               | [Testing](https://apexrest-dev.github.io/apexrest/testing/)                 |
| **Ship**  | Only the changed pages and components are imported into a DEV, QA or TEST application, after a plan and a backup. | [Deployment safety](https://apexrest-dev.github.io/apexrest/deployment/)    |
| **Run**   | `apexrest build webapp` builds the application into a standalone Node.js application for your Oracle database.    | [Build a web application](https://apexrest-dev.github.io/apexrest/webapp/)  |

![APEXREST connects an agent request to APEXlang source, a verified deployment plan, Oracle APEX and runtime checks.](docs/assets/overview.svg)

You ask for a change, such as "add an order status report". The agent writes the APEXlang, renders the pages locally, validates them with the Oracle compiler, imports only what changed, and checks the result in a browser when you ask it to.

## Features

**Writing**

- **Component library.** 389 pinned Oracle 26.2 definitions, 269 compiler-checked component recipes, UX patterns and 1,350 public Oracle pages, searchable in English or Ukrainian.
- **Decisions API selection.** Optional OpenAI ranking of catalog components before generation. A one-page pilot cut active time by 48%.
- **Real compiler validation.** Structured diagnostics with file, line, column and valid values.

**Seeing and running**

- **Local preview.** Run APEXlang on Node.js and SQLite with the genuine Universal Theme 26.2: reports, grids, forms, items, charts, calendars, maps, dynamic actions and a PL/SQL interpreter.
- **Connected and live preview.** Run the preview's backend in your own DEV, QA or TEST database, and watch open pages follow each source edit.
- **Standalone web application.** `apexrest build webapp` builds an APEXlang application into a Node.js application that renders the pages and runs their SQL and PL/SQL in your Oracle database, without the APEX engine or ORDS. A first version; the [guide](https://apexrest-dev.github.io/apexrest/webapp/) explains how it works and its limits.

**Shipping**

- **Partial imports on APEX 26.2.** Import only the changed pages and shared components, with drift and conflict checks.
- **Safe deployment.** Exact 30-minute plans, backups, drift detection and recovery from unknown outcomes. DEV, QA and TEST targets only.
- **Direct or ORDS access.** Reach the database through the Oracle listener or REST-Enabled SQL over HTTPS.

**Working together**

- **Two providers, one team.** Work in Claude Code with Codex as the reviewer, or in Codex with Claude Code. The second agent reviews each deployment plan read-only under your own subscription or API key; set `peerReview.mode: required` to block deployment until it approves. See [peer review](docs/configuration.md#cross-vendor-peer-review).

Details and measured results are on the [features page](docs/features.md).

## Requirements

- **Codex** with native plugin support, or **Claude Code**.
- **Node.js 24 LTS**; Node 24–26 is supported.
- **For Oracle work:** Java 21 and SQLcl, which the setup skill can install for you. Use SQLcl 26.1.2 for APEX 26.1 and SQLcl 26.3 for APEX 26.2.
- **A development or test APEX application.** APEXREST never deploys to production.

The local preview needs neither Java nor SQLcl.

## Install

**Codex:**

```sh
codex plugin marketplace add apexrest-dev/apexrest
codex plugin add apexrest-apex@apexrest
```

**Claude Code:**

```sh
claude plugin marketplace add apexrest-dev/apexrest
claude plugin install apexrest@apexrest
```

**CLI only** (optional; the same runtime without a host plugin):

```sh
npm install -g apexrest
```

The repository ships the built plugin under `plugins/apexrest-apex`, so you need no build step. To install from a local checkout, pass its path to `marketplace add`. Registry packages can lag the source; this README describes source version 2.8.0.

## Quick start

1. Start a new Codex or Claude Code session and check your setup:

   > Use APEXREST to check my setup. Report the compiler, connection and target checks that still need attention.

   If Java or SQLcl is missing, the agent previews the bundled installer and runs it with your consent. Installation never creates a database or deploys an application.

2. Describe a change, or invoke the work skill: `$apexrest-work` in Codex, `/apexrest:apexrest-work` in Claude Code.

   > Add an order status report to page 10 of the DEV application and show it to me in the browser.

3. The agent edits the APEXlang sources, previews the pages, validates and ships. It then reports the changed files, the validation result, the import status and what it checked in the browser.

An explicit request to change an identified DEV/QA/TEST application authorizes that import. The [getting started guide](https://apexrest-dev.github.io/apexrest/getting-started/) covers connections, new and existing applications, and removal.

## Documentation

**Start**

- [Getting started](https://apexrest-dev.github.io/apexrest/getting-started/): install, connect, create or adopt an application, ship and verify.
- [Features](docs/features.md): every capability, the command behind it and its limits.
- [Field report: developing with the plugin is 2 times faster](docs/apex-design-race.md): the same APEX app built with and without the plugin: 2 imports instead of 8, 2.2 times faster and 38% lower model cost.

**Build applications**

- [Local preview](https://apexrest-dev.github.io/apexrest/local-preview/): run APEXlang without a database, or against your own.
- [Component catalog](https://apexrest-dev.github.io/apexrest/component-catalog/) and [pattern catalog](https://apexrest-dev.github.io/apexrest/pattern-catalog/): what the agent reads before it writes.
- [Troubleshooting](https://apexrest-dev.github.io/apexrest/troubleshooting/): setup, compiler, authorization and recovery diagnostics.

**Run and deploy**

- [Build a web application](https://apexrest-dev.github.io/apexrest/webapp/): turn an APEXlang application into a standalone Node.js application for an Oracle database.
- [Deployment safety](https://apexrest-dev.github.io/apexrest/deployment/): plans, backups, drift and authorization rules.
- [Configuration](https://apexrest-dev.github.io/apexrest/configuration/): environments, connection references, trust policy and deployment coordination.
- [Codex Cloud](https://apexrest-dev.github.io/apexrest/codex-cloud/): run the CLI in a Cloud container over ORDS.

**Project**

- [Verification status](https://apexrest-dev.github.io/apexrest/implementation-status/): what has been checked, and how.
- [All documentation](https://apexrest-dev.github.io/apexrest/docs/)

## Development

Use Node 24 LTS and the committed lockfile:

```sh
npm ci --ignore-scripts
npm run build
npm run test:unit
```

Run `npm run plugin:sync` after source, skill or resource changes to refresh the checked-in bundle. See [contributing](CONTRIBUTING.md) and [testing](https://apexrest-dev.github.io/apexrest/testing/) for the full set of checks.

## Support and license

Report reproducible bugs through [GitHub issues](https://github.com/apexrest-dev/apexrest/issues) with sanitized diagnostics, and follow [SECURITY.md](SECURITY.md) for sensitive reports. Licensed under [Apache-2.0](LICENSE).

APEXREST is independent tooling, not an official Oracle, OpenAI or Anthropic product.
