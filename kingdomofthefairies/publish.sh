#!/usr/bin/env sh
# Copy the Kingdom of the Fairies prototype (a static page, no build step) into a GitHub
# Pages output directory, so it is published at <site>/kingdomofthefairies/ (the cutscene
# workbench comes along at <site>/kingdomofthefairies/workbench/).
# deploy_config.json's includeWidowsBay false strips the Widow's Bay edition out.
# Usage: kingdomofthefairies/publish.sh local/pages/kingdomofthefairies
set -eu
out="${1:?output directory}"
here="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$out"
mkdir -p "$out"
cp "$here/index.html" "$here/styles.css" "$here/manifest.webmanifest" "$here/manifest-widowsbay.webmanifest" "$out/"
cp -R "$here/src" "$here/assets" "$here/icons" "$here/workbench" "$out/"
# The retired Extra Animations idle frames are never loaded (theme.js RETIRED_IDLE).
find "$out/assets" -maxdepth 1 -name '*-idle-[bc].webp' ! -name '*wall-idle*' -delete
find "$out/assets" -maxdepth 1 -name '*-idle-[bc]-tinted.webp' ! -name '*wall-idle*' -delete
find "$out/assets" -maxdepth 1 -name '*-idle-[bc]*-redo.webp' ! -name '*wall-idle*' -delete
widowsbay=$(python3 -c 'import json,sys
try: print("false" if json.load(open(sys.argv[1])).get("includeWidowsBay", True) is False else "true")
except Exception: print("true")' "$here/deploy_config.json")
if [ "$widowsbay" = false ]; then
  # Only Widow's Bay loads these (the film edition filters them out: theme.js).
  python3 - "$out" <<'PY'
import json, os, shutil, sys
out = sys.argv[1]
path = os.path.join(out, 'assets', 'manifest.json')
m = json.load(open(path))
gone = []
for sid in [k for k in m.get('slots', {}) if k.startswith('band-') or k == 'logo']:
    gone.append(m['slots'].pop(sid).get('file'))
song = m.get('audio', {}).pop('song', None)
if song: gone.append(song.get('file'))
for f in filter(None, gone):
    p = os.path.join(out, 'assets', f)
    if os.path.exists(p): os.remove(p)
json.dump(m, open(path, 'w'), indent=2, ensure_ascii=False)
shutil.rmtree(os.path.join(out, 'icons', 'legacy'), ignore_errors=True)
os.remove(os.path.join(out, 'manifest-widowsbay.webmanifest'))
html = os.path.join(out, 'index.html')
s = open(html).read()
assert '<meta name="kotf-widowsbay" content="on">' in s
open(html, 'w').write(s.replace('<meta name="kotf-widowsbay" content="on">', '<meta name="kotf-widowsbay" content="off">'))
print('Widow\'s Bay left out:', len(gone), 'asset files removed')
PY
fi
# A separate SDK-free version of the portal game for testing on our website.
# Shared website files above retain their normal editions, controls and saves.
node "$here/distribution/crazygames/build.mjs" --preview --out "$out/crazygames-preview"
echo "published Kingdom of the Fairies to $out/"
