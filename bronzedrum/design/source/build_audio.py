#!/usr/bin/env python3
"""Bronze Drum audio: sound effects from ElevenLabs, and the music requests.

    python3 bronzedrum/design/source/build_audio.py               # write docs + manifest
    python3 bronzedrum/design/source/build_audio.py --generate    # also generate missing SFX
    python3 bronzedrum/design/source/build_audio.py --generate --force drum-tung
    python3 bronzedrum/design/source/build_audio.py --music       # process delivered music
    python3 bronzedrum/design/source/build_audio.py --check       # verify docs, manifest, files

Generation needs an ElevenLabs key in ELEVENLABS_API_KEY, or in
~/.config/elevenlabs.key. The key is never written into the repository.

Outputs:
    bronzedrum/design/sound-effects.md    - every effect, its prompt and use
    bronzedrum/design/music-requests.md   - prompts for the score
    bronzedrum/game/assets/sfx/*.mp3      - processed effects (generated)
    bronzedrum/game/assets/music/*.mp3    - processed music, from design/music-masters/
    bronzedrum/design/source/music-loops.json - each track's measured loop points
    bronzedrum/game/assets/audio.json     - what the game loads
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SFX_DIR = ROOT / "game" / "assets" / "sfx"
MUSIC_DIR = ROOT / "game" / "assets" / "music"
# Delivered tracks exactly as generated (not published), named by request id.
MUSIC_MASTERS = ROOT / "design" / "music-masters"
MUSIC_LOOPS = Path(__file__).resolve().parent / "music-loops.json"
MUSIC_LUFS = -17.0  # every track is matched to this integrated loudness
AUDIO_MANIFEST = ROOT / "game" / "assets" / "audio.json"
SFX_DOC = ROOT / "design" / "sound-effects.md"
WORKBENCH = ROOT / "workbench" / "sounds.json"
MUSIC_DOC = ROOT / "design" / "music-requests.md"
API = "https://api.elevenlabs.io/v1/sound-generation"

# ------------------------------------------------------------------ sound effects
#
# id, prompt, seconds, prompt influence, variants, kind, use
# kind: "hit" (onset trimmed to 0 ms, mono), "oneshot" (mono), "loop" (stereo,
# crossfaded so it loops cleanly), "sting" (stereo).

SFX: list[dict] = []


def sfx(group, sid, prompt, seconds, use, influence=0.5, variants=1, kind="oneshot", gain=1.0, post=None,
        keep_level=False):
    # keep_level: the post chain sets the level itself (a tamed bed is not
    # raised back to full scale by its quieter peaks).
    SFX.append(dict(group=group, id=sid, prompt=prompt, seconds=seconds, use=use,
                    influence=influence, variants=variants, kind=kind, gain=gain, post=post,
                    keep_level=keep_level))


# Generated files that failed review. They are not loaded, and --generate does
# not remake them unless forced (then remove the entry here if the new take is good).
REJECTED = {
    "sfx/kit-bamboo-high-1.mp3": "two takes, both with a second bounce of the beater; the other take, trimmed, is clean",
    "sfx/drum-tung-2.mp3": "eight takes, none both a single stroke and deep (more energy under 200 Hz than over 2 kHz); "
    "the model drifts to a bright metallic hit, and two good deep strokes give enough variety",
}


G = "The drum"
sfx(G, "drum-tung",
    "One strong stroke with a padded wooden beater on the centre of a large ancient Vietnamese "
    "bronze kettle drum: a deep round boom followed by a shimmering metallic bronze ring. A single "
    "hit, close-miked, dry room, no music.",
    2.0, "Trưng Trắc's centre stroke (tùng), played on every left-hand input.",
    influence=0.7, variants=3, kind="hit")
sfx(G, "drum-cac",
    "One sharp stroke of a hardwood stick on the rim of a bronze kettle drum: a bright, dry, "
    "metallic click with a short ring. A single hit, close-miked, no music.",
    0.7, "Trưng Nhị's rim stroke (cắc), played on every right-hand input and flourish.",
    influence=0.7, variants=3, kind="hit",
    # The model tends to add body and ring; a rim stroke must be short and bright.
    post="highpass=f=400,highpass=f=400,atrim=0:0.32,afade=t=out:st=0.12:d=0.2")
# The companion drums of the touch buttons (and the shield and reset inputs).
sfx(G, "drum-chau",
    "One heavy stroke of a padded wooden beater on the centre of a large Vietnamese barrel "
    "drum (trống chầu) with a thick buffalo-hide head: a deep, warm, dry thud with a short "
    "low boom, no metal ring. A single hit, close-miked, dry room, no music.",
    1.2, "The shield: a stroke on the big hide barrel drum beside the bronze drum, under the "
    "shields locking (A / Space / the Shield drum).",
    influence=0.7, variants=2, kind="hit", gain=0.9)
sfx(G, "drum-mo",
    "One knock of a wooden mallet on a hollow Vietnamese wooden slit drum (mõ, a temple "
    "block): a round, dry, woody 'tok' with a tiny hollow resonance. A single hit, "
    "close-miked, no music.",
    0.5, "Reset the rhythm: a knock on the wooden slit drum (Y / R / the Reset drum).",
    influence=0.7, variants=2, kind="hit", gain=0.8)
sfx(G, "drum-wake",
    "A huge bronze gong struck softly and swelling: a rising shimmering bronze resonance that "
    "blooms and slowly fades, ceremonial and awe-struck.",
    4.0, "The drum wakes: four commands chained.", kind="sting", gain=0.8)
sfx(G, "stumble",
    "A dull, slightly off-key wooden knock, clumsy and muted, very short.",
    0.5, "A stroke during the army's answer, or off the beat.", kind="hit", gain=0.7)

G = "Drum practice: the kits"
# Drum Practice lets the player swap the bronze drum for another pair of
# instruments; every kit has a low voice (Trắc's side, L) and a high one (R).
# The bronze drum and the barrel drum and mõ reuse the samples above.
sfx(G, "kit-com-low",
    "One stroke of the flat palm on the large head of a Vietnamese rice drum (trống cơm), a "
    "long two-headed wooden barrel drum tuned with rice paste: a warm, round, pitched low "
    "'bùng' tone that sings briefly. A single hit, close-miked, dry room, no music.",
    1.0, "Rice drum kit, low voice (Drum Practice).", influence=0.7, variants=2, kind="hit")
sfx(G, "kit-com-high",
    "One quick slap of the fingers on the small head of a Vietnamese rice drum (trống cơm): a "
    "bright, tight, pitched high 'tang' tone, short. A single hit, close-miked, dry room, no music.",
    0.6, "Rice drum kit, high voice (Drum Practice).", influence=0.7, variants=2, kind="hit")
sfx(G, "kit-gong-low",
    "One strike of a padded mallet on a large flat bronze gong of the Vietnamese Central "
    "Highlands (cồng chiêng): a deep, warm, humming bronze tone that rings and fades. A single "
    "hit, close-miked, no music.",
    2.0, "Gong kit, low voice (Drum Practice).", influence=0.7, variants=2, kind="hit", gain=0.85)
sfx(G, "kit-gong-high",
    "One sharp strike of a hard mallet on the boss of a small bronze gong (chiêng): an "
    "instant, bright, clear, high-pitched bronze tone with a medium ring, loudest at the very "
    "start. A single hit, close-miked, no music.",
    1.4, "Gong kit, high voice (Drum Practice).", influence=0.7, variants=2, kind="hit", gain=0.8,
    # The model holds the tone flat; a struck gong dies away, and quick strokes must not smear.
    post="afade=t=out:st=0.02:d=1.2:curve=exp")
sfx(G, "kit-bamboo-low",
    "One strike of a soft wooden beater on a large bamboo tube of a Vietnamese bamboo "
    "xylophone (đàn t'rưng): a hollow, woody, pitched low 'tok' with a short resonant ring. A "
    "single hit, close-miked, dry room, no music.",
    0.8, "Bamboo kit, low voice (Drum Practice).", influence=0.7, variants=2, kind="hit")
sfx(G, "kit-bamboo-high",
    "One sharp strike of a small hard wooden beater on the shortest, thinnest bamboo tube of a "
    "đàn t'rưng: a bright, hollow, high-pitched woody 'tik', very short, an octave above a "
    "large tube. Exactly one hit, close-miked, dry room, no music.",
    0.5, "Bamboo kit, high voice (Drum Practice).", influence=0.7, variants=2, kind="hit",
    # Cut before the tube's bounce, so quick strokes stay clean.
    post="atrim=0:0.25,afade=t=out:st=0.06:d=0.19")
sfx(G, "kit-lan-drum",
    "One heavy stroke of a wooden stick on the centre of a big Vietnamese lion-dance drum "
    "(trống lân): a booming, punchy, low drum hit with a little buzz of the skin, no metal. A "
    "single hit, close-miked, dry room, no music.",
    1.0, "Lion-dance kit, low voice (Drum Practice).", influence=0.7, variants=2, kind="hit")
sfx(G, "kit-lan-cymbal",
    "One clash of a pair of small brass hand cymbals (chũm chọe) in a lion dance: a bright, "
    "splashy, brassy crash, cut short. A single clash, close-miked, no music.",
    0.8, "Lion-dance kit, high voice (Drum Practice).", influence=0.7, variants=2, kind="hit", gain=0.7,
    post="atrim=0:0.6,afade=t=out:st=0.25:d=0.35")

G = "The army answers"
sfx(G, "call",
    "A group of women warriors shouting one short unison battle cry, 'Hô!', outdoors, fierce and "
    "together, a single shout.",
    0.9, "Beats 1 and 3 of every answer, under the command's own sound.", variants=3, kind="hit", gain=0.6)
sfx(G, "cmd-march",
    "A company of barefoot soldiers marching in step through the shallow water of a rice paddy: "
    "rhythmic splashing and squelching footsteps.",
    2.5, "Tiến (march) answer.")
sfx(G, "cmd-strike",
    "Bronze-tipped spears thrusting and clashing against wooden shields and armour, a short "
    "fierce skirmish of a small group, no voices.",
    2.5, "Đánh (strike) answer.")
sfx(G, "cmd-shield",
    "Many round wooden and hide shields raised together and locked with one heavy hollow thump.",
    1.5, "The guard: shields thrown up against a blow (A / Space).")
sfx(G, "cmd-rally",
    "A group of women ululating and cheering together outdoors, a rallying cry rising and "
    "falling.",
    2.5, "The women cheer when the drum wakes (four commands chained).", gain=0.8)
sfx(G, "cmd-charge",
    "A war elephant trumpets loudly, then charges: heavy thundering footsteps that shake the "
    "ground.",
    3.0, "The elephant charge: a strike on a waking drum in chapter 3.")

G = "Battle"
sfx(G, "volley",
    "A volley of arrows released from several bows at once, whooshing away through the air.",
    1.5, "The archers shoot on a strike.", gain=0.7)
sfx(G, "bolts",
    "Several crossbow bolts fired and thudding into wooden shields, quick hollow thunks.",
    1.5, "Han crossbows and the fort fire.", gain=0.8)
sfx(G, "hit-paper",
    "A sharp quick tear of thick handmade paper, a single rip.",
    0.6, "Every hit: in this game wounds are paper tearing.", variants=3, kind="hit", gain=0.9)
sfx(G, "hit-straw",
    "A spear stabbing into a bundled straw training dummy: a dry rustling thud.",
    0.7, "Hits on the straw targets in chapter 1.", kind="hit")
sfx(G, "defeat-han",
    "A soldier's lamellar armour and halberd clattering to the ground, metal plates rattling.",
    1.2, "A Han soldier falls.", gain=0.8)
sfx(G, "fort-break",
    "A wooden palisade of sharpened stakes splintering and collapsing, a long timber crash.",
    3.0, "The fort falls.")
sfx(G, "trample",
    "A heavy elephant stomp crushing wood, a deep ground-shaking impact.",
    1.2, "The elephant charge lands.", kind="hit")
sfx(G, "wound",
    "Arrows striking wooden shields and a few soft pained gasps from a group of women.",
    1.0, "The army is hit while its shields are down.", gain=0.6)
sfx(G, "blocked",
    "Arrows glancing off raised bronze-studded shields, light metallic ticks.",
    1.0, "The army is hit with shields raised.", gain=0.6)

G = "Interface"
sfx(G, "ui-move",
    "A soft rustle of a single sheet of rice paper being turned, very short and quiet.",
    0.5, "Moving focus in menus. Halved (too prominent while browsing).", kind="hit", gain=0.25)
sfx(G, "ui-confirm",
    "A small hardwood clapper knock, clean and single, like a temple woodblock.",
    0.5, "Choosing a menu item. Its tail carried a hiss (heard on the workbench): denoised and cut "
    "short after the knock. Played quieter (too prominent while browsing).", kind="hit", gain=0.35,
    post="afftdn=nr=20:nf=-45,atrim=0:0.2,afade=t=out:st=0.07:d=0.13")
sfx(G, "ui-back",
    "A sheet of paper sliding softly across a wooden table, short.",
    0.5, "Closing a menu or dialog. Too prominent (heard on the workbench): shortened, softened "
    "and played quieter, then halved again (still too loud in play).", kind="hit", gain=0.15,
    post="atrim=0:0.3,lowpass=f=5500,afade=t=in:d=0.02,afade=t=out:st=0.08:d=0.22")
sfx(G, "ui-start",
    "A single resonant strike on a small bronze gong, ringing out.",
    2.5, "Press Start. It carries a faint static (heard on the workbench); three cleaner takes "
    "wait on the workbench as candidates.", kind="sting", gain=0.7)

sfx(G, "village-wakes",
    "A riverside village wakes at night: a bronze gong struck once in the distance, then a "
    "small crowd of villagers calling out joyfully together, and a hand drum rolling briefly "
    "in answer, all echoing over the water.",
    3.0, "The Villages Answer: a village answers and lights its lanterns.", kind="sting", gain=0.75)

G = "Stings"
sfx(G, "victory",
    "A triumphant flourish on large bronze drums and gongs, building quickly and ending on one "
    "ringing gong stroke.",
    4.5, "A chapter is won.", kind="sting")
sfx(G, "defeat",
    "A low bronze gong struck softly once, fading slowly with sorrow, a breath of wind after.",
    4.5, "A chapter is lost.", kind="sting")

G = "Story chapters"
sfx(G, "pour",
    "Molten bronze poured from a clay crucible into a mould: a thick glugging pour with hissing "
    "steam and crackling.",
    2.5, "Casting the Drums: a steady phrase pours bronze.", gain=0.8)
sfx(G, "crack",
    "A clay casting mould cracking from the heat: one sharp crack, then crumbling pieces and a "
    "hiss of steam.",
    1.5, "Casting the Drums: a phrase that drifts cracks the mould.")
sfx(G, "lantern",
    "A paper lantern being lit at night: a soft whoosh of flame catching, then one small clear "
    "bronze bell.",
    1.5, "The Oath and The Villages Answer: an answered call lights incense or lanterns.", gain=0.7)
sfx(G, "crowd-cheer",
    "A festival crowd in an ancient village square cheering and clapping with joy, a few small "
    "gongs ringing.",
    3.0, "The Coronation: the crowd answers each rhythm.", gain=0.7)

sfx(G, "dancer-join",
    "A single joyful shout of 'hey!' from a villager joining a dance by a fire, with two or three "
    "quick hand claps and a jingle of small ankle bells, outdoors at dusk. Short, no music, no drums.",
    1.5, "Drum Practice: a dancer walks in to join the dance.", variants=2, gain=0.55)

sfx(G, "han-horn",
    "Several ancient war horns made of buffalo horn blown together in the distance across a "
    "river, a low ominous call that swells and fades, an army approaching.",
    3.0, "Mã Viện Returns: a new Han column arrives.", gain=0.7)

G = "Ambience"
sfx(G, "amb-garden",
    "Peaceful dawn in a northern Vietnamese garden by a lotus pond: songbirds, gentle trickling "
    "water, a distant rooster, a light breeze through bamboo. Continuous, no music.",
    20.0, "Chapter 1 bed, looped. Its bird calls spiked up to 36 dB over the bed (heard as "
    "distortion through the master limiter); a fast compressor holds them to about 18 dB over it "
    "and a gentle low-pass softens their edge, the bed itself unchanged.", kind="loop", gain=0.45,
    post="acompressor=threshold=-30dB:ratio=5:attack=1:release=100:knee=4,lowpass=f=9500,"
         "alimiter=limit=0.8:level=false,volume=1.1dB", keep_level=True)
sfx(G, "amb-river",
    "Daytime on the bank of a wide slow river: flowing water, wind in tall reeds, distant herons "
    "and birds. Continuous, no music, no drums.",
    20.0, "Chapter 2 bed, looped.", kind="loop", gain=0.45)
sfx(G, "amb-foundry",
    "Blacksmith's forge ambience recorded outdoors, traditional and hand-powered: crackling "
    "coal fire, slow leather bellows whooshing, hot metal hissing now and then, crickets far "
    "off. Natural, no machinery, no electrical hum, no music.",
    20.0, "Casting the Drums bed, looped. Chosen from six takes as the least tonal (the old "
    "take had a steady hum that read as a machine); looped with a 3 s crossfade and raised "
    "7 dB under a soft limiter.", kind="loop", gain=0.45, post="lowpass=f=9000")
# Beds chosen on the workbench (alternate takes, levelled to ALT_LUFS).
sfx(G, "amb-village", 'Night on the Red River delta: a loud chorus of rice-paddy frogs and toads croaking, crickets, water lapping against bamboo boats. Calm.',
    20.0, "The Villages Answer bed, looped: the workbench take villages-frogs, chosen over the "
    "old cricket bed (muffled and metallic).", kind="loop", gain=0.55, keep_level=True)
sfx(G, "amb-elegy", 'A very quiet grey dawn by a still river: a single bird singing far away, soft wind, water barely lapping, the low distant roar of a furnace. Melancholy and sparse.',
    20.0, "The Drums Are Melted bed, looped: the workbench take elegy-dawn (the chapter used to "
    "borrow the river bed).", kind="loop", gain=0.55, keep_level=True)
sfx(G, "amb-practice", "Dusk at the edge of a Vietnamese village: a soft breeze in bamboo, a water buffalo's wooden bell far off in the fields, a few birds settling for the night, a far-off frog. Peaceful. No insects. Real outdoor field recording, no music, no drums, no clear words.",
    20.0, "Drum Practice bed (the village green at dusk), looped: the workbench take practice-dusk-2.",
    kind="loop", gain=0.55, keep_level=True)
sfx(G, "amb-fire", 'A bonfire crackling gently in the open at dusk, a soft breeze through palm leaves, distant frogs. Warm and calm. No insects. Real outdoor field recording, no music, no drums, no clear words.',
    20.0, "Drum Practice: the bonfire on the green, a second layer over the bed whose level follows "
    "the fire (louder as the drumming builds): the workbench take practice-fire-2.",
    kind="loop", gain=0.5, keep_level=True)
sfx(G, "amb-coronation", 'A festive crowd in a village square in Vietnam on a sunny day: the lively murmur of hundreds of people, children laughing, vendors calling in the distance, cloth banners flapping in the breeze.',
    20.0, "The Coronation bed, looped: the workbench take coronation-crowd, a festival crowd (the "
    "chapter used to borrow the dawn garden bed).", kind="loop", gain=0.5, keep_level=True)
sfx(G, "breeze",
    "A soft, warm breeze blowing in gentle gusts through an open courtyard, rustling leaves "
    "lightly. Continuous, airy and natural, no whistling, no howling, no music.",
    8.0, "The Oath: the breeze stirred by holding A or Y, faded with the wind.", kind="loop", gain=0.6,
    post="lowpass=f=6000")
sfx(G, "amb-night",
    "Night in the countryside outside a walled town: crickets, frogs croaking in flooded rice "
    "paddies, distant torches crackling, a faint wind. Continuous, no music.",
    20.0, "Chapter 3 bed, looped.", kind="loop", gain=0.45)


# ------------------------------------------------------------------ alternate ambience takes
#
# Candidate beds for the chapters, to audition on the workbench
# (bronzedrum/workbench/) next to the bed in use. Not loaded by the game: they
# live in workbench/alt/, are generated with --alternates, and every take is
# levelled to ALT_LUFS so takes compare fairly. When one is chosen, it becomes
# that chapter's bed in the SFX list above.

ALT_DIR = ROOT / "workbench" / "alt"
# The buzz: the takes heard as metallic, synthetic or "radio buzz" all carry a
# comb of steady tones at exact multiples of 200 Hz (with weaker ones at 100 Hz
# steps), up to 15 dB over their neighbourhood; the takes kept have little.
# A narrow notch at every 100 Hz step removes it and changes the loudness by
# under 1 dB. DEBUZZ is applied to new takes that carry it and to the
# de-buzzed copies below.
DEBUZZ = ",".join(f"equalizer=f={100 * k}:t=h:w=6:g=-24" for k in range(1, 80))
ALT_LUFS = -22.0
ALTERNATES: list[dict] = []
NO = " Real outdoor field recording, no music, no drums, no clear words."


def alt(chapter, aid, prompt, debuzz=False, derived_from=None):
    """derived_from: a de-buzzed copy of an existing take (made once, not generated)."""
    ALTERNATES.append(dict(chapter=chapter, id=aid, prompt=prompt + ("" if derived_from else NO), seconds=20.0,
                           influence=0.5, kind="loop", gain=0.45, derived_from=derived_from,
                           post="lowpass=f=11000" + ("," + DEBUZZ if debuzz else "")))


alt("garden", "garden-birds",
    "Dawn in a garden in northern Vietnam: red-whiskered bulbuls and magpie-robins singing close "
    "by, an Asian koel calling in the distance, a rooster far off, water trickling into a lotus pond.")
alt("garden", "garden-pond",
    "Early morning beside a lotus pond in a Vietnamese village: a frog plopping into the water now "
    "and then, dragonflies buzzing past, sparrows chirping in the eaves, bamboo creaking softly in "
    "a light breeze.")
alt("garden", "garden-buffalo",
    "A quiet dawn courtyard in the Vietnamese countryside: doves cooing softly, distant roosters, a "
    "water buffalo's wooden bell clonking far off in the fields, leaves rustling. Sparse and peaceful.")
alt("casting", "casting-furnace",
    "Night at an ancient open-air bronze foundry: a big charcoal furnace roaring and crackling, "
    "embers popping, molten metal hissing on wet clay, workers' voices murmuring far away. No "
    "machinery, no hammering.")
alt("casting", "casting-charcoal",
    "A charcoal fire burning hot in a clay furnace outdoors at night: the deep steady roar of "
    "flames, the crackle and pop of charcoal, sparks, an occasional hiss of steam, crickets far "
    "off. No machinery, no rhythm.")
alt("outpost", "outpost-cicadas",
    "A hot afternoon on a riverbank: a loud shimmering chorus of cicadas in the trees, slow water "
    "flowing, wind in the reeds, a crow cawing far off.")
alt("coronation", "coronation-market",
    "A sunny festival morning in a market square: a gentle bustle of people, footsteps, laughter, a "
    "rooster, sparrows, a light wind. Cheerful.")
alt("mavien", "mavien-wind",
    "Evening wind over a wide river at dusk: fast-flowing water, gusts in the reeds, crows calling, "
    "the faint distant murmur of a large crowd across the water. Grave and tense.")


# Music trials: ElevenLabs' music model tried on a request, as an experiment
# (it costs many credits, so one short take at a time). Kept in
# workbench/music-trials/, levelled like the delivered tracks, for the user to
# judge on the workbench; not used by the game.
MUSIC_API = "https://api.elevenlabs.io/v1/music"
TRIAL_DIR = ROOT / "workbench" / "music-trials"
MUSIC_TRIALS: list[dict] = [
    dict(id="mu-anthem-trial-1", request="mu-anthem", seconds=90,
         prompt="A 90-second excerpt of a folk ballad sung in Vietnamese for a video game about the Trưng "
                "sisters, two queens who led an army of women against Han rule in ancient Vietnam around 40 CE. "
                "Traditional northern Vietnamese style with a modern cinematic folk production. Open with "
                "16-string zither (đàn tranh) alone, then one verse sung by a single woman, gentle and proud, "
                "then a chorus by two women in close quan họ-style harmony over deep bronze kettle drums, soft "
                "strings and bamboo flute (sáo trúc). 84 BPM, D minor pentatonic. Sing on Vietnamese vocables "
                "(à ơi, hò), no English. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, "
                "shakuhachi), rock or trap drums, EDM drops and trailer-style braams."),
    # The same song with no singing: the instruments may work even if the voices do not.
    dict(id="mu-anthem-trial-2-instrumental", request="mu-anthem", seconds=90,
         prompt="A 90-second instrumental folk piece, no vocals at all, for a video game about the Trưng "
                "sisters, two queens who led an army of women against Han rule in ancient Vietnam around 40 CE. "
                "Traditional northern Vietnamese instruments with a modern cinematic folk production. Open with "
                "16-string zither (đàn tranh) alone; the monochord (đàn bầu) then plays a slow, proud, singing "
                "melody; for the second half the bamboo flute (sáo trúc) answers it over deep bronze kettle drums, "
                "a low gong and soft strings, rising to a warm full ensemble, then settles. 84 BPM, D minor "
                "pentatonic. Instrumental only. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, "
                "pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams."),
]


def trial_file(t):
    return TRIAL_DIR / f"{t['id']}.mp3"


def generate_music_trial(t, key):
    body = {"prompt": t["prompt"], "music_length_ms": int(t["seconds"] * 1000), "model_id": "music_v1"}
    req = urllib.request.Request(MUSIC_API, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as res:
            raw = res.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{t['id']}: ElevenLabs music returned {e.code}: {e.read()[:400]!r}")
    out = trial_file(t)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".mp3") as tmp:
        tmp.write(raw)
        tmp.flush()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "2", "-ar", "44100",
                        "-b:a", "160k", str(out)], check=True)
    level_to(out, MUSIC_LUFS)


# What measuring each take found (level every 10 ms: the strongest repeating
# pulse, and how far it swings between quiet and loud), shown on the workbench.
ALT_NOTES = {
    "garden-birds": "very uneven: 43 dB between its quiet and loud moments; may have near-silent gaps",
    "casting-workshop": "uneven: 28 dB swings, loud sizzles a quarter of the time",
    "coronation-gate": "uneven: 25 dB swings, cheers rising a quarter of the time",
    "coronation-market": "uneven: 25 dB swings",
    "oath-wake": "uneven: 22 dB swings",
    "practice-village": "uneven: 22 dB swings",
    "mavien-army": "uneven: 26 dB swings, a fast clatter",
    "villages-boat": "a faint steady pulse about every 0.5 s (a creak or a croak): listen with Drum along",
    "luylau-moat": "a faint steady pulse about every 0.75 s (frogs)",
    "casting-furnace": "very even: a steady roar",
    "mavien-wind": "very even: steady wind and water",
    "villages-geckos": "very even",
    "villages-frogs": "very even",
    "outpost-ford": "very even",
}


# Takes heard on the workbench and turned down (the user's notes). What failed:
# insects (crickets, cicadas, geckos) came out metallic or buzzing; voices and
# laughter sounded artificial; anything with distinct events (horses, carts,
# cheers) was not an ambience. What worked: frogs, flowing water, wind in
# reeds, a sparse dawn bird, a furnace. The second round leans on those.
ALT_REJECTED = {
    "oath-gecko": "almost, but synthetic and metallic",
    "oath-temple": "the insects were good, then metallic, synthetic sounds",
    "oath-wake": "just a low buzz",
    "casting-workshop": "too specific: events, not an ambience",
    "villages-boat": "muffled",
    "villages-geckos": "a metallic buzz",
    "outpost-ford": "something synthetic in it",
    "outpost-wind": "wind on a microphone",
    "luylau-torches": "sounds like driving in a car",
    "luylau-moat": "a synthetic buzz",
    "luylau-camp": "radio buzz",
    "coronation-gate": "too uneven: fire, children, random cheers",
    "mavien-army": "not ambient: mostly horses",
    "mavien-line": "not ambient: footsteps and carts",
    "elegy-embers": "a highway in the distance behind the fire",
    "elegy-lotus": "radio buzz",
    "practice-village": "AI artefacts; the laughter is not natural",
    "practice-festival": "not ambient: a person laughing close to the microphone",
    "amb-mourning-clean": "still a high-pitched synthetic sound, de-buzzed or not (the Oath now has no ambience)",
}

alt("oath", "oath-dusk-2",
    "A still dusk in a quiet countryside courtyard: a soft breeze through banana and bamboo "
    "leaves, a slow trickle of water from a stone basin, a distant bird calling once or twice. "
    "Calm and solemn. No insects, no hum.", debuzz=True)
alt("oath", "oath-rain-2",
    "Light evening rain falling softly on a tiled roof and on broad leaves in a quiet "
    "courtyard, a few drips into a stone jar, gentle and steady. No thunder, no insects.", debuzz=True)
alt("oath", "oath-pond-2",
    "Dusk beside a still lotus pond: an occasional frog calling softly, water barely moving, a "
    "soft breeze in the reeds, a far-off bird. Sparse and quiet. No insects.", debuzz=True)
alt("luylau", "luylau-frogs-2",
    "Night beside the flooded rice paddies outside an old town: a chorus of frogs and toads "
    "croaking, a gentle wind, water lapping at the edge of a moat. Calm but watchful. No "
    "insects, no traffic.", debuzz=True)
alt("luylau", "luylau-wind-2",
    "A warm night wind blowing across open fields and through tall grass by a river, distant "
    "frogs, leaves rustling. No insects, no rumble.", debuzz=True)
alt("mavien", "mavien-river-2",
    "Dusk on the bank of a wide, slow river: calm flowing water, a cool wind through tall "
    "reeds, a few crows calling far off. Grave and quiet. No insects.", debuzz=True)
alt("coronation", "coronation-crowd-2",
    "A large festive crowd murmuring happily at a distance in an open square on a sunny day, "
    "steady and even, no single voice standing out, flags flapping softly in the wind. No "
    "cheering bursts.")


# Candidate takes of effects, for the workbench (not loaded by the game) until one is chosen.
CANDIDATE_DIR = ROOT / "workbench" / "alt-sfx"
CANDIDATES: list[dict] = [
    dict(effect="ui-start", id=f"ui-start-new-{i}", seconds=2.5, influence=0.7, kind="sting",
         prompt="A single strike of a soft mallet on a small bronze gong, ringing out clear and pure "
                "and fading to silence. Clean studio recording, close-miked, silent background, no "
                "hiss, no noise, no room rumble, no music.")
    for i in (1, 2, 3)
]


for chapter, aid, source, heard in [
    ("oath", "oath-gecko-clean", "the turned-down take oath-gecko", "almost, but synthetic and metallic"),
    ("oath", "oath-temple-clean", "the turned-down take oath-temple", "insects good, then metallic sounds"),
    ("luylau", "amb-night-clean", "Luy Lâu's bed amb-night", "a bit synthetic"),
    ("luylau", "luylau-moat-clean", "the turned-down take luylau-moat", "a synthetic buzz"),
    ("outpost", "outpost-cicadas-clean", "the take outpost-cicadas", "almost, but a bit synthetic"),
    ("villages", "amb-village-clean", "the Villages bed amb-village (frogs, kept)", "kept"),
    ("garden", "amb-garden-clean", "the garden bed amb-garden", "okay apart from loud birds (since tamed)"),
]:
    alt(chapter, aid, f"De-buzzed copy of {source} (heard as: {heard}): the 200 Hz comb notched out.",
        derived_from=source)


def alt_file(a):
    return ALT_DIR / f"{a['id']}.mp3"


def level_to(path: Path, lufs: float):
    """Bring a take to the given integrated loudness, peaks held under -1 dBFS."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    measured = float([l for l in err.splitlines() if l.strip().startswith("I:")][-1].split()[1])
    tmp = path.with_suffix(".tmp.mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af",
                    f"volume={lufs - measured:.2f}dB,alimiter=limit=0.89:level=false", "-ac", "2", "-ar", "44100",
                    "-b:a", "128k", str(tmp)], check=True)
    tmp.replace(path)


