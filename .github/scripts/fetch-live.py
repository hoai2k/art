#!/usr/bin/env python3
"""Copy one game's live folder off the published site, for a deploy in which
that game failed to build (.github/scripts/build-game.sh, last resort).

GitHub Pages has no directory listing, so this crawls: from the folder's
index.html it follows every path it can find in the HTML, CSS, JS, JSON and
manifests it downloads (attributes, url(...), import/fetch strings, any quoted
string that looks like a relative file path), resolving each against the file
it was found in and against the folder itself, and keeps what the site serves
from inside the folder. A path the code builds at run time (`'sky-' + id`) is
not a string anywhere and is missed, so the copy can be incomplete; that is
why the build script first tries rebuilding the game from the live commit.

Usage: fetch-live.py <folder> <outdir> [site base URL]
Exits 1 if not even the folder's index.html could be fetched.
"""
import os, re, sys, urllib.error, urllib.parse, urllib.request

folder, outdir = sys.argv[1], sys.argv[2]
base = (sys.argv[3] if len(sys.argv) > 3 else 'https://games.hoai.net/art').rstrip('/')
MAX_FILES = 20000
TEXT = ('.html', '.htm', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt')
CANDIDATE = re.compile(r'''(?:src|href|poster)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)|["'`]([^"'`\s<>{}$#?]+\.[A-Za-z0-9]{1,10})["'`]''')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'mini-pages-fallback'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.geturl(), r.read()


try:
    root_url, page = get(f'{base}/{folder}/')
except (urllib.error.URLError, OSError) as e:
    print(f'could not fetch {base}/{folder}/: {e}')
    sys.exit(1)
root_url = root_url if root_url.endswith('/') else root_url.rsplit('/', 1)[0] + '/'
prefix = urllib.parse.urlsplit(root_url)._replace(query='', fragment='').geturl()

saved, seen, queue = 0, {prefix}, [(prefix + 'index.html', page)]
while queue and saved < MAX_FILES:
    url, data = queue.pop()
    rel = urllib.parse.unquote(url[len(prefix):]) or 'index.html'
    if rel.endswith('/'):
        rel += 'index.html'
    path = os.path.normpath(os.path.join(outdir, rel))
    if not path.startswith(os.path.normpath(outdir) + os.sep):
        continue
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)
    saved += 1
    if not rel.lower().endswith(TEXT):
        continue
    text = data.decode('utf-8', 'replace')
    for m in CANDIDATE.finditer(text):
        ref = next(g for g in m.groups() if g)
        ref = ref.strip()
        if not ref or re.search(r'\s', ref):
            continue
        if ref.startswith(('data:', 'blob:', 'mailto:', 'javascript:')) or '://' in ref and not ref.startswith(prefix):
            continue
        for start in (url, prefix):
            target = urllib.parse.urljoin(start, ref)
            target = urllib.parse.urlsplit(target)._replace(query='', fragment='').geturl()
            if not target.startswith(prefix) or target in seen:
                continue
            seen.add(target)
            try:
                final, body = get(target)
            except Exception:  # a guess that is not a file: skip it
                continue
            if final.startswith(prefix) and not final.endswith('/'):
                queue.append((final, body))

print(f'fetched {saved} files of {folder}/ from {prefix}')
sys.exit(0 if saved else 1)
