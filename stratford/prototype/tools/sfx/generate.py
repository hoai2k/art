#!/usr/bin/env python3
"""Generate and process Stratford Squirrel's recorded sound effects (adapted from swingers/wobblers/dev/sfx).

    ELEVENLABS_API_KEY=... python3 stratford/prototype/tools/sfx/generate.py [--no-generate] [name ...]

1. Each sound in sfx.json gets `n` takes from the ElevenLabs sound-generation API, saved as
   originals in game/assets/sfx/originals/<name>-<i>.mp3 (Round S4 library sounds in
   game/assets/sfx/library/). Both are kept in Git and never published (publish.sh copies
   only assets/manifest.json and assets/squirrel). Existing originals are kept, so a run
   resumes; delete one to remake it. Without a key nothing is generated.
2. Every non-library, non-held original is processed into game/web/sfx/<name>-<i>.mp3: lead-in
   silence trimmed, tail trimmed with a short fade, mono, peak-normalised to -1 dBFS, 96 kbps.
   Loops get a crossfaded seam instead of trims (peak -3 dBFS).
3. game/web/sfx/index.json lists the variants per sound for src/audio.js, plus `_levels` and `_loops`.
4. `hold: true` (ambient loops start held) keeps a sound out of web/ and the index. Instead a seam
   preview (the loop played twice across its crossfade, built from decoded samples) is written to
   the previews directory (--previews DIR, default the scratchpad). Drop `hold` and rerun to enable.
   `library: true` sounds are only generated, never processed.

The key is only read from the environment; it is never printed or written to a file.
"""
import json, os, subprocess, sys, tempfile, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..', 'game'))
ORIG = os.path.join(GAME, 'assets', 'sfx', 'originals')
LIB = os.path.join(GAME, 'assets', 'sfx', 'library')
OUT = os.path.join(GAME, 'web', 'sfx')
PREVIEWS = '/tmp/claude-0/-home-user/ae607519-6356-54fa-91fb-69b85992c198/scratchpad/sfx-previews'
API = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'
SR = 44100
STOP = {'401', '402', '429'}


def orig_dir(s):
    return LIB if s.get('library') else ORIG


def generate(spec, style, key):
    d = orig_dir(spec)
    os.makedirs(d, exist_ok=True)
    for i in range(1, spec['n'] + 1):
        path = os.path.join(d, f"{spec['name']}-{i}.mp3")
        if os.path.exists(path):
            continue
        req = {'text': f"{spec['prompt']}. {style}", 'duration_seconds': spec['dur'], 'prompt_influence': 0.6}
        if spec.get('loop'):
            req['loop'] = True
        body = json.dumps(req)
        for attempt in range(3):
            r = subprocess.run(['curl', '-sS', '-o', path, '-w', '%{http_code}', API, '-H', f'xi-api-key: {key}',
                                '-H', 'Content-Type: application/json', '-d', body], capture_output=True, text=True)
            if r.stdout == '200':
                print('made', os.path.basename(path), flush=True)
                break
            err = open(path, 'rb').read()[:200] if os.path.exists(path) else r.stderr
            if os.path.exists(path):
                os.remove(path)
            print('failed', os.path.basename(path), r.stdout, err, flush=True)
            if r.stdout in STOP:  # auth / quota / rate limit: stop, do not burn retries
                sys.exit(f'stopping on HTTP {r.stdout}')
            time.sleep(2 ** (attempt + 1))
        else:
            sys.exit('stopping after repeated errors')


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def encode(a, dst):
    with tempfile.NamedTemporaryFile(suffix='.f32') as f:
        a.astype(np.float32).tofile(f.name)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', f.name, '-b:a', '96k', dst], check=True)


def make_loop(a):
    """Crossfaded loop: drop faded ends, then the tail fades into the head. Returns the loop samples."""
    cut = int(1.0 * SR) if len(a) > 8 * SR else 0
    a = a[cut:len(a) - cut]
    a = a / np.abs(a).max()
    x = min(len(a) // 4, int(2.5 * SR))
    t = np.linspace(0, np.pi / 2, x)
    head, tail = a[:x].copy(), a[-x:]
    a = a[x:].copy()
    a[-x:] = tail * np.cos(t) + head * np.sin(t)
    return a * 10 ** (-3 / 20) / max(1e-6, np.abs(a).max()), x


def usable(a, src):
    if not len(a) or np.abs(a).max() < 1e-4:
        print('silent', src)
        return False
    return True


def process_loop(src, dst):
    a = decode(src)
    if not usable(a, src):
        return False
    encode(make_loop(a)[0], dst)
    return True


def process(src, dst):
    a = decode(src)
    if not usable(a, src):
        return False
    a /= np.abs(a).max()
    w = 220  # 5 ms windows
    env = np.array([np.sqrt(np.mean(a[i:i + w] ** 2)) for i in range(0, len(a), w)])
    loud = np.where(env > 10 ** (-40 / 20))[0]
    start = max(0, loud[0] * w - 220)  # keep 5 ms before the onset
    tail = np.where(env > 10 ** (-55 / 20))[0]
    end = min(len(a), (tail[-1] + 1) * w + 2205)
    a = a[start:end]
    fade = min(len(a) // 4, 4410)
    a[-fade:] *= np.linspace(1, 0, fade)
    a[:132] *= np.linspace(0, 1, 132)
    a *= 10 ** (-1 / 20) / max(1e-6, np.abs(a).max())
    encode(a, dst)
    return True


def preview(src, dst):
    """The loop played twice (the seam is at the join), decoded and tiled, then encoded."""
    a = decode(src)
    if not usable(a, src):
        return
    loop, _ = make_loop(a)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    encode(np.concatenate([loop, loop]), dst)


def main():
    args = sys.argv[1:]
    gen = '--no-generate' not in args
    previews = PREVIEWS
    if '--previews' in args:
        previews = args[args.index('--previews') + 1]
    only = {a for a in args if not a.startswith('--') and a != previews}
    cfg = json.load(open(os.path.join(HERE, 'sfx.json')))
    key = os.environ.get('ELEVENLABS_API_KEY') if gen else None
    for s in cfg['sounds']:
        if only and s['name'] not in only:
            continue
        if key:
            generate(s, cfg['style'], key)
    os.makedirs(OUT, exist_ok=True)
    index = {}
    for s in cfg['sounds']:
        if s.get('library'):
            continue
        for i in range(1, s['n'] + 1):
            src = os.path.join(ORIG, f"{s['name']}-{i}.mp3")
            dst = os.path.join(OUT, f"{s['name']}-{i}.mp3")
            if s.get('hold'):  # generated, waiting for the owner: preview only, not in the game
                if os.path.exists(dst):
                    os.remove(dst)
                if os.path.exists(src) and s.get('loop'):
                    preview(src, os.path.join(previews, f"{s['name']}-{i}-seam.mp3"))
                continue
            if not os.path.exists(src) or i in s.get('skip', []):
                if os.path.exists(dst):
                    os.remove(dst)
                continue
            proc = process_loop if s.get('loop') else process
            if proc(src, dst):
                index.setdefault(s['name'], []).append(f"sfx/{s['name']}-{i}.mp3")
    live = [s for s in cfg['sounds'] if not s.get('library') and not s.get('hold') and s['name'] in index]
    index['_levels'] = {s['name']: s.get('level', 1) for s in live}
    index['_loops'] = [s['name'] for s in live if s.get('loop')]
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
    print('index:', {k: len(v) for k, v in index.items() if not k.startswith('_')})


if __name__ == '__main__':
    main()
