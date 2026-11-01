## Trying the animations in the game

Open Settings and turn **Extra Animations** on. It defaults to Off and is saved
with the other settings. When Off, every optional animation uses its prior
still-art fallback. Ordinary waves, gameplay and existing stage effects continue.
The review gallery is independent of this game setting.

- Title/curtain call and Act I **The Celebration**: band and revellers.
- Act I **The Witch’s Turn**: sea spirits.
- Act II **The Deep Caves** / **The Dragon’s Floor**: jellyfish and sea dragon.
- Act II **The Witch’s Offer**: choose to take the rose for the one-shot wand cue.
- Act V near the cliff top: the large bearded musician; **The Pageant**: dancers,
  revellers and the band (the playing trio appears when the guitar was recovered).

The wand gallery preview now repeats automatically, while the game cue remains
one-shot. The band’s left sleeve/arm was repaired locally at the affected source
keyframes, preserving the already-reviewed face, body and feet masks.

# Widow’s Bay motion delivery — 6 October 2026

[Open the gallery](index.html) for 1× and 0.25× playback, all-frame contact
sheets, source clips and method notes. Restart replays the one-shot wand gesture.

All eleven requested motion slots are registered in `assets/manifest.json`.
The shared `src/animation.js` timing helper and `kit.anim` draw the sheets with
their aspect ratio preserved. Missing or invalid loops retain still-art
fallback. The title and curtain-call band, Act I party and spirit transition,
Act II dragon/jellyfish and taking-the-rose wand cue, and Act V giant/pageant
use the relevant animations. Player-controlled sailor poses remain unchanged.

Three animations retain source footage: the playing trio, its isolated central
bearded performer, and the lady-reveller pilot. The lady is a small hand flourish
and sway; it is not a full dance routine and its costume differs from the painted
sprite. The giant keeps the soft photographic detail of the source and is
upsampled when drawn large. Those are visible stylistic choices to judge in the
gallery. Tiny detached staff/background pieces were removed from the lady matte.

The other eight animations use continuous deformation of the existing painted
cut-outs: sleeve/torso jigging, a ghostly ripple, a local wand gesture, a staggered
chorus sway, a travelling dragon body wave, and jellyfish bell/tentacle pulses.
They preserve the current characters and cannot invent newly exposed body
surfaces or provide the full range of captured dancing. No Runway, paid video
service, or independent frame-by-frame image generation was used.

Every sheet is below 1.5 MB WebP and close to the requested 8 MB decoded target.
The largest is 8,294,400 decoded bytes. Larger groups and the ghost reduce
spatial sampling to meet that budget. The band uses 24 stored frames over four
beats; its display cadence is 7.65 fps, although the source was sampled at 12 fps.
The request’s inconsistent bar labels are resolved with explicit beats and
76.5 BPM. The witch is a 1.2-second one-shot which holds its last pose.

Sources and preparation:

- [Music video](https://www.youtube.com/watch?v=7zoGfdN4dgE), 38.3-second performance insert.
- [The Kingdom of the Fairies](https://commons.wikimedia.org/wiki/File:Le_Royaume_des_f%C3%A9es_(1903).webm), 329.9-second armoury performer.
- SAM 2.1 Hiera Tiny tracks the performers through the frames. General background
  removers were rejected because they lost body parts; the pageant extraction
  was rejected for missing costume sections and replaced by its painted rig.
- Prepared metadata, notes and source clips are retained per id here and in
  `intake/anims/`. Puppet outputs also preserve their original `source.png`.
- `recipes/` retains the exact preparation scripts. They use the scratch paths
  documented in the earlier offline checkpoint; restore that checkpoint, then
  copy the latest recipes to the scratch directory to reproduce the final assets.

Verification:

- All eleven PNG-alpha-derived WebP sheets decoded, contain their declared
  frames, and have valid dimensions, transparency and source notes.
- Closing-step pixel changes were compared with ordinary frame changes; all
  repeating sheets passed. The wand deliberately does not wrap.
- Timing tests cover beat periods, frame rectangles, repeat boundaries,
  endpoint-free ping-pong, one-shot completion and invalid metadata/sheet size.
- Browser checks loaded and drew all eleven sheets, tested speed controls and
  still-art fallback, and sampled every frame across ten virtual cycles at both
  playback speeds. `browser-validation.json` records the result; it does not
  claim a human watched ten complete real-time plays of every loop.
- Board and Acts II–V simulation/drawing checks pass, including legacy drawing
  kits with no animation method. Relevant screenshots are retained.

The earlier `checkpoint-2026-10-06/` remains the archived pause state. This
delivery supersedes its unfinished status. The user subsequently requested publication to main; this delivery is now included in that publication.
