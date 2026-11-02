#!/usr/bin/env python3
"""Make the web copies of the delivered art (Pillow).

    python3 stratford/prototype/tools/build_web.py [--check]

Reads the full-size PNGs in game/assets/{textures,facades,sprites,ui,kit}/ (kept in
Git but never published) and writes small WebP copies to game/web/ at the same
relative path, plus the app icons. Then updates game/assets/manifest.json:
`files` lists every delivered original (the town and shell use a file only
when it is listed) and `web` maps each original to the copy the game loads.
--check exits 1 if any web copy is missing or older than its original.
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', 'game'))
ASSETS, WEB = os.path.join(GAME, 'assets'), os.path.join(GAME, 'web')
# folder -> (longest side, quality)
RULES = {'textures': (1024, 82), 'facades': (1024, 82), 'sprites': (1024, 85), 'ui': (1920, 82), 'kit': (2048, 88)}
SPECIAL = {'ui/logo.png': (1600, 88), 'ui/map_parchment.png': (1536, 80), 'ui/icon.png': (512, 85),
           'ui/creatures.png': (2560, 88), 'ui/sky_autumn.png': (4096, 80)}  # a 360° sky needs its width
ICONS = [512, 192, 180]


def jobs():
    for folder in RULES:
        d = os.path.join(ASSETS, folder)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if name.lower().endswith('.png'):
                rel = f'{folder}/{name}'
                yield rel, f'web/{folder}/{name[:-4]}.webp', SPECIAL.get(rel, RULES[folder])


def stale(src, dst):
    return not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)


def main():
    check = '--check' in sys.argv
    bad, web = [], {}
    for rel, out, (side, q) in jobs():
        src, dst = os.path.join(ASSETS, rel), os.path.join(GAME, out)
        web[rel] = out
        if check:
            if stale(src, dst):
                bad.append(out)
            continue
        im = Image.open(src)
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        im.thumbnail((side, side), Image.LANCZOS)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, 'WEBP', quality=q, method=6)
    icon = os.path.join(ASSETS, 'ui/icon.png')
    if os.path.exists(icon):
        for s in ICONS:
            dst = os.path.join(WEB, 'icons', f'icon-{s}.png')
            if check:
                if stale(icon, dst):
                    bad.append(dst)
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            Image.open(icon).convert('RGB').resize((s, s), Image.LANCZOS).save(dst, optimize=True)
    if check:
        if bad:
            sys.exit('stale or missing web copies: ' + ', '.join(bad))
        print(f'web copies up to date ({len(web)} images)')
        return
    mpath = os.path.join(ASSETS, 'manifest.json')
    try:
        manifest = json.load(open(mpath))
    except Exception:
        manifest = {}
    manifest['files'] = sorted(set(manifest.get('files', [])) | set(web))
    manifest['web'] = web
    manifest['note'] = ('Delivered art, relative to game/assets/. A file is used only when listed in `files`; '
                        '`web` maps it to the small copy the game loads (relative to game/), written by '
                        'tools/build_web.py. Rerun that script after a delivery.')
    with open(mpath, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    total = sum(os.path.getsize(os.path.join(dp, n)) for dp, _, ns in os.walk(WEB) for n in ns)
    print(f'{len(web)} images -> game/web/ ({total / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