def build_workbench():
    """The workbench's catalogue: every effect and take, the music, and the alternate beds."""
    def present(f):
        return (ROOT / "game" / "assets" / f).exists()
    sfx = [dict(id=s["id"], group=s["group"], use=s["use"], prompt=s["prompt"], kind=s["kind"], gain=s["gain"],
                files=[dict(file=f, rejected=REJECTED.get(f)) for f in files_for(s) if present(f)])
           for s in SFX]
    music = [dict(id=m["id"], title=m["title"], kind=m["kind"], file=f"music/{m['id']}.mp3")
             for m in MUSIC if present(f"music/{m['id']}.mp3")]
    alts = [dict(id=a["id"], chapter=a["chapter"], prompt=a["prompt"], file=f"alt/{a['id']}.mp3",
                 measured=ALT_NOTES.get(a["id"], ""))
            for a in ALTERNATES if alt_file(a).exists()]
    for e in sfx:
        e["candidates"] = [dict(id=c["id"], prompt=c["prompt"], file=f"alt-sfx/{c['id']}.mp3")
                           for c in CANDIDATES if c["effect"] == e["id"] and (CANDIDATE_DIR / f"{c['id']}.mp3").exists()]
    trials = [dict(id=t["id"], request=t["request"], prompt=t["prompt"], file=f"music-trials/{t['id']}.mp3")
              for t in MUSIC_TRIALS if trial_file(t).exists()]
    return json.dumps({"generatedBy": "bronzedrum/design/source/build_audio.py", "altLufs": ALT_LUFS,
                       "sfx": sfx, "music": music, "alternates": alts, "musicTrials": trials}, indent=2, ensure_ascii=False) + "\n"


