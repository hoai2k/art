#!/usr/bin/env sh
# Copy the Bronze Drum game into a GitHub Pages output directory, so it
# is published at <site>/bronzedrum/. The game is static (no build step);
# tests, scripts, package.json and the PNG art masters stay out of the deploy.
# Usage: bronzedrum/publish.sh local/pages/bronzedrum
set -eu
out="${1:?output directory (the bronzedrum page directory)}"
here="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$out"
mkdir -p "$out"
cp "$here/game/index.html" "$here/game/styles.css" "$here/game/manifest.webmanifest" "$out/"
cp -R "$here/game/icons" "$out/"
cp -R "$here/game/src" "$out/"
# Assets without the full-size PNG masters: the game loads the WebP copies in
# assets/web/ (see design/source/build_web_art.py).
mkdir -p "$out/assets"
for item in "$here/game/assets"/*; do
  [ "$(basename "$item")" = "art" ] && continue
  cp -R "$item" "$out/assets/"
done
# The sound workbench, at <site>/bronzedrum/workbench/ (it finds the game's
# assets one level up). About 10 MB of alternative takes, so it is published
# only while deploy_config.json says includeWorkbenches: true (a missing or
# unreadable file counts as true).
if python3 - "$here/deploy_config.json" <<'PY'
import json, sys
try:
    include = json.load(open(sys.argv[1])).get("includeWorkbenches", True)
except Exception:
    include = True
sys.exit(1 if include is False else 0)
PY
then
  cp -R "$here/workbench" "$out/workbench"
else
  echo "deploy_config.json: leaving the sound workbench out"
fi
echo "published bronzedrum to $out/"
