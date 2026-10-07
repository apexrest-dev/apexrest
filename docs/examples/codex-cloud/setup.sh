#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

mode="${1:-setup}"
[[ $# -le 1 && ( "$mode" == setup || "$mode" == --maintenance ) ]] || {
  echo 'Usage: bash scripts/codex-cloud/setup.sh [--maintenance]' >&2
  exit 2
}
[[ "${CODEX_CLOUD:-}" == 1 ]] || {
  echo 'Skipping Cloud setup: CODEX_CLOUD is not 1.'
  exit 0
}
# Keep the secret out of subprocess environments, including downloads and Java.
cloud_password="${APEXREST_ORDS_PASSWORD-}"
unset APEXREST_ORDS_PASSWORD
[[ "$(uname -s)" == Linux ]] || { echo 'Cloud setup requires Linux.' >&2; exit 2; }
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/../.." && pwd)"
[[ "$script_dir" == "$root/scripts/codex-cloud" ]] || {
  echo 'Copy this example to scripts/codex-cloud/ in your application repository.' >&2
  exit 2
}
cd "$root"
connection_ref="${APEXREST_CONNECTION_REF:-cloud-dev}"
[[ "$connection_ref" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$ ]] || {
  echo 'APEXREST_CONNECTION_REF must be a valid APEXREST reference name.' >&2
  exit 2
}
if [[ "$mode" == setup ]]; then
  [[ "${APEXREST_PERSIST_CREDENTIALS:-}" == 1 ]] || {
    echo 'Set APEXREST_PERSIST_CREDENTIALS=1 to allow the password in the private Cloud cache.' >&2
    exit 2
  }
  [[ "${APEXREST_ACCEPT_ORACLE_LICENSE:-}" == 1 ]] || {
    echo 'Accept https://www.oracle.com/downloads/licenses/oracle-free-license.html and set APEXREST_ACCEPT_ORACLE_LICENSE=1.' >&2
    exit 2
  }
  [[ -n "${APEXREST_ORDS_URL:-}" && -n "${APEXREST_ORDS_USERNAME:-}" && -n "$cloud_password" ]] || {
    echo 'Set APEXREST_ORDS_URL, APEXREST_ORDS_USERNAME and the APEXREST_ORDS_PASSWORD secret, then rerun Setup.' >&2
    exit 2
  }
fi
git check-ignore -q -- .codex/cloud/credential-ignore-check || {
  echo 'Add /.codex/cloud/ to the repository .gitignore before running Cloud setup.' >&2
  exit 2
}
export TERM="${TERM:-dumb}"
export APEXREST_HOME="$root/.codex/cloud/tools"
source "$script_dir/version.sh"
source "$script_dir/network.sh"
checkout="$root/.codex/cloud/apexrest-$APEXREST_REVISION"
if [[ "$mode" == --maintenance ]]; then
  unset cloud_password
  [[ -x "$root/.codex/cloud/node" && -d "$checkout" && -f "$APEXREST_HOME/runtime.json" && -f "$APEXREST_HOME/credentials/$connection_ref.json" ]] || {
    echo 'Cloud cache or credentials are missing. Rerun the Cloud Setup script.' >&2
    exit 3
  }
  cloud_node="$root/.codex/cloud/node"
else
  mkdir -p "$root/.codex/cloud"
  chmod 700 "$root/.codex/cloud"
fi
temporary="$(mktemp -d "$root/.codex/cloud/setup.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT
if [[ "$mode" == setup ]]; then
  printf '%s' "$cloud_password" > "$temporary/password"
  unset cloud_password
  source "$script_dir/cloud-node.sh"
  cloud_node="$(resolve_cloud_node "$root")"
  ln -sfn "$cloud_node" "$root/.codex/cloud/node"
fi
"$cloud_node" -e 'const n = +process.versions.node.split(".")[0]; if (n < 24 || n >= 27) { console.error("Node.js 24-26 is required; rerun Cloud Setup."); process.exit(3); }'
export PATH="$(dirname "$cloud_node"):$PATH"
if [[ "$mode" == setup ]]; then
  "$cloud_node" - "$temporary/password" <<'JS'
const fs = require('node:fs');
const password = fs.readFileSync(process.argv[2], 'utf8');
if (!password || password.length > 4096 || /["\x00-\x1f\x7f-\x9f]/.test(password)) {
  console.error('APEXREST_ORDS_PASSWORD must be nonempty, at most 4096 characters, without double quotes or control characters.');
  process.exit(2);
}
let url;
try { url = new URL(process.env.APEXREST_ORDS_URL); } catch {}
if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    !url.pathname.endsWith('/') || url.pathname.replace(/\/+$/, '').endsWith('/_/sql') ||
    process.env.APEXREST_ORDS_URL.length > 2048 || /[\s"\x00-\x1f]/.test(process.env.APEXREST_ORDS_URL)) {
  console.error('APEXREST_ORDS_URL must be the HTTPS schema URL ending in /, without credentials, query or fragment.');
  process.exit(2);
}
const username = process.env.APEXREST_ORDS_USERNAME;
if (!username || username.length > 128 || /["\x00-\x1f\x7f-\x9f]/.test(username)) {
  console.error('APEXREST_ORDS_USERNAME is invalid.');
  process.exit(2);
}
JS
  if [[ ! -d "$checkout" ]]; then
    git init -q "$temporary/plugin"
    git -C "$temporary/plugin" fetch --depth 1 https://github.com/apexrest-dev/apexrest.git "$APEXREST_REVISION"
    git -C "$temporary/plugin" checkout --detach -q FETCH_HEAD
    mv "$temporary/plugin" "$checkout"
  fi
fi
[[ -d "$checkout" && "$(git -C "$checkout" rev-parse HEAD)" == "$APEXREST_REVISION" ]] || {
  echo 'Pinned APEXREST checkout is missing or changed. Restore the pinned checkout and rerun Cloud Setup.' >&2
  exit 3
}
cli="$checkout/plugins/apexrest-apex/runtime/apexrest.mjs"
"$cloud_node" - "$checkout/plugins/apexrest-apex/.codex-plugin/plugin.json" "$APEXREST_VERSION" <<'JS'
const fs = require('node:fs');
if (JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).version !== process.argv[3]) {
  throw new Error('Unexpected APEXREST plugin version.');
}
JS
if [[ "$mode" == setup ]]; then
  "$cloud_node" "$cli" dependencies install --dry-run --json
  "$cloud_node" "$cli" dependencies install --yes --accept-oracle-license --json
fi
"$cloud_node" "$script_dir/setup-java.mjs"
export APEXREST_JAVA_HOME="$root/.codex/cloud/java"
if [[ "$mode" == setup ]]; then
  "$cloud_node" "$cli" sqlcl configure --mode cli --database-transport ords --json
  "$cloud_node" "$cli" connection add --name "$connection_ref" \
    --ords-url "$APEXREST_ORDS_URL" --ords-username "$APEXREST_ORDS_USERNAME" \
    --password-file "$temporary/password" --json
  rm -f "$temporary/password"
else
  "$cloud_node" - "$APEXREST_HOME/sqlcl.json" <<'JS'
const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (config.mode !== 'cli' || config.databaseTransport !== 'ords') {
  throw new Error('Cloud configuration changed: expected CLI with ORDS. Rerun Setup.');
}
JS
fi
"$cloud_node" "$cli" doctor --json
# The official connection test performs a read-only database identity SELECT.
status=0
"$cloud_node" "$cli" connection test --name "$connection_ref" --json > "$temporary/identity.json" || status=$?
cat "$temporary/identity.json"
[[ "$status" == 0 ]] || exit "$status"
"$cloud_node" - "$temporary/identity.json" <<'JS'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [variable, field] of [
  ['APEXREST_EXPECTED_SCHEMA', 'parsing_schema'],
  ['APEXREST_EXPECTED_SERVICE', 'service_name'],
]) {
  if (process.env[variable] && result.data?.[field] !== process.env[variable]) {
    console.error(`Database identity mismatch for ${variable}.`);
    process.exit(1);
  }
}
JS
echo "Cloud $mode complete: ORDS reference $connection_ref verified. No application was imported."