# ------------------------------------------------------------------ music

# ------------------------------------------------------------------ music
#
# The player drums at their own speed, so nothing that plays *during* a
# chapter has a beat: those tracks are beatless beds and a swell. Melody and
# metre belong to the menus, the results and the ending. Every prompt is
# complete on its own: paste it as it stands.

MUSIC_NOTE = (
    "Bronze Drum is a rhythm game: the player drums at any speed they like (about 45 to 200 "
    "BPM) and the army's drums answer at that speed. A second, fixed beat under the drumming "
    "would fight it, so the music that plays during a chapter is beatless: free time, no pulse, "
    "no percussion keeping time. Themes with melody and metre play only where nobody is "
    "drumming: on the title, the chapter select, the results and the ending."
)

AVOID = (
    "Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), "
    "rock or trap drums, EDM drops and trailer-style braams."
)

# id, title, kind, when it plays, length, loop, style tags (short), prompt (complete)
MUSIC: list[dict] = []


# priority: "core" (needed now), "maybe", or "optional" (the game falls back
# to a core track, or plays nothing, until an optional one is delivered).
def track(mid, title, kind, plays, length, loop, tags, prompt, status="requested", priority="optional"):
    MUSIC.append(dict(id=mid, title=title, kind=kind, plays=plays, length=length, loop=loop, priority=priority,
                      tags=tags, prompt=prompt, status=status))


