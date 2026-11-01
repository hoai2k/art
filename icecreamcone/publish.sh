#!/usr/bin/env sh
# Copy the Ice-Cream Cone Coot (static ES modules, no build step) into a GitHub
# Pages output directory, so it is published at <site>/icecreamcone/. Tests,
# scripts, the design documents and the book reference photos stay out of it.
# Usage: icecreamcone/publish.sh local/pages/icecreamcone
set -eu
out="${1:?output directory}"
here="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$out"
mkdir -p "$out"
cp "$here/game/index.html" "$here/game/styles.css" "$here/game/manifest.webmanifest" "$out/"
cp -R "$here/game/src" "$here/game/icons" "$out/"
if [ -d "$here/game/assets" ] && [ -n "$(ls -A "$here/game/assets" 2>/dev/null)" ]; then
  cp -R "$here/game/assets" "$out/"
fi
echo "published the Ice-Cream Cone Coot to $out/"
