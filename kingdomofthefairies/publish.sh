#!/usr/bin/env sh
# Copy the Kingdom of the Fairies prototype (a static page, no build step) into a GitHub
# Pages output directory, so it is published at <site>/kingdomofthefairies/ (the cutscene
# workbench comes along at <site>/kingdomofthefairies/workbench/).
# Usage: kingdomofthefairies/publish.sh local/pages/kingdomofthefairies
set -eu
out="${1:?output directory}"
here="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$out"
mkdir -p "$out"
cp "$here/index.html" "$here/styles.css" "$here/manifest.webmanifest" "$here/manifest-widowsbay.webmanifest" "$out/"
cp -R "$here/src" "$here/assets" "$here/icons" "$here/workbench" "$out/"
echo "published Kingdom of the Fairies to $out/"