GAME = ("for a video game about the Trưng sisters, who led an army of women in an uprising "
        "against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre")
BEATLESS = ("Completely beatless and in free time: no pulse, no metre, no drums or percussion "
            "keeping time, so a player can drum on top at any speed. It must loop seamlessly: "
            "end where it began, with no fade-out and no silence at either end.")

# ---- menus

track("mu-title", "Trống Đồng (title theme)", "theme",
      "Under chapter 4, The Villages Answer, until its own bed arrives (it was the title theme; "
      "the anthem took the menus). Its quan họ call and answer suits the chapter, and measured "
      "its pulse is no stronger than the shared beds'.",
      "about 90 s", True,
      "vietnamese quan ho, sao truc flute, dan tranh zither, bronze gong, female voice, soft cinematic strings, 72 bpm, folk theme",
      f"A slow, proud and tender title theme {GAME}. Traditional northern Vietnamese style "
      "rooted in quan họ folk song from Bắc Ninh: a bamboo flute (sáo trúc) states the main "
      "melody in D minor pentatonic over rippling 16-string zither (đàn tranh) arpeggios; a soft "
      "bronze gong marks each phrase; halfway through a solo woman's voice sings the melody back "
      "on wordless vocables (à ơi) in quan họ manner; a quiet bed of modern cinematic strings "
      "swells underneath without taking over. 72 BPM in 4/4. About 90 seconds, built to loop: the "
      f"last bar leads back into the first, no fade-out. No lyrics. {AVOID}", priority="core")
