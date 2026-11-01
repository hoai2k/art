#!/usr/bin/env sh
# Copy Fibre Art (static ES modules, no build step) into a GitHub Pages output
# directory, so it is published at <site>/fibreart/. Only the page, its styles,
# its code and the web copies of the art go out: the full-size delivered images
# in game/assets/ (made into game/web/ by tools/build_web.py), the design
# documents and the reference photos of Hanneke de Neve's work stay out of it.
# Usage: fibreart/publish.sh local/pages/fibreart
set -eu
out="${1:?output directory}"
here="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$out"
mkdir -p "$out"
cp "$here/game/index.html" "$here/game/styles.css" "$here/game/manifest.webmanifest" "$out/"
cp -R "$here/game/src" "$out/"
cp -R "$here/game/web" "$out/"
echo "published Fibre Art to $out/ ($(du -sh "$out" | cut -f1))"
