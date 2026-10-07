#!/usr/bin/env bash
set -euo pipefail
mode="${1:---dry-run}"
destination="${2:-}"
[[ "$mode" == '--dry-run' || "$mode" == '--apply' ]] || { echo 'Use --dry-run or --apply and an authorized mounted destination.' >&2; exit 2; }
site_subdirectory="$(node --input-type=module -e 'import fs from "node:fs"; const config = JSON.parse(fs.readFileSync("site/site.config.json", "utf8")); console.log(config.basePath.replace(/^\/|\/$/g, ""));')"
[[ -n "$destination" && "${destination%/}" == */"$site_subdirectory" && -d site-dist ]] || { echo "Destination must be an authorized site subdirectory ending /$site_subdirectory; build site-dist first." >&2; exit 2; }
# No delete, DNS, root homepage, remote login or upload is implicit.
if [[ "$mode" == '--dry-run' ]]; then rsync -an --itemize-changes site-dist/ "$destination/"; else rsync -a --itemize-changes site-dist/ "$destination/"; fi
