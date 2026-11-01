# Widow's Bay — music

## The plan

**The band's song opens every visit.** "Widow's Bay" by Langan, Frost & Wane
(`assets/audio/widowsbay.mp3`, 3:28) starts with Press Start and plays
through once, as it does now.

**When it ends, the game moves to period accompaniment instead of looping
it.** These are pieces in the style audiences heard live at the original
1903 showings of *Le Royaume des fées*: a pianist or small café-concert band
improvising to the pictures (see "What 1903 audiences heard" below). Which
piece plays depends on the scene on stage, so a storm gets storm music and
the grotto gets something enchanted. When a piece ends, the next one is
chosen for whatever scene is current.

The song stays the centre: it is the first thing every player hears, and it
comes back for the moments that matter (below). The period pieces are the
accompaniment that carries the rest of a long session, so the song isn't
worn out by looping.

## What 1903 audiences heard

The film is silent; the Wikimedia Commons copy used for the reference frames
has no audio track. Music was live and different at each showing:

- In Paris, a pianist, or for a bigger showing a small café-concert or
  fairground band (violin, cornet, clarinet, cello, piano).
- The repertoire was popular and light classical: waltzes, galops, marches
  and Offenbach-style operetta tunes, plus stock "mood" passages: tremolo
  and rumbling bass for a storm, glittering runs for magic, a stately dance
  for a court.
- Effects (thunder sheets, wind machines, bells) came from behind the
  screen. The game's ElevenLabs effects already play that part.

## The pieces to generate

Each piece needs one example track. All are instrumental and period-faithful:
no drums, no synths, no modern harmony. Ask for **F major (or D minor) at
about 76 BPM** where the style allows. That is the key and tempo of the
band's song (`README.md`, Sound), so the beat-timed machinery stays in step
and the change from the song is smooth. Aim for 1–3 minutes each.

| Id | Piece | For scenes |
| --- | --- | --- |
| `period-piano-voyage` | Solo pianist: a lilting waltz that turns into a brisk galop | Act I voyage, the moon-boat ride |
| `period-band-revel` | Café-concert band: bright march into a court waltz | Act I deck party, Act III court, the pageant |
| `period-piano-storm` | Solo pianist: agitato, tremolo octaves and rumbling low runs | Act I storm and wreck, Act V fire |
| `period-harmonium-deep` | Harmonium and piano: slow, mysterious, enchanted | Act II grotto, Act IV inside the whale |
| `period-piano-tender` | Solo pianist: a slow, tender salon romance | Act V endings, the playbill, the cliff |

**Prompts** (ElevenLabs Music, Suno, Udio or similar). Each is complete as
written:

- **`period-piano-voyage`.** Solo upright piano improvising live
  accompaniment for a 1903 French silent fairy-tale film. A lilting 3/4
  waltz in F major that turns into a brisk 2/4 galop, light Romantic salon
  style, played with theatrical rubato. A slightly out-of-tune upright with
  felt hammers, in a small room. About 76 BPM. Instrumental, no drums, no
  synths, no modern harmony.
- **`period-band-revel`.** A small 1900s Parisian café-concert ensemble
  (violin, cornet, clarinet, cello and piano) accompanying a hand-coloured
  Méliès féerie. A bright Offenbach-style march in F major, then a graceful
  court waltz. Belle Époque light music, theatrical and a little brassy,
  recorded in a small hall. About 76 BPM. Instrumental, no modern elements.
- **`period-piano-storm`.** Period silent-film piano accompaniment from
  about 1903 for a storm at sea and a shipwreck. A D minor agitato with
  tremolo octaves, rumbling low-register runs and sudden accents, dramatic
  but not modern, played on an upright piano in a small hall. About 76 BPM.
  Instrumental.
- **`period-harmonium-deep`.** Period silent-film accompaniment from about
  1903: a reed harmonium sustaining slow chords under an upright piano, for
  an undersea grotto and a sea witch. Mysterious and enchanted rather than
  frightening: chromatic descending lines, soft tremolo, high glittering
  notes. D minor, slow (half-time feel at 76 BPM). Instrumental, no
  percussion.
- **`period-piano-tender`.** Solo upright piano, a slow, tender salon
  romance in F major from about 1903, for a reunion by a lit window at
  night. Simple singing melody, gentle arpeggios, rubato. Small room, a
  slightly worn piano. About 76 BPM. Instrumental.