track("mu-select", "Two Sisters (chapter select)", "theme",
      "Under chapter 1, the Garden, until its own bed arrives (it was the chapter-select theme; "
      "the anthem took the menus): the two sisters practising. Measured, its pulse is no "
      "stronger than the shared beds'. Also on Drum Practice's screen of modes.",
      "about 90 s", True,
      "vietnamese folk duet, dan tranh and sao truc, two intertwining themes, gentle, light ambient pad, 66 bpm",
      f"A tender theme about two sisters {GAME}. Traditional Vietnamese folk duet: the elder "
      "sister's theme on the 16-string zither (đàn tranh) is steady, dignified and on the beat; "
      "the younger sister's theme on the bamboo flute (sáo trúc) is quick, playful and bends "
      "around the beat; they take turns, tease each other, then play together in harmony in C "
      "major pentatonic. A light modern ambient pad gives warmth underneath. 66 BPM, gentle and "
      "a little bittersweet. About 90 seconds, built to loop seamlessly with no fade-out. No "
      f"percussion, no lyrics. {AVOID}", priority="core")

# ---- shared beds: the two that cover every chapter until per-chapter beds exist

track("mu-bed-battle", "Battle bed (all battles)", "bed",
      "Under every battle chapter (the Garden, the Outpost, Luy Lâu, Mã Viện Returns) unless that chapter has its own bed.",
      "about 2 min", True,
      "beatless vietnamese tense heroic ambient, dan nhi, dan nguyet tremolo, quan ho low choir, bronze gongs, cinematic drone, no drums",
      f"A tense, heroic, completely beatless background score {GAME}. It plays under battles "
      "while the player drums commands at any speed, so it must have no pulse, no metre and no "
      "drums or percussion keeping time. Traditional northern Vietnamese colour: a two-string "
      "fiddle (đàn nhị) plays long, resolute phrases in D minor pentatonic; a moon lute (đàn "
      "nguyệt) shivers in unmeasured tremolo; a low women's choir holds long notes in the manner "
      "of quan họ; large bronze gongs are struck softly now and then and left to ring, never in "
      "a pattern; the bamboo flute (sáo trúc) recalls a proud folk melody in fragments. "
      "Underneath, a deep modern cinematic drone and low strings rise and fall like wind over a "
      "river. Urgent and brave but never rhythmic. About 2 minutes, looping seamlessly: end where "
      f"it began, with no fade-out and no silence at either end. No lyrics. {AVOID}",
      priority="core")
track("mu-bed-story", "Story bed (all story chapters)", "bed",
      "Under every story chapter (the Oath, Casting the Drums, the Villages, the Coronation) unless that chapter has its own bed.",
      "about 2 min", True,
      "beatless vietnamese reflective ambient, two sao truc flutes, dan bau hat ru, dan tranh harmonics, quan ho humming, warm pad",
      f"A warm, reflective, completely beatless background score {GAME}. It plays under quiet "
      "story chapters (a funeral, a bronze foundry, villages answering along a river at night, a "
      "coronation festival) while drummers call rhythms and the player answers at any speed, so "
      "it must have no pulse, no metre and no percussion keeping time. Traditional Vietnamese "
      "colour: one bamboo flute (sáo trúc) calls a short free-time phrase and a second, nearer "
      "flute answers; the monochord (đàn bầu) sings slow bending lines in the manner of a hát ru "
      "lullaby; 16-string zither (đàn tranh) harmonics glint like lantern light; now and then a "
      "woman's voice hums a phrase in the quan họ style; a soft bronze bell rings rarely and is "
      "left to decay. A gentle modern ambient pad gives warmth underneath. G major pentatonic, "
      "tender and hopeful with a thread of sadness. About 2 minutes, looping seamlessly: end "
      f"where it began, with no fade-out and no silence at either end. No lyrics. {AVOID}",
      priority="core")

# ---- beds: under each chapter, beatless

track("mu-bed-garden", "The Garden at Mê Linh (bed)", "bed",
      "Under chapter 1, the training battle, quietly under the ambience.",
      "about 2 min", True,
      "beatless vietnamese ambient, dan tranh harmonics, sao truc free phrases, dawn garden, warm pad, no percussion",
      f"A warm, hopeful beatless ambient bed {GAME}, for the sisters' training in their "
      "father's garden at dawn. Traditional Vietnamese colour: a bamboo flute (sáo trúc) plays "
      "short free-time phrases in G major pentatonic like birdsong, 16-string zither (đàn tranh) "
      "harmonics shimmer and fade, a low warm modern synth pad holds a slowly changing chord. "
      f"Morning light, green and gold, unhurried. {BEATLESS} About 2 minutes. No lyrics. {AVOID}")
track("mu-bed-oath", "The Oath (bed)", "bed",
      "Under chapter 2, the father's funeral, while the mourning drum calls.",
      "about 2 min", True,
      "beatless vietnamese funeral lament, dan bau monochord, ca tru female voice, low drone, soft bronze bell, sparse",
      f"A sparse, grieving beatless bed {GAME}, for the funeral of the sisters' father. "
      "Traditional northern Vietnamese mourning colour: the monochord (đàn bầu) bends slow "
      "lamenting phrases in A minor pentatonic over a low drone; now and then a woman's voice in "
      "the restrained, ornamented manner of ca trù hums a few notes; a soft bronze bell rings "
      "rarely and is left to decay; a faint modern low string pad sits underneath. Very quiet, "
      f"lots of space for a slow mourning drum on top. {BEATLESS} About 2 minutes. No words. {AVOID}", priority="maybe")
track("mu-bed-foundry", "Casting the Drums (bed)", "bed",
      "Under chapter 3, in the foundry, while the player holds a steady hammer rhythm.",
      "about 2 min", True,
      "beatless vietnamese work song humming, ho, low drone, metallic bronze resonance, dan nguyet tremolo, foundry ambient",
      f"A warm, glowing beatless bed {GAME}, for a night in an ancient bronze foundry where the "
      "war drums are cast. Traditional Vietnamese colour: men's and women's voices hum a "
      "free-time work song in the manner of hò, long notes rising and falling; a moon lute (đàn "
      "nguyệt) adds soft tremolo phrases; struck bronze bars and bowls ring and are left to "
      "resonate; a deep modern drone like the furnace's breath holds it together. Orange and "
      f"bronze, patient and strong. {BEATLESS} About 2 minutes. No lyrics. {AVOID}")
track("mu-bed-villages", "The Villages Answer (bed)", "bed",
      "Under chapter 4, at night along the river, while village drummers call and the player answers.",
      "about 2 min", True,
      "beatless vietnamese night ambient, two sao truc flutes call and answer, ho song river song, dan tranh harmonics, pad",
      f"A hopeful night-time beatless bed {GAME}, for villages along the Red River answering "
      "the sisters' call one by one. Traditional Vietnamese colour: one bamboo flute (sáo trúc) "
      "calls a short phrase from far away and a second, nearer flute answers, again and again; "
      "between them a man's voice drifts a line of a river boat song (hò sông) in free time; "
      "16-string zither (đàn tranh) harmonics glint like lantern light; a soft modern pad and "
      f"faint water textures underneath. G major pentatonic, sparse. {BEATLESS} About 2 minutes. {AVOID}")
