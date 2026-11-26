#!/bin/bash
# Install the APEXREST bar widget into the Omarchy shell.
#
#   integrations/omarchy/install.sh          copy the plugin and add it to the bar
#   integrations/omarchy/install.sh --link   symlink instead (edits in the repo apply live)
#
# The bar placement goes through `omarchy bar put`, which edits
# ~/.config/omarchy/shell.json. It also links ~/.local/bin/apexrest-pair.
# Remove with: omarchy plugin remove apexrest && rm ~/.local/bin/apexrest-pair
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/apexrest"
REPO="$(cd "$HERE/../.." && pwd)"
DEST="$HOME/.config/omarchy/plugins/apexrest"
MODE=copy
[[ ${1:-} == --link ]] && MODE=link

command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
command -v omarchy >/dev/null || { echo "This installer is for Omarchy (omarchy CLI not found)" >&2; exit 1; }

# One source of truth for the mark: the plugin's own asset.
install -m 0644 "$REPO/plugins/apexrest-apex/assets/apexrest-icon.svg" "$SRC/assets/apexrest-icon.svg"
omarchy plugin validate "$SRC"

mkdir -p "$(dirname "$DEST")"
if [[ -L $DEST || -d $DEST ]]; then rm -rf "$DEST"; fi
if [[ $MODE == link ]]; then
  ln -s "$SRC" "$DEST"
else
  mkdir -p "$DEST"
  (cd "$SRC" && tar --exclude='__pycache__' -cf - .) | (cd "$DEST" && tar -xf -)
fi
chmod +x "$DEST/bin/apexrest-omarchy" "$DEST/bin/apexrest-pair"
# Pair mode: put apexrest-pair on PATH so you can call it by name.
mkdir -p "$HOME/.local/bin"
ln -sfn "$DEST/bin/apexrest-pair" "$HOME/.local/bin/apexrest-pair"
echo "Plugin installed ($MODE): $DEST"

in_bar() {
  python3 -I - "$HOME/.config/omarchy/shell.json" <<'PY'
import json, sys
try:
    layout = json.load(open(sys.argv[1])).get("bar", {}).get("layout", {})
except (OSError, ValueError):
    sys.exit(1)
sys.exit(0 if any(isinstance(w, dict) and w.get("id") == "apexrest"
                  for section in layout.values() if isinstance(section, list) for w in section) else 1)
PY
}
if in_bar; then
  echo "The bar already has apexrest; layout unchanged."
else
  # Let the running shell discover the new plugin, then enable it on the bar.
  omarchy-shell shell rescanPlugins >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    omarchy plugin list 2>/dev/null | grep -q '^apexrest ' && break
    sleep 0.5
  done
  omarchy plugin enable apexrest --section right --index 0
  echo "Added apexrest to the right of the bar."
fi
python3 -I "$DEST/bin/apexrest-omarchy" snapshot >/dev/null && echo "First snapshot written."
echo "Done. Saved plugin files reload automatically; if not, run: omarchy-shell shell rescanPlugins"
