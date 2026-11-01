#!/usr/bin/env sh
# Copy the Stratford Squirrel prototype (static ES modules, no build step) into
# a GitHub Pages output directory, so it is published at
# <site>/stratford/prototype/. Nothing is published at <site>/stratford/
# itself and the library has no card for it: the owner wants the prototype
# reachable only by its address until the game proper is built.
# Only what the game loads goes out: the page, its code, the vendored
# libraries, the town data and the delivered art. The reference photos and
# sheets, the build tools, the tests and the design notes stay out.
# Usage: stratford/publish.sh local/pages/stratford
set -eu
out="${1:?output directory}"
here="$(cd "$(dirname "$0")" && pwd)"
game="$here/prototype/game"
rm -rf "$out"
mkdir -p "$out/prototype"
for f in index.html styles.css manifest.webmanifest; do
  [ -f "$game/$f" ] && cp "$game/$f" "$out/prototype/"
done
for d in src lib data web lab; do
  [ -d "$game/$d" ] && cp -R "$game/$d" "$out/prototype/"
done
# From assets/ only the manifest and the built models: the full-size delivered
# PNGs are published as their small copies in web/ (tools/build_web.py).
mkdir -p "$out/prototype/assets"
cp "$game/assets/manifest.json" "$out/prototype/assets/"
[ -d "$game/assets/squirrel" ] && cp -R "$game/assets/squirrel" "$out/prototype/assets/"
echo "published Stratford Squirrel to $out/ ($(du -sh "$out" | cut -f1))"
