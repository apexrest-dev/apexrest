#!/bin/bash

# Install the APEXREST Omarchy shell plugin into ~/.config/omarchy/plugins/apexrest.
#
#   integrations/omarchy/install.sh [--cli PATH] [--project PATH] [--section SECTION] [--no-enable]
#
# --cli PATH         set the widget's apexrestCommand (an apexrest executable or apexrest.mjs)
# --project PATH     pin a project (a folder with apexrest.json) instead of following
#                    the project APEXREST last worked in
# --section SECTION  bar section when first enabled (default: right)
# --no-enable        copy only; enable later with: omarchy plugin enable apexrest
#
# Remove with: omarchy plugin remove apexrest

set -euo pipefail

fail() {
  echo "apexrest omarchy install: $*" >&2
  exit 1
}

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source_dir="$here/apexrest"
plugins_dir="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins"
target="$plugins_dir/apexrest"
shell_json="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/shell.json"

project=""
cli=""
section="right"
enable=true

while (($#)); do
  case "$1" in
  --project)
    project="${2:-}"
    shift 2
    ;;
  --cli)
    cli="${2:-}"
    shift 2
    ;;
  --section)
    section="${2:-}"
    shift 2
    ;;
  --no-enable)
    enable=false
    shift
    ;;
  -h | --help)
    sed -n '3,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *) fail "unknown option: $1" ;;
  esac
done

command -v omarchy >/dev/null 2>&1 || fail "omarchy not found; this installer is for Omarchy systems"
command -v jq >/dev/null 2>&1 || fail "jq is required"

if [[ -n $project ]]; then
  project="${project/#\~/$HOME}"
  project=$(cd "$project" 2>/dev/null && pwd) || fail "project folder not found: $project"
  [[ -f $project/apexrest.json ]] || fail "no apexrest.json in $project"
fi

omarchy plugin validate "$source_dir" || fail "plugin folder failed validation"

# Replace the installed copy in one step. Stage outside the plugins folder:
# the shell watches it and would load a half-copied or retired folder.
mkdir -p "$plugins_dir"
work=$(mktemp -d "$(dirname "$plugins_dir")/.apexrest-install.XXXXXX")
trap 'rm -rf "$work"' EXIT
cp -R "$source_dir" "$work/new"
chmod +x "$work/new/bin/apexrest-omarchy"
[[ -e $target ]] && mv "$target" "$work/old"
mv "$work/new" "$target"
rm -rf "$work"
trap - EXIT
echo "Installed $target"

omarchy-shell shell rescanPlugins >/dev/null 2>&1 || true

in_layout() {
  [[ -f $shell_json ]] && jq -e '[.bar.layout // {} | .[]? | .[]? | select(.id == "apexrest")] | length > 0' "$shell_json" >/dev/null 2>&1
}

if [[ $enable == true ]] && ! in_layout; then
  # The shell may need a moment to discover a freshly copied plugin.
  for attempt in 1 2 3 4 5; do
    if ((attempt < 5)); then
      omarchy plugin enable apexrest --section "$section" 2>/dev/null && break
    else
      omarchy plugin enable apexrest --section "$section" && break
    fi
    sleep 1
  done
  in_layout || fail "could not enable the widget; run: omarchy plugin enable apexrest --section $section"
fi

if [[ -n $cli ]]; then
  cli="${cli/#\~/$HOME}"
  [[ $cli == /* && ( -x $cli || $cli == *.mjs ) && -f $cli ]] || fail "not an apexrest executable or apexrest.mjs: $cli"
fi

if [[ -n $project || -n $cli ]]; then
  in_layout || fail "the widget is not in the bar yet; enable it, then rerun with --project"
  cp "$shell_json" "$shell_json.bak.$(date +%s)"
  tmp=$(mktemp "$shell_json.XXXXXX")
  jq --arg p "$project" --arg c "$cli" '
    .bar.layout |= with_entries(.value |= map(
      if .id == "apexrest" then
        . + (if $p == "" then {} else {projectPath: $p} end) + (if $c == "" then {} else {apexrestCommand: $c} end)
      else . end))
  ' "$shell_json" >"$tmp" && mv "$tmp" "$shell_json"
  [[ -n $project ]] && echo "Pinned project $project"
  [[ -n $cli ]] && echo "APEXREST command $cli"
fi

echo "Done. Click the database icon in the bar; middle-click refreshes."
