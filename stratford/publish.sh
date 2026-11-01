#!/usr/bin/env sh
# Copy the Stratford Squirrel prototype (static ES modules, no build step) into
# a GitHub Pages output directory, so it is published at
# <site>/stratford/prototype/ (and <site>/stratford/ forwards there).
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
for d in src lib data assets lab; do
  [ -d "$game/$d" ] && cp -R "$game/$d" "$out/prototype/"
done
cat > "$out/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>Stratford Squirrel</title>
<meta http-equiv="refresh" content="0; url=prototype/">
<link rel="canonical" href="prototype/">
<a href="prototype/">Stratford Squirrel</a>
HTML
echo "published Stratford Squirrel to $out/ ($(du -sh "$out" | cut -f1))"
