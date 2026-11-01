# Kingdom of the Fairies: music requests

Prompts for the film edition's music, ready to paste into a music generator
(ElevenLabs Music, Suno, Udio or similar). Each prompt is complete as written.
How the pieces are played (moods, crossfades) is in [music.md](music.md).

## The house style

Every piece is the kind of accompaniment audiences heard live at the 1903
showings of *Le Royaume des fées*: a solo upright piano, or a small Parisian
café-concert ensemble (violin, cornet, clarinet, cello and piano), playing
Belle Époque light music (waltzes, galops, marches, salon romances). Each
prompt asks for **F major or D minor at about 76 BPM**, a small room or hall,
and ends **"Instrumental, no drums, no synths, no modern harmony."** New
prompts keep that wording so the pieces sit together. The first five were
written for the original edition's plan ([legacy/music.md](legacy/music.md))
and delivered as the period pieces.

## Summary

| Id | Piece | Plays | Length | Status |
| --- | --- | --- | --- | --- |
| `period-piano` | Solo pianist: lilting waltz into a brisk galop | Voyages, the moon-boat ride (`voyage`) | 1–3 min | delivered |
| `period-band` | Café-concert band: bright march into a court waltz | Court, deck, pageant, curtain call (`revel`) | 1–3 min | delivered |
| `period-storm` | Solo pianist: agitato | Storms, the wreck, fire (`storm`) | 1–3 min | delivered |
| `period-harmonium` | Harmonium and piano: slow, enchanted | Grotto, whale (`deep`) | 1–3 min | delivered |
| `period-tender` | Solo pianist: slow salon romance | Cliff, endings, playbill (`tender`) | 1–3 min | delivered |
| `victoryStinger` | Café-concert ensemble: heroic victory flourish | Once, after the witch and barrel disappear entirely into the water (Act VI) | about 7 s | delivered (generated, ElevenLabs Music) |
| `period-wedding` | Café-concert ensemble: victorious royal wedding march into a jubilant grand waltz | The wedding street and the apotheosis (`wedding`) | 1:59 | delivered — “Procession Royale” |

## Wedding delivery, 31 October 2026

“Procession Royale” was supplied by the user and installed as `assets/audio/period-wedding.mp3`, normalized to -12.23 LUFS (measured true peak -1.20 dBTP after MP3 encoding). The original file in Downloads is unchanged. The wedding recording continues through the ascent and closing credits; the final eight-second scene fade also fades the score.

## Original wedding brief

- **`period-wedding`.** A small 1900s Parisian café-concert ensemble (violin,
  cornet, clarinet, cello and piano), playing as grandly as it can, for the
  grand finale of a hand-coloured Méliès féerie: the prince and princess are
  married in triumph and the whole kingdom celebrates. A victorious royal
  wedding march in F major, like a coronation: ringing cornet fanfares,
  pealing piano chords like cathedral bells, and the strings and clarinet
  swelling under it, building to a jubilant, festive grand waltz and a
  triumphant final cadence. Majestic, regal and exultant rather than gentle.
  Belle Époque light music, theatrical and a little brassy, recorded in a
  small hall. About 76 BPM. Instrumental, no drums, no synths, no modern
  harmony.

  Delivered as `assets/audio/period-wedding.mp3`, mood `wedding`.

## Delivered

- **`victoryStinger`** (sound effect, `assets/sfx/victoryStinger.mp3`).
  Generated 31 October 2026 with ElevenLabs Music by
  `design/source/build_sfx.py victoryStinger` (its prompt is kept there): a
  short heroic victory flourish for a 1903 French silent fairy-tale film,
  played live by a small 1900s Parisian café-concert ensemble (cornet,
  clarinet, violin, cello and piano): the cornet sounds a bright rising
  fanfare call, the violin and clarinet answer with a quick triumphant run,
  the piano rolls a full chord, and all end together on a bold, held F major
  chord that rings and fades. Belle Époque light music, theatrical and a
  little brassy, recorded in a small hall. About 76 BPM. Instrumental, no
  drums, no synths, no modern harmony. Of three takes, the one kept rises
  for about 3.5 s and ends on F major (F, A, C), fading out by 6 s.
- **The five period pieces**: their prompts are in
  [legacy/music.md](legacy/music.md), "The pieces to generate".