track("mu-bed-river", "The Outpost on the Hát River (bed)", "bed",
      "Under chapter 5, the river battle.",
      "about 2 min", True,
      "beatless vietnamese tense ambient, dan nhi fiddle, dan nguyet tremolo, low cinematic drone, wind, battle tension, no drums",
      f"A tense, determined beatless bed {GAME}, for a battle at a river ford against a Han "
      "outpost. Traditional Vietnamese colour: a two-string fiddle (đàn nhị) plays long resolute "
      "phrases in A minor pentatonic; a moon lute (đàn nguyệt) shivers in unmeasured tremolo; a "
      "deep modern cinematic drone and low strings rise and fall like wind over water. Urgent but "
      f"never pulsing: the player's war drum is the only rhythm. {BEATLESS} About 2 minutes. No lyrics. {AVOID}")
track("mu-bed-luylau", "The Citadel at Luy Lâu (bed)", "bed",
      "Under chapter 6, the night attack on the citadel with the war elephant.",
      "about 2 min", True,
      "beatless vietnamese epic ambient, quan ho low female choir, cong chieng gong resonances, dan tranh tremolo, cinematic pad, night",
      f"A majestic, dark beatless bed {GAME}, for the night assault on the Han citadel of Luy "
      "Lâu with the sisters on a war elephant. Traditional Vietnamese colour: a low women's choir "
      "holds long notes in the manner of quan họ; large bronze gongs (cồng chiêng) are struck "
      "softly and left to ring, never in a pattern; a 16-string zither (đàn tranh) trembles; the "
      "bamboo flute recalls the title theme in fragments; a wide modern cinematic pad under it "
      f"all. Moonlit, D minor pentatonic. {BEATLESS} About 2 minutes. Wordless. {AVOID}")
track("mu-bed-coronation", "The Coronation at Mê Linh (bed)", "bed",
      "Under chapter 7, the festival, while festival drummers call and the player answers.",
      "about 2 min", True,
      "beatless vietnamese festive ambient, cheo theatre colours, dan nguyet flourishes, quan ho chorus swells, crowd joy, bright pad",
      f"A joyful, glowing beatless bed {GAME}, for the festival when the two sisters are crowned "
      "queens at Mê Linh. Traditional Vietnamese colour from chèo folk theatre and quan họ: a moon "
      "lute (đàn nguyệt) plays bright unmeasured flourishes, a bamboo flute trills, a women's "
      "chorus swells on joyful vocables and fades, small bells shimmer; a bright modern pad "
      "carries it. D major pentatonic. Celebratory but without any beat: festival drummers and "
      f"the player drum on top. {BEATLESS} About 2 minutes. {AVOID}")
track("mu-bed-mavien", "Mã Viện Returns (bed)", "bed",
      "Under chapter 8, holding the ford against Mã Viện's army.",
      "about 2 min", True,
      "beatless vietnamese grave cinematic, dan bau lament, dan nhi, distant war horns, low strings, last stand, no drums",
      f"A grave, urgent beatless bed {GAME}, for the last stand at a river ford as the Han "
      "general Mã Viện arrives with a great army. Traditional Vietnamese colour: the monochord "
      "(đàn bầu) bends a broken, mournful form of the main theme; a two-string fiddle (đàn nhị) "
      "answers; distant war horns call and fade; deep modern cinematic low strings and a dark "
      f"pad swell and recede like an approaching army. E minor pentatonic. {BEATLESS} About 2 "
      f"minutes. No lyrics. {AVOID}")
track("mu-bed-elegy", "The Drums Are Melted (bed)", "bed",
      "Under chapter 9, the epilogue, while the drums fall silent one by one.",
      "about 2 min", True,
      "beatless vietnamese lullaby hat ru, dan bau, hummed female voice, soft bronze bell, dawn, mournful, sparse",
      f"A quiet, mournful beatless bed {GAME}, for the epilogue at grey dawn when the bronze "
      "drums are gathered to be melted down. Traditional Vietnamese colour: a woman hums a "
      "melody in the manner of a hát ru lullaby, slow and tender; the monochord (đàn bầu) answers "
      "her with long bending notes; a single soft bronze bell rings now and then; a thin modern "
      f"pad like morning mist underneath. A minor pentatonic. {BEATLESS} About 2 minutes. No words. {AVOID}")

# ---- moments during play

track("mu-wake", "The drum wakes (swell)", "swell",
      "Once, over the chapter's bed, when four commands chain and the drum wakes.",
      "15–20 s", False,
      "vietnamese quan ho chorus swell, bronze shimmer, cinematic rise, beatless, 15 seconds, triumphant",
      f"A 15 to 20 second rising swell {GAME}, played when the sisters' war drum 'wakes' in "
      "battle. A women's chorus in the manner of quan họ rises on one joyful open vowel from soft "
      "to full, bronze bells and gongs shimmer upward with it, a modern cinematic string swell "
      "lifts underneath, and it all rings out and fades in the last few seconds. Beatless: no "
      "drums or pulse, so it sits over the player's drumming. D major pentatonic, triumphant. "
      f"{AVOID}")

# ---- results

track("mu-victory", "Victory sting", "sting",
      "Results screen after a battle chapter is won.",
      "about 8 s", False,
      "short victory sting, vietnamese, sao truc run, dan tranh glissando, bronze gong, cinematic, 8 seconds",
      f"An 8-second victory fanfare {GAME}. Traditional Vietnamese instruments with a modern "
      "cinematic finish: a quick rising bamboo-flute (sáo trúc) run and a sweeping 16-string "
      "zither (đàn tranh) glissando land on one bright held chord with soft strings, closing with "
      f"a ringing bronze gong. D major pentatonic, joyful. No drum kit, no lyrics. {AVOID}")
track("mu-complete", "Chapter complete sting", "sting",
      "Results screen after a story chapter (no battle) is completed.",
      "about 8 s", False,
      "short gentle sting, vietnamese, dan tranh, sao truc, soft bronze bell, warm pad, peaceful, 8 seconds",
      f"An 8-second gentle closing phrase {GAME}, for the end of a peaceful story chapter. A "
      "16-string zither (đàn tranh) plays a short falling pentatonic phrase, a bamboo flute "
      "(sáo trúc) answers with one held note, a soft bronze bell rings, and a warm modern pad "
      f"settles on a calm major chord. Peaceful and satisfied, no drums, no lyrics. {AVOID}")
track("mu-defeat", "Defeat sting", "sting",
      "Results screen after a battle chapter is lost.",
      "about 8 s", False,
      "short defeat sting, vietnamese, dan bau falling phrase, low drone, sorrowful, 8 seconds",
      f"An 8-second defeat sting {GAME}: the monochord (đàn bầu) plays a single falling, "
      "bending phrase over a low drone and a dark modern string pad, ending unresolved. "
      f"Sorrowful but not hopeless. A minor pentatonic. No percussion, no lyrics. {AVOID}")
track("mu-ending", "The Drums Are Melted (ending)", "piece",
      "Under the epilogue (unless it has its own bed) and on the final results screen.",
      "about 3 min", False,
      "vietnamese lament, solo dan bau, quan ho female duet, ca tru colour, free rubato, no percussion, bronze bell ending",
      f"A sparse, mournful ending piece {GAME}. It plays as the bronze drums of the uprising are "
      "gathered to be melted down, and through the final screen. The monochord (đàn bầu) plays "
      "alone at first, bending each note like a voice holding back tears; two women's voices "
      "enter in the quan họ call-and-response style with a touch of ca trù ornament, singing a "
      "lament on wordless vocables (à ơi); a faint modern string pad joins near the end; finally "
      "a single bronze bell is struck and left to ring into silence. Entirely free and rubato, "
      "with no beat, no percussion and no steady tempo, so slow drumming can sit on top. A minor "
      "pentatonic. About 3 minutes. It should feel like dawn on a river after a loss. "
      f"{AVOID}",
      priority="core")
