#!/usr/bin/env bash
set -euo pipefail
# APEXREST local bootstrap. No server mutation, implicit elevation or global PATH edit.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for arg in "$@"; do
  if [[ "$arg" == '--help' || "$arg" == '-h' ]]; then
    echo 'Usage: install.sh --bundle FILE.zip --sha256 TRUSTED_SHA256 --yes [--offline] [--home DIR] [--codex-home DIR]'
    echo 'Oracle license agreement and Linux elevation require separate explicit options.'
    exit 0
  fi
done
apexrest_bootstrap_home="${APEXREST_HOME:-$HOME/.apexrest}"
apexrest_offline=false
apexrest_yes=false
apexrest_dry_run=false
apexrest_cache_dir=''
apexrest_previous=''
for arg in "$@"; do
  [[ "$arg" != '--offline' ]] || apexrest_offline=true
  [[ "$arg" != '--yes' ]] || apexrest_yes=true
  [[ "$arg" != '--dry-run' ]] || apexrest_dry_run=true
  [[ "$apexrest_previous" != '--home' ]] || apexrest_bootstrap_home="$arg"
  [[ "$apexrest_previous" != '--cache-dir' ]] || apexrest_cache_dir="$arg"
  apexrest_previous="$arg"
done
apexrest_node="$(command -v node || true)"
if [[ -z "$apexrest_node" ]] || [[ "$("$apexrest_node" -p 'process.versions.node')" != '24.21.0' ]]; then
  if $apexrest_dry_run; then echo '{"status":"planned","action":"install pinned user-local Node 24 before package setup"}'; exit 0; fi
  if ! $apexrest_yes; then echo 'SETUP_APPROVAL_REQUIRED: use --yes to install the pinned Node runtime.' >&2; exit 4; fi
  case "$(uname -s)/$(uname -m)" in
    Darwin/arm64) platform='darwin-arm64'; expected='bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057';;
    Linux/x86_64) platform='linux-x64'; expected='6e1db87ef58b8819e5d5402eff1536491b18edd8eb7bee5ef7897876e88dc5ff';;
    *) echo 'No verified bootstrap profile for this platform. Use a supported host.' >&2; exit 3;;
  esac
  runtime="$apexrest_bootstrap_home/bootstrap/node-v24.21.0-$platform"
  apexrest_node="$runtime/bin/node"
  if [[ ! -x "$apexrest_node" ]]; then
    cache="${apexrest_cache_dir:-$apexrest_bootstrap_home/cache}/node-v24.21.0-$platform.tar.gz"
    mkdir -p "$apexrest_bootstrap_home"
    bootstrap_lock="$apexrest_bootstrap_home/bootstrap.lock"
    mkdir "$bootstrap_lock" 2>/dev/null || { echo 'LOCKED: another bootstrap or a stale interrupted bootstrap owns bootstrap.lock; inspect before retry.' >&2; exit 5; }
    trap 'rmdir "$bootstrap_lock" 2>/dev/null || true' EXIT
    trap 'exit 6' INT TERM
    mkdir -p "$(dirname -- "$cache")" "$(dirname -- "$runtime")"
    if [[ ! -f "$cache" ]]; then
      if $apexrest_offline; then echo 'OFFLINE_CACHE_MISS: pinned Node runtime is not cached.' >&2; exit 3; fi
      curl --fail --show-error --silent --proto '=https' --tlsv1.2 --max-redirs 0 "https://nodejs.org/dist/v24.21.0/node-v24.21.0-$platform.tar.gz" -o "$cache.part"
      mv "$cache.part" "$cache"
    fi
    if command -v sha256sum >/dev/null; then actual="$(sha256sum "$cache" | cut -d ' ' -f 1)"; else actual="$(shasum -a 256 "$cache" | cut -d ' ' -f 1)"; fi
    [[ "$actual" == "$expected" ]] || { rm -f "$cache"; echo "Node integrity failure; removed corrupt cache: $cache; nothing was executed." >&2; exit 3; }
    if tar -tzf "$cache" | LC_ALL=C grep -Eq '(^/|(^|/)\.\.(/|$))'; then echo 'Unsafe Node archive.' >&2; exit 3; fi
    stage="$(mktemp -d "$(dirname -- "$runtime")/node-stage.XXXXXX")"
    tar -xzf "$cache" -C "$stage"
    mv "$stage/node-v24.21.0-$platform" "$runtime"
    rmdir "$stage"
    rmdir "$bootstrap_lock"
    trap - EXIT INT TERM
  fi
fi
# Node validates the user-selected release before extraction or execution.
exec "$apexrest_node" --use-env-proxy "$script_dir/bootstrap-runtime.mjs" "$@"
