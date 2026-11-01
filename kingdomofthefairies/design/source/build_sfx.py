#!/usr/bin/env python3
"""Generate Widow's Bay sound effects with the ElevenLabs sound-generation API.

The prompts below are the source of truth for every effect. Each id matches a
sound name played by src/audio.js. Run:

    ELEVENLABS_API_KEY=... python3 kingdomofthefairies/design/source/build_sfx.py [--force] [ids...]

Raw generations are kept in design/source/sfx-raw/<id>.mp3; existing ones are
reused unless --force is given or their ids are listed. Every raw file is then
processed into kingdomofthefairies/assets/sfx/<id>.mp3 and the `sfx` table in
assets/manifest.json is rewritten. `--process` skips the API and only
reprocesses. The key is read from the environment only; never commit it.

Processing matches the band's recording (assets/audio/widowsbay.mp3), which
measures as F major, about 76 BPM in 4/4, warm and dark (53% of its energy in
the low mids, 1.5% above 6 kHz), compressed, and wide in a 60s style. So
effects are rolled off above 9 kHz and below 40 Hz, levelled to a common
loudness, and tonal ones are retuned into F (see TUNE).

Style: the game is a 1900s toy theatre, so effects are period stage foley
(wave machine, wind machine, thunder sheet, ropes and pulleys) rather than
realistic field recordings.
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'sfx')
MANIFEST = os.path.join(ROOT, 'assets', 'manifest.json')
API = 'https://api.elevenlabs.io/v1/sound-generation'
# Short musical stingers come from the music API (its prompts keep the period
# accompaniment's style: design/music-requests.md); processed like the rest.
MUSIC_API = 'https://api.elevenlabs.io/v1/music'
MUSIC = {'victoryStinger'}

RAW = os.path.join(ROOT, 'design', 'source', 'sfx-raw')

# Semitone shifts that put each tonal effect's main partial in F major,
# measured from the raw generations: pearl's chime peaks at C9 (too bright for
# the mix, so down an octave), the keepsake harp at B4 (a tritone against F),
# the harbour bell's strongest partial just under E6.
TUNE = {'pearl': -12, 'keepsake': 1, 'arrive': 1.48,
        # the ship's bell onto F; the lantern chime (6.6 kHz, too bright) down to A
        'landho': -1.84, 'partyHit': -10.8}

# id: (seconds, prompt influence, loop, prompt)
SFX = {
    # The menus' ambience (the score itself starts only in play): an old
    # gramophone record turning with no music on it.
    'record': (20, 0.5, True,
               'An old shellac 78 rpm gramophone record spinning in its run-out groove with no music: '
               'soft surface hiss, gentle irregular crackle and pops, a faint slow rhythmic click each '
               'turn, warm and quiet, seamless.'),
    'sea': (12, 0.45, True,
            'Gentle night sea made by a Victorian theatre wave machine: dried peas rolling slowly '
            'inside a large wooden ocean drum, soft continuous swells, calm and seamless.'),
    'leap': (0.8, 0.5, False,
             'A small wooden toy ship jerked upward on creaking hemp ropes and a pulley, '
             'with a short whoosh of sea spray.'),
    'row': (0.5, 0.6, False,
            'A stagehand turns a wooden crank handle: one short ratcheting wooden clack.'),
    'pearl': (0.6, 0.6, False,
              'A single tiny bright glass chime, like a pearl dropped on a music box comb.'),
    'keepsake': (1.6, 0.5, False,
                 'An enchanted upward harp glissando with a soft celesta sparkle at the top.'),
    'hit': (1.0, 0.5, False,
            'A wooden ship hull thuds hard against rock: cracking timber and a splash.'),
    'wreck': (2.5, 0.45, False,
              'A wooden toy ship breaks apart and sinks: splintering timbers, groaning wood, '
              'a big splash, then bubbling water.'),
    'windWarn': (2.2, 0.45, False,
                 'A sea witch cackles in the distance while a theatre wind machine, canvas over '
                 'a turning wooden drum, starts to howl and rise.'),
    'wind': (1.2, 0.5, False,
             'One gust from a Victorian theatre wind machine, canvas over a wooden drum, '
             'whooshing up then settling.'),
    'boltWarn': (1.4, 0.5, False,
                 'Low distant rolling thunder made with a hanging theatre thunder sheet, '
                 'an ominous building rumble.'),
    'strike': (1.0, 0.5, False,
               'A lightning strike: a sharp electric crack followed by a loud theatre thunder '
               'sheet crash.'),
    'rockWarn': (0.9, 0.5, False,
                 'Water churning and bubbling up from below the surface, gurgling.'),
    'rockUp': (0.8, 0.5, False,
               'A heavy stone stage prop rising through a wooden trapdoor: grinding, a thump, '
               'water splashing off it.'),
    'arrive': (2.5, 0.45, False,
               'A harbour bell rings twice across calm night water, distant seagulls.'),
    'done': (1.5, 0.55, False,
             'A music box plays a short, gentle, resolving three-note flourish.'),
    'curtain': (2.0, 0.5, False,
                'Heavy velvet theatre curtains drawn open on a creaking rope pulley.'),
    'ui': (0.5, 0.6, False,
           'A soft wooden click, like a small toy theatre lever.'),
    # Act I ending: land ho, the deck party, the turn, the wreck, the guitar.
    'landho': (1.8, 0.55, False,
               "A ship's brass bell rung three times briskly, bright and joyful, with a little sea air."),
    'cheer': (2.0, 0.5, False,
              'A small theatre company of a dozen voices cheering and laughing on a wooden deck, a hatch '
              'banging open, feet stamping.'),
    'partyHit': (0.7, 0.6, False,
                 'A single warm glass chime as a paper lantern lights, with a soft puff of confetti.'),
    'revelry': (2.0, 0.5, False,
                'A crowd of revellers on a ship give a big cheer with whistles and a tambourine shake.'),
    'spirits': (3.0, 0.45, False,
                'An eerie airy choir of ghostly voices made by a wet finger on glass rims, rising over a '
                'theatre wind machine.'),
    'shipBreak': (2.0, 0.5, False,
                  'A wooden ship splitting in two: a huge timber crack, splintering planks, a mast groaning '
                  'and falling.'),
    'splash': (1.6, 0.5, False,
               'Two heavy halves of a wooden ship plunging into the sea, a deep splash and churning water.'),
    'guitarSink': (3.0, 0.45, False,
                   'An acoustic guitar sinking underwater: one muffled, detuned strum heard through water, '
                   'then slow rising bubbles.'),
    # Acts II-V (event names from src/acts/act*.js)
    'dragonPass': (2.0, 0.5, False,
                   'A low slow whoosh of a long cloth sea serpent drawn past under water on a theatre track.'),
    'witchBreath': (2.0, 0.5, False,
                    'A soft breathy exhale over a glass-harp shimmer, magical and tender.'),
    'sailorWake': (1.2, 0.5, False,
                   'A muffled gasp under water and a burst of bubbles.'),
    'swimKick': (0.8, 0.5, False,
                 'A strong muffled underwater stroke with a leather harness creak.'),
    'swimStroke': (0.5, 0.5, False,
                   'A soft quiet paddle-stroke swish under water.'),
    'conchBlow': (2.0, 0.5, False,
                  'A conch-shell horn call, round and hollow, one long note.'),
    'sleeperWake': (1.4, 0.5, False,
                    'A sleepy underwater yawn with rising bubbles, gentle and comic.'),
    'sleepersRise': (2.5, 0.5, False,
                     'A chorus of sleepy yawns and a swelling harp glissando, bubbles rising.'),
    'clamSnap': (0.4, 0.5, False,
                 'A tuned wooden clam-shell clack, like a woodblock.'),
    'eelGlow': (1.0, 0.5, False,
                'A faint eerie hum of a wet finger on a glass rim.'),
    'eelLunge': (0.6, 0.5, False,
                 'A quick slithering whip-crack swish under water.'),
    'eelBite': (0.5, 0.5, False,
                'A wet snap of jaws.'),
    'jellySting': (0.6, 0.5, False,
                   'A sharp fizzing crackle, like crumpled cellophane.'),
    'dragonBite': (1.0, 0.5, False,
                   'A deep growl and a jaw clap, muffled under water.'),
    'airLow': (1.2, 0.5, False,
               'A slow dull bell-buoy clank, a warning.'),
    'airVent': (1.5, 0.5, False,
                'A hissing jet of bubbles from a rock vent under water.'),
    'airOut': (1.2, 0.5, False,
               'A choking gurgle of bubbles.'),
    'drown': (2.0, 0.5, False,
              'Long sinking bubbles with a muffled low drum.'),
    'guitarSettle': (1.2, 0.5, False,
                     'A hollow wooden guitar body bumping onto sand, strings faintly ringing.'),
    'guitarCatch': (1.5, 0.5, False,
                    'A warm open-string acoustic guitar strum, muffled by water.'),
    'witchOffer': (2.0, 0.5, False,
                   'A shimmering harp glissando, enchanted.'),
    'roseTake': (2.0, 0.5, False,
                 'A single low tuned bell, warm and solemn.'),
    'witchLaugh': (2.0, 0.5, False,
                   "A woman's light mocking laugh with reverb, a sea witch."),
    'rideStart': (2.0, 0.5, False,
                  'A swell of a theatre wind machine and sea, a harness jingle.'),
    'rideRow': (0.5, 0.5, False,
                'A small splash.'),
    'ridePearl': (0.6, 0.5, False,
                  'A single tiny bright glass chime, slightly higher.'),
    'irisOut': (1.2, 0.5, False,
                'A soft whoosh of a curtain rope.'),
    'courtierStep': (0.3, 0.5, False,
                     'One soft felt-slipper tap on wooden stage boards.'),
    'sentrySnap': (0.4, 0.5, False,
                   'A wooden clapper jaw snapping shut.'),
    'sentryBite': (0.8, 0.5, False,
                   'A wooden clapper snapping shut with a cloth-tearing yelp.'),
    'guardBump': (0.8, 0.5, False,
                  'A brass trident butt knocking on a wooden stage and a helmet clank.'),
    'gazeTurn': (1.2, 0.5, False,
                 'A rising hum of a lantern and a squeaking rotating crank.'),
    'gazeSweep': (1.6, 0.5, False,
                  'A low sustained glass-harmonica hum.'),
    'spotted': (1.6, 0.5, False,
                'A tuned gong strike with a cymbal swell, alarm.'),
    'hauledBack': (1.0, 0.5, False,
                   'A whoosh of a shepherd crook and a boot scraping across wooden boards.'),
    'unseen': (1.2, 0.5, False,
               'A soft held harp harmonic, relief.'),
    'freeze': (0.4, 0.5, False,
               'A quick silk cloth rustle.'),
    'groove': (0.3, 0.5, False,
               'A wooden slider clicking into a brass track.'),
    'whaleNear': (2.0, 0.5, False,
                  'Distant underwater bubbling and a far-off whale groan.'),
    'whalePass': (3.0, 0.5, False,
                  'A long low whale groan with water and the creak of a rope track.'),
    'fishPass': (1.2, 0.5, False,
                 'A light water swish with a comic bubbly burble.'),
    'pearlTaken': (1.5, 0.5, False,
                   'A tuned chime with a shimmering glass-rod sparkle.'),
    'whaleTurn': (2.0, 0.5, False,
                  'A huge wooden stage flat swinging round on a pivot, and a deep breath.'),
    'swallow': (2.5, 0.5, False,
                'A roaring gulp, a rush of water and a thunder sheet.'),
    'caught': (1.6, 0.5, False,
               'Guards stamp trident butts twice on a stage and a drum roll stops.'),
    'barrelKnock': (0.5, 0.5, False,
                    'A hollow wooden knock of a boot landing on a floating barrel.'),
    'pianoPlink': (0.8, 0.5, False,
                   'One comic out-of-tune upright piano key.'),
    'boneTap': (0.3, 0.5, False,
                'A dry tap of a boot on bone.'),
    'acidSting': (1.0, 0.5, False,
                  'A wet fizz and sizzle, like seltzer on a hot plate.'),
    'hookSnag': (0.8, 0.5, False,
                 'A taut fishing line twanging and a small metal clink.'),
    'stoneFound': (1.5, 0.5, False,
                   'A pebble clicked in the hand, then a low warm chime.'),
    'whaleInhale': (3.0, 0.5, False,
                    'A vast slow breath in, like a huge bellows, with water surging up.'),
    'whaleExhale': (3.0, 0.5, False,
                    'A long low breath out with water draining.'),
    'lowTide': (2.0, 0.5, False,
                'Gurgling and dripping as water drains away, a squelch.'),
    'breathCue': (0.4, 0.5, False,
                  'A soft muffled timpani tick.'),
    'drip': (0.8, 0.5, False,
             'A single cavernous water drip echoing.'),
    'timberCreak': (1.0, 0.5, False,
                    'A wooden rocker creaking on its pivot.'),
    'swallowed': (2.0, 0.5, False,
                  'A deep stomach rumble and gulp.'),
    'daylight': (2.0, 0.5, False,
                 'An airy shimmer opening out, wind rushing in.'),
    'beachSurf': (3.0, 0.5, False,
                  'Surf breaking on rocks, with gulls.'),
    'crawlOut': (1.5, 0.5, False,
                 'Wet scrabbling and cloth dragging on stone.'),
    'revellerOut': (0.8, 0.5, False,
                    'A short squelch and a cheerful little grunt.'),
    'whaleSlide': (2.5, 0.5, False,
                   'A heavy slow scrape of a huge body over shingle into water.'),
    'tailSplash': (1.8, 0.5, False,
                   'A great whale tail slap and splash.'),
    'rockScrape': (0.6, 0.5, False,
                   'Boots and fingers scraping chalky rock, a small grit trickle.'),
    'stoneWarn': (1.2, 0.5, False,
                  'Dry dust and pebbles trickling down, like sand poured on card.'),
    'stoneFall': (1.0, 0.5, False,
                  'A fist-sized stone tumbling and clacking down.'),
    'stoneGlance': (0.4, 0.5, False,
                    'A stone glancing off rock with a sharp tick.'),
    'holdCrumble': (0.8, 0.5, False,
                    'A crust of plaster cracking and crumbling away.'),
    'fall': (0.8, 0.5, False,
             'A short slither down a rope, cloth rushing.'),
    'giantStep': (0.8, 0.5, False,
                  'A huge felt-padded boot thudding on wooden stage boards.'),
    'clifftop': (1.5, 0.5, False,
                 'A soft tuned chime and a gust of wind over grass.'),
    'fireRoar': (2.0, 0.5, False,
                 'A stage fire bursting up: a rush of shaken silk and a bellows whoosh.'),
    'houseOpen': (2.0, 0.5, False,
                  'A big hinged stage flat creaking open on old iron hinges.'),
    'fireCrackle': (2.0, 0.5, False,
                    'A stage fire of rattling silk and snapping twigs.'),
    'beamWarn': (1.2, 0.5, False,
                 'A ceiling shuddering: a timber groan and a dust sprinkle.'),
    'beamCrash': (1.2, 0.5, False,
                  'A burning wooden beam slamming onto boards with sparks.'),
    'debrisCrash': (1.2, 0.5, False,
                    'A cluster of stones thudding and scattering on wooden boards.'),
    'stoneThrow': (0.5, 0.5, False,
                   'A quick arm whoosh.'),
    'shutterSmash': (1.0, 0.5, False,
                     'A wooden shutter splintering, a latch flying off.'),
    'shutterLocked': (0.8, 0.5, False,
                      'A locked wooden shutter rattling against an iron bar.'),
    'liftHer': (1.0, 0.5, False,
                'A gasp and a swish of cloth.'),
    'floorBreak': (2.0, 0.5, False,
                   'Floorboards splitting and a wooden staircase collapsing in a rumble.'),
    'landing': (0.3, 0.5, False,
                'A light thump on wooden boards.'),
    'thud': (0.6, 0.5, False,
             'A heavy fall through a floor onto boards.'),
    'carryStep': (0.4, 0.5, False,
                  'One heavy slow footstep on wooden boards.'),
    'houseFall': (3.0, 0.5, False,
                  'A whole house toppling: a long timber-and-masonry rumble.'),
    'moonboatRise': (2.5, 0.5, False,
                     'Water parting, a harp glissando and a low tuned bell.'),
    'witchCackle': (2.2, 0.6, False,
                    "An old crone's wicked cackling laugh, a stage witch, harsh and mocking, a little reverb; no wind."),
    'victoryStinger': (7.0, 0.5, False,
                       'A short heroic victory flourish for a 1903 French silent fairy-tale film, played live by a small '
                       '1900s Parisian café-concert ensemble (cornet, clarinet, violin, cello and piano): the cornet sounds '
                       'a bright rising fanfare call, the violin and clarinet answer with a quick triumphant run, the piano '
                       'rolls a full chord, and all end together on a bold, held F major chord that rings and fades. Belle '
                       'Époque light music, theatrical and a little brassy, recorded in a small hall. About 76 BPM. '
                       'Instrumental, no drums, no synths, no modern harmony.'),
    'witchClaim': (2.0, 0.5, False,
                   "A woman's soft laugh over a magical shimmer."),
    'lampLit': (2.0, 0.5, False,
                'A match striking and a warm gentle musical swell.'),
    'stonePlop': (1.2, 0.5, False,
                  'A small stone plopping into water, rings lapping.'),
    'pageant': (2.5, 0.5, False,
                'A cymbal roll and pulleys whirring as a backcloth flies in.'),
    'pageantJoin': (0.4, 0.5, False,
                    "One light dancer's step and tap."),
    'pageantApplause': (3.0, 0.5, False,
                        'A small theatre audience applauding with a few cheers.'),
}


def generate(key, sid, seconds, influence, loop):
    if sid in MUSIC:
        req = urllib.request.Request(MUSIC_API, data=json.dumps({'prompt': SFX[sid][3], 'music_length_ms': int(seconds * 1000)}).encode(),
                                     method='POST', headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            raise SystemExit(f'{sid}: HTTP {e.code} {e.read()[:300]!r}')
    # The API accepts 0.5-30 s; shorter effects are trimmed in processing.
    body = {'text': SFX[sid][3], 'duration_seconds': max(0.5, seconds), 'prompt_influence': influence}
    if loop:
        body['loop'] = True
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method='POST', headers={
        'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if loop and e.code in (400, 422):  # older models reject `loop`
            return generate(key, sid, seconds, influence, False)
        raise SystemExit(f'{sid}: HTTP {e.code} {e.read()[:300]!r}')


def levels(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    get = lambda k: next((float(l.split(':')[1].split()[0]) for l in out.splitlines() if k in l), -91.0)
    return get('mean_volume'), get('max_volume')


def process(sid, loop):
    """Raw generation -> game asset: retune, warm roll-off, trim, level."""
    src, dest = os.path.join(RAW, sid + '.mp3'), os.path.join(OUT, sid + '.mp3')
    filters = []
    if TUNE.get(sid):
        filters.append(f'asetrate={44100 * 2 ** (TUNE[sid] / 12):.1f},aresample=44100')
    filters += ['highpass=f=40', 'lowpass=f=9000']
    if not loop:
        filters.append('silenceremove=start_periods=1:start_threshold=-50dB')
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', ','.join(filters),
                    '-ar', '44100', tmp], check=True)
    mean, peak = levels(tmp)
    gain = min(-19 - mean, -1.5 - peak)  # common loudness, never clipping
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.2f}dB',
                    '-b:a', '128k', dest], check=True)
    os.unlink(tmp)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force, only_process = '--force' in sys.argv, '--process' in sys.argv
    unknown = [a for a in args if a not in SFX]
    if unknown:
        raise SystemExit(f'unknown ids: {unknown}')
    key = os.environ.get('ELEVENLABS_API_KEY')
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    for sid, (seconds, influence, loop, _) in SFX.items():
        raw = os.path.join(RAW, sid + '.mp3')
        wanted = (force and (not args or sid in args)) or sid in args or not os.path.exists(raw)
        if wanted and not only_process:
            if not key:
                raise SystemExit('set ELEVENLABS_API_KEY to generate sound effects')
            for attempt in range(3):
                with open(raw, 'wb') as f:
                    f.write(generate(key, sid, seconds, influence, loop))
                if levels(raw)[1] > -40:  # a near-silent generation is rejected and retried
                    break
                print('near-silent, retrying', sid)
            print('generated', sid)
        if os.path.exists(raw) and levels(raw)[1] <= -40:
            print('skipped near-silent', sid)
            continue
        if os.path.exists(raw):
            process(sid, loop)
    m = json.load(open(MANIFEST))
    m['sfx'] = {sid: {'status': 'delivered' if os.path.exists(os.path.join(OUT, sid + '.mp3')) else 'standin',
                      'file': f'sfx/{sid}.mp3', 'loop': SFX[sid][2]} for sid in SFX}
    with open(MANIFEST, 'w') as f:
        json.dump(m, f, indent=2)
        f.write('\n')
    print('processed', len(m['sfx']), 'effects; manifest updated')


if __name__ == '__main__':
    main()