# Delivered: "Trống Đồng Vang Dới Đất Trời" (Bronze drums ring through earth
# and sky) by hoai2k, 3 min, made outside ElevenLabs; the master is kept as
# design/music-masters/mu-anthem.mp3.
track("mu-anthem", "Song of the Two Queens: Trống Đồng Vang Dới Đất Trời (vocal song)", "song",
      "The menus (title and chapter select), round and round, and the Coronation's "
      "success moment (the two queens crowned); later the trailer and end credits.",
      "about 3 min 30 s", False,
      "vietnamese folk ballad, quan ho female duet, dan tranh, dan bau, bronze drums in chorus, modern cinematic folk, 84 bpm",
      f"A folk ballad in Vietnamese {GAME}: two queens who rode elephants and beat the bronze "
      "drum so the villages would rise. Traditional northern Vietnamese style with a modern "
      "cinematic folk production: verses sung by one woman over 16-string zither (đàn tranh); "
      "choruses by two women in close quan họ-style harmony with the full ensemble, deep bronze "
      "drums and soft strings; a monochord (đàn bầu) solo bridge; a final chorus; an outro that "
      "returns to the title melody on bamboo flute (sáo trúc). 84 BPM, D minor pentatonic. "
      "Lyrics are still to be written with the author; until then sing on vocables (à ơi, hò). "
      f"{AVOID}")

# ------------------------------------------------------------------ helpers

def files_for(s):
    if s["variants"] == 1:
        return [f"sfx/{s['id']}.mp3"]
    return [f"sfx/{s['id']}-{i + 1}.mp3" for i in range(s["variants"])]


def api_key():
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        p = Path.home() / ".config" / "elevenlabs.key"
        if p.exists():
            key = p.read_text().strip()
    if not key:
        sys.exit("No ElevenLabs key: set ELEVENLABS_API_KEY or write ~/.config/elevenlabs.key")
    return key


def generate(s, out: Path, key: str):
    body = {"text": s["prompt"], "duration_seconds": s["seconds"], "prompt_influence": s["influence"]}
    if s["kind"] == "loop":
        body["loop"] = True
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read()
    except urllib.error.HTTPError as e:
        if e.code in (400, 422) and body.pop("loop", None):
            # Older models have no loop option; the crossfade below still makes it loop.
            req = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
                                         headers={"xi-api-key": key, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read()
        else:
            raise SystemExit(f"{s['id']}: ElevenLabs returned {e.code}: {e.read()[:300]!r}")
    with tempfile.NamedTemporaryFile(suffix=".mp3") as tmp:
        tmp.write(raw)
        tmp.flush()
        process(tmp.name, out, s)


def process(src, out: Path, s):
    """Trim, normalise and encode. Hits start on their transient so they stay in time."""
    filters = []
    if s["kind"] == "hit":
        # Trim up to the transient: anything 30 dB under the clip's own peak is lead-in.
        raw_peak = measure_peak(src, None)
        filters.append(f"silenceremove=start_periods=1:start_threshold={raw_peak - 30:.1f}dB:start_silence=0.002")
    if s.get("post"):
        filters.append(s["post"])
    if s["kind"] != "loop" and not s.get("post"):
        dur = s["seconds"]
        filters.append(f"afade=t=out:st={max(0.0, dur - min(0.25, dur * 0.3)):.3f}:d={min(0.25, dur * 0.3):.3f}")
    # Peak-normalise to -1 dBFS (loudness is balanced in the game by per-sound gain).
    if not s.get("keep_level"):
        peak = measure_peak(src, ",".join(filters) if filters else None)
        filters.append(f"volume={-1.0 - peak:.2f}dB")
    channels = ["-ac", "2"] if s["kind"] in ("loop", "sting") else ["-ac", "1"]
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", ",".join(filters),
                    *channels, "-ar", "44100", "-b:a", "128k" if s["kind"] in ("loop", "sting") else "96k",
                    str(out)], check=True)