**Optional colour.** Add *"recorded acoustically on a wax cylinder: narrow
bandwidth, surface hiss and crackle, slight wow"* for an aged sound. Strictly,
1903 audiences heard this music live and never on cylinder, but listeners
today hear the cylinder sound as "1903" instantly. Use it on all the tracks or
on none, so they match.

## How it fits into the game

**Files.** Drop each generated track in `intake/` named by its id. It lands
in `assets/audio/` with an entry in `assets/manifest.json` under
`audio.period`:

```json
"period": {
  "period-piano-voyage": { "status": "delivered", "file": "audio/period-piano-voyage.mp3", "moods": ["voyage"] }
}
```

**Moods.** Each act tells the shell which mood it is in, and it can change
mid-act:

| Mood | Where |
| --- | --- |
| `voyage` | Act I sailing, the moon-boat ride |
| `revel` | Act I deck party, Act III court, the pageant |
| `storm` | Act I storm and wreck, Act V fire and quay |
| `deep` | Act II grotto, Act IV inside the whale |
| `tender` | Act V cliff and endings, the playbill, the curtain call |

The shell asks the act for its mood (`act.mood(state)`), falling back to a
default per act.

**Playback rules.**

1. Press Start begins the band's song from the top.
2. When the song ends, play the delivered period track whose moods include
   the current mood. If none matches, play any delivered period track. If
   none is delivered at all, loop the song, which is what happens today.
3. When a period track ends, choose again for the current mood, avoiding an
   immediate repeat.
4. **Scene changes don't cut a track off.** Crossfade (about 2 s) only when
   the mood changes *and* the playing track doesn't suit the new mood. A
   storm cue that arrives mid-waltz takes over; a calm scene lets the
   current piece finish.
5. **The song comes back** for the curtain call and the pageant: those
   always crossfade back to the band's recording from its first chorus. It
   then plays out as normal and hands back to the period pieces when it
   ends.

**Beat-timed machinery.** The beat clock (`audio.beat()`) follows the
playing track. Each period track needs its own beat grid (BPM and first-beat
offset), measured when it is integrated the way the song's was (76.5 BPM,
0.33 s). It goes in its manifest entry. A track with no clear beat, such as
the rubato tender piece, gets `"beat": null`, and the clock falls back to a
steady 76.5 BPM so clams and lanterns keep working.

**Loading.** Period tracks load in the background after the song starts.
They never hold up a card or show a loading bar, and the song is always the
first thing heard.

**Settings.** The Music volume slider covers all music. A "Period
accompaniment: On / Off" setting lets players keep the song looping instead,
as now.

## Status

**All five pieces are delivered** (5 October 2026), one per mood. They are in
`assets/audio/` and listed under `audio.period` in `assets/manifest.json`:

| File | Delivered as | Mood | Measured |
| --- | --- | --- | --- |
| `period-piano.mp3` | "Paris Cinema" | voyage | 2:09, B major |
| `period-band.mp3` | "Festival March" | revel | 2:32, E♭ major |
| `period-harmonium.mp3` | "Sea and Grotto Waltz" | deep | 2:05, C minor |
| `period-storm.mp3` | "The Shipwreck" | storm | 2:00, C minor |
| `period-tender.mp3` | "Tender Evening" | tender | 3:00, D minor / F major |

- **Loudness.** They arrived at about −16 to −17 LUFS, against the song's
  −9.9, and were raised to about −12 to −13.6 LUFS with a −1 dB true-peak
  limit. Embedded cover images were stripped.
- **Beat.** All are played with rubato, so none has a steady beat (`"beat":
  null`). While they play, the game's beat-timed machinery runs on a steady
  76.5 BPM clock.
- **Key.** Only "Tender Evening" (D minor, the relative minor of F) sits in
  the key of the song and the F-tuned sound effects; the others clash
  mildly. The music was left as delivered.

**Built:**

- The song plays through once, then the piece for the scene's mood follows,
  with no loop. When a piece ends, the piece for the current mood plays next;
  with one piece per mood, that is the same piece again until the scene
  changes.
- A mood change crossfades over 2 s only when the playing piece doesn't suit
  the new mood.
- The pageant and curtain call bring the song back.
- Settings → "Period accompaniment" turns this off, and the song loops
  instead.