def measure_peak(src, filters):
    cmd = ["ffmpeg", "-hide_banner", "-i", src]
    if filters:
        cmd += ["-af", filters + ",volumedetect"]
    else:
        cmd += ["-af", "volumedetect"]
    cmd += ["-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True).stderr
    for line in err.splitlines():
        if "max_volume" in line:
            return float(line.split("max_volume:")[1].split("dB")[0])
    raise RuntimeError(f"no peak measured for {src}")


# ------------------------------------------------------------------ outputs

def build_manifest():
    sfx_entries = {}
    for s in SFX:
        files = [f for f in files_for(s) if (ROOT / "game" / "assets" / f).exists() and f not in REJECTED]
        if files:
            sfx_entries[s["id"]] = {"files": files, "gain": s["gain"], "loop": s["kind"] == "loop"}
    music_entries = {}
    loops = json.loads(MUSIC_LOOPS.read_text(encoding="utf-8")) if MUSIC_LOOPS.exists() else {}
    for m in MUSIC:
        f = f"music/{m['id']}.mp3"
        if (ROOT / "game" / "assets" / f).exists():
            entry = {"file": f, "loop": m["loop"], "kind": m["kind"]}
            entry.update(loops.get(m["id"], {}))
            music_entries[m["id"]] = entry
    return json.dumps({"generatedBy": "bronzedrum/design/source/build_audio.py",
                       "sfx": sfx_entries, "music": music_entries}, indent=2, ensure_ascii=False) + "\n"


def build_sfx_doc():
    out = ["# Bronze Drum: sound effects\n"]
    out.append(
        "Every sound effect in the game, generated with ElevenLabs' sound-effects model from the "
        "prompts below. Generated from `source/build_audio.py`; edit the data there. "
        "`build_audio.py --generate` makes any effect whose file is missing, and "
        "`--force <id>` remakes one. The key is read from `ELEVENLABS_API_KEY` (or "
        "`~/.config/elevenlabs.key`) and never stored in the repository.\n")
    out.append(
        "Processing: hits are trimmed so the sound starts on its transient (the drum strokes must "
        "land exactly when the player presses), one-shots get a short fade-out, every file is "
        "peak-normalised to -1 dBFS, and the game balances them with the per-sound gain. Effects "
        "with several variants are picked at random so repeated strokes do not sound "
        "mechanical.\n")
    out.append("Sound direction: real, acoustic and close — bronze, wood, bamboo, water, paper, "
               "voices. No synth tones, no music in the effects. Hits are paper tearing, never "
               "gore.\n")
    have = sum(1 for s in SFX for f in files_for(s) if (ROOT / "game" / "assets" / f).exists() and f not in REJECTED)
    total = sum(s["variants"] for s in SFX)
    missing = [f for s in SFX for f in files_for(s) if not (ROOT / "game" / "assets" / f).exists() and f not in REJECTED]
    out.append(f"**{have} of {total} files in use.**" + (f" Not generated yet: {', '.join(f'`{m}`' for m in missing)}." if missing else "") + "\n")
    out.append("Each generated file was checked by measuring its length, peak, level over time "
               "(50 ms windows) and the balance of energy below 200 Hz and above 2 kHz: a drum "
               "stroke must start on its loudest moment and be one stroke, a rim click must be "
               "bright and short. Takes that failed are kept out of the game:\n")
    for f, why in REJECTED.items():
        out.append(f"- `{f}`: {why}.")
    out.append("")
    groups = []
    for s in SFX:
        if s["group"] not in groups:
            groups.append(s["group"])
    for gname in groups:
        out.append(f"## {gname}\n")
        out.append("| Id | Use | Length | Files | Prompt |")
        out.append("| --- | --- | ---: | --- | --- |")
        for s in [x for x in SFX if x["group"] == gname]:
            files = files_for(s)
            present = [f for f in files if (ROOT / "game" / "assets" / f).exists() and f not in REJECTED]
            ftxt = f"{len(present)}/{len(files)}"
            kind = {"hit": "hit", "oneshot": "one-shot", "loop": "loop", "sting": "sting"}[s["kind"]]
            out.append(f"| `{s['id']}` | {s['use']} ({kind}) | {s['seconds']} s | {ftxt} | {s['prompt']} |")
        out.append("")
    out.append("## Alternate ambience takes\n")
    out.append(f"Candidate beds to audition on the workbench (`bronzedrum/workbench/`), each levelled to "
               f"{ALT_LUFS:g} LUFS and kept in `workbench/alt/`, not loaded by the game. "
               "`build_audio.py --alternates` makes any that are missing.\n")
    out.append("| Chapter | Id | File | Prompt |")
    out.append("| --- | --- | --- | --- |")
    for a in ALTERNATES:
        have = "yes" if alt_file(a).exists() else "not yet"
        note = ALT_NOTES.get(a["id"], "steady, nothing stands out")
        out.append(f"| {a['chapter']} | `{a['id']}` | {have}; measured: {note} | {a['prompt']} |")
    out.append("")
    out.append("Turned down on the workbench (and removed), with the reason heard:\n")
    for k, v in ALT_REJECTED.items():
        out.append(f"- `{k}`: {v}.")
    out.append("")
    return "\n".join(out).rstrip() + "\n"


def build_music_doc():
    out = ["# Bronze Drum: music requests\n"]
    out.append(
        "Prompts for the score, ready to paste into a music generator (Suno, Udio, ElevenLabs "
        "Music or similar). Generated from `source/build_audio.py`; edit the data there and "
        "rerun it.\n")
    out.append("## How to use this list\n")
    out.append(
        "- **Each prompt is complete on its own.** Paste the prompt as it stands; nothing needs "
        "combining. The style tags are a short version for generators with a separate style "
        "field, and are optional.\n"
        "- Save each finished track as `bronzedrum/game/assets/music/<id>.mp3` (or drop it in "
        "`bronzedrum/intake/`). The game plays a track as soon as its file is there.\n"
        "- Tracks marked *loops* must loop seamlessly: trim any silence at the start and end. "
        "The beds must stay beatless; if a generator adds a beat, regenerate.\n")
    out.append("## Why most of the music has no beat\n")
    out.append(MUSIC_NOTE + "\n")
    out.append("**When each kind plays**\n")
    out.append("- **Themes:** the title screen and the chapter select.\n"
               "- **Beds:** under each chapter, quietly, beneath the ambience.\n"
               "- **Swell:** once over the bed when the drum wakes.\n"
               "- **Stings and the ending:** on the results screens.\n"
               "- **Song:** trailer and credits.\n")
    order = {"core": 0, "maybe": 1, "optional": 2}
    ranked = sorted(MUSIC, key=lambda m: order[m["priority"]])
    out.append("## What to make first\n")
    out.append(
        "**Core (needed now):** " + ", ".join(f"`{m['id']}`" for m in ranked if m["priority"] == "core") + ". "
        "These five cover every screen: the two themes on the menus, the battle bed under every "
        "battle, the story bed under every story chapter, and the ending under the epilogue and "
        "the final screen.\n")
    out.append(
        "**Maybe:** " + ", ".join(f"`{m['id']}`" for m in ranked if m["priority"] == "maybe") + " "
        "(its own bed for the funeral, instead of the story bed).\n")
    out.append(
        "**Optional, for later:** everything else. A chapter's own bed replaces the shared bed "
        "when it is delivered; without the swell and the stings the game uses its sound effects "
        "(the waking drum and the cheer, the victory and defeat gongs).\n")
    out.append("## Summary\n")
    out.append("| Id | Title | Priority | Kind | When it plays | Length | Loops | Status |")
    out.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for m in ranked:
        out.append(f"| `{m['id']}` | {m['title']} | {m['priority']} | {m['kind']} | {m['plays']} | {m['length']} | {'yes' if m['loop'] else 'no'} | {m['status']} |")
    out.append("")
    for m in ranked:
        out.append(f"## {m['id']} · {m['title']}\n")
        out.append(f"{m['plays']}\n")
        out.append(f"- **Priority:** {m['priority']} · **Kind:** {m['kind']} · **Length:** {m['length']} · **Loops:** {'yes' if m['loop'] else 'no'}")
        out.append(f"- **File:** `bronzedrum/game/assets/music/{m['id']}.mp3`")
        out.append(f"- **Style tags (optional):** `{m['tags']}`")
        out.append("")
        out.append("**Prompt:**\n")
        out.append(f"> {m['prompt']}\n")
    return "\n".join(out).rstrip() + "\n"


# ------------------------------------------------------------------ delivered music

def loudness(path):
    """Integrated loudness (LUFS) of a file, from ffmpeg's loudnorm analysis."""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "loudnorm=print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(json.loads(out[out.rindex("{"):])["input_i"])


def envelope(path, window=0.5, rate=4000):
    """Level in dB per window, mono."""
    import math
    import struct
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(rate),
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    x = struct.unpack(f"<{len(raw) // 2}h", raw)
    w = int(window * rate)
    env = []
    for i in range(0, len(x) - w + 1, w):
        seg = x[i:i + w]
        env.append(20 * math.log10((math.sqrt(sum(v * v for v in seg) / w) or 1) / 32768))
    return env, len(x) / rate


def loop_points(path):
    """Where a looping track's body starts and ends: after its fade-in and
    before its fade-out, i.e. the first and last half-second within 6 dB of
    the track's median level. The game crossfades from just before loopEnd
    into loopStart, so neither fade is ever heard as a dip."""
    env, duration = envelope(path)
    ref = sorted(env)[len(env) // 2]
    body = [i for i, v in enumerate(env) if v >= ref - 6]
    start = min(body[0] * 0.5, 8.0)
    end = max((body[-1] + 1) * 0.5, start + 20)
    return {"loopStart": round(start, 2), "loopEnd": round(min(end, duration), 2), "duration": round(duration, 2)}


def process_music(force=False):
    """Masters in design/music-masters/<id>.mp3 become the game's copies:
    cover art and tags stripped, silence trimmed from both ends, matched to
    MUSIC_LUFS, 44.1 kHz 128 kbps MP3. Loop points are measured and kept in
    music-loops.json so --check needs no ffmpeg."""
    loops = json.loads(MUSIC_LOOPS.read_text(encoding="utf-8")) if MUSIC_LOOPS.exists() else {}
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    for m in MUSIC:
        src = MUSIC_MASTERS / f"{m['id']}.mp3"
        out = MUSIC_DIR / f"{m['id']}.mp3"
        if not src.exists():
            continue
        if force or not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
            gain = MUSIC_LUFS - loudness(src)
            trim = "silenceremove=start_periods=1:start_threshold=-55dB"
            chain = f"{trim},areverse,{trim},areverse,volume={gain:.2f}dB,aresample=44100"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-map", "0:a", "-af", chain,
                            "-map_metadata", "-1", "-metadata", f"title={m['title']}",
                            "-c:a", "libmp3lame", "-b:a", "128k", str(out)], check=True)
            print(f"wrote {out.relative_to(ROOT.parent)} ({out.stat().st_size // 1024} KB, {gain:+.1f} dB)")
        if m["loop"]:
            loops[m["id"]] = loop_points(out)
        else:
            loops[m["id"]] = {"duration": round(envelope(out)[1], 2)}
    MUSIC_LOOPS.write_text(json.dumps(loops, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {MUSIC_LOOPS.relative_to(ROOT.parent)}")


def validate():
    ids = [s["id"] for s in SFX]
    assert len(ids) == len(set(ids)), "duplicate sfx id"
    aids = [a["id"] for a in ALTERNATES]
    assert len(aids) == len(set(aids)), "duplicate alternate id"
    mids = [m["id"] for m in MUSIC]
    assert len(mids) == len(set(mids)), "duplicate music id"
    for m in MUSIC:
        assert len(m["tags"]) <= 200, f"{m['id']}: style tags over 200 characters"
        assert m["kind"] in ("theme", "bed", "swell", "sting", "piece", "song"), m["id"]
        assert m["priority"] in ("core", "maybe", "optional"), m["id"]
        # Each prompt stands alone: it names the game, a Vietnamese style and what to avoid.
        assert "Trưng sisters" in m["prompt"], f"{m['id']}: prompt does not say what it is for"
        assert any(w in m["prompt"] for w in ("quan họ", "ca trù", "chèo", "hò", "hát ru", "đàn", "sáo")), m["id"]
        if m["kind"] in ("bed", "swell"):
            assert "beatless" in m["prompt"].lower() or "no drums" in m["prompt"].lower(), f"{m['id']}: beds must be beatless"


def main():
    validate()
    args = sys.argv[1:]
    if "--generate" in args:
        key = api_key()
        force = set(args[args.index("--force") + 1].split(",")) if "--force" in args else set()
        for s in SFX:
            for f in files_for(s):
                out = ROOT / "game" / "assets" / f
                if (out.exists() or f in REJECTED) and s["id"] not in force:
                    continue
                print(f"generating {f} …", flush=True)
                generate(s, out, key)
    if "--alternates" in args:
        key = api_key()
        force = set(args[args.index("--force") + 1].split(",")) if "--force" in args else set()
        for a in ALTERNATES:
            out = alt_file(a)
            if a["derived_from"] or (out.exists() and a["id"] not in force):
                continue
            print(f"generating workbench/alt/{out.name} …", flush=True)
            generate(a, out, key)
            level_to(out, ALT_LUFS)
    if "--music-trial" in args:
        key = api_key()
        for t in MUSIC_TRIALS:
            if trial_file(t).exists():
                continue
            print(f"generating workbench/music-trials/{trial_file(t).name} …", flush=True)
            generate_music_trial(t, key)
    if "--music" in args:
        process_music(force="--force" in args)
    # A track is delivered once its processed file is in the game.
    for m in MUSIC:
        if (MUSIC_DIR / f"{m['id']}.mp3").exists():
            m["status"] = "delivered"
    outputs = {SFX_DOC: build_sfx_doc(), MUSIC_DOC: build_music_doc(), AUDIO_MANIFEST: build_manifest(),
               WORKBENCH: build_workbench()}
    if "--check" in args:
        stale = [p for p, t in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
        for p in stale:
            print(f"out of date: {p.relative_to(ROOT.parent)} (run build_audio.py)")
        return 1 if stale else 0
    for p, t in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(t, encoding="utf-8")
        print(f"wrote {p.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
