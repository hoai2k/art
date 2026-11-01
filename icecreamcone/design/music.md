# The Ice-Cream Cone Coot: music

Recorded music for the menus and each kind of game, and a fanfare for the
sticker celebration. The style is quirky 1970s picture-book chamber pop (toy
piano, glockenspiel, accordion, woodwinds), light 1940s cartoon swing for the
lively games, and a seaside carousel for the Coot, the fairground and the
arcade. Each track loops as a whole piece; `src/audio.js` crossfades between
them, keeps them under the sound effects, and falls back to its own
synthesised music-box tune if a file can't be played. The one Volume setting
covers everything.

## Delivered (2026-10-09)

| Track | File (`game/assets/music/`) | Plays on | Length |
| --- | --- | --- | --- |
| Title theme ("Untitled Title") | `title.mp3` | The title screen | 1:16 |
| Field Guide | `field-guide.mp3` | The field guide, each bird's page, the sticker book | 1:17 |
| Tiptoe Bounce | `tiptoe-bounce.mp3` | Bouncy games: Say Cheese, Left Foot Right Foot, Hot off the Press, Milk Round, Snip Snap, Button Up, Puddle Hop, Slippery Dishes | 2:04 |
| Cartoon Busy | `cartoon-busy.mp3` | Busy games: Safe Crossing, Clean Sweep, Bin Day, Pressing Business, Lights On, Drip Drop Dash | 2:11 |
| Sunny Gentle Shuffle | `sunny-gentle-shuffle.mp3` | Gentle games: Tea Time, Bloom, Soup's On, Stitch in Time | 3:03 |
| Clockwork Concentration | `clockwork-concentration.mp3` | Careful games: Spot the Dodo, Clock Hop, Just a Pinch, Saw It Straight | 2:03 |
| Seaside Carousel Waltz | `seaside-carousel-waltz.mp3` | Scoop Stack, Lucky Dip, Snip the String, and the finale (all the birds together) | 1:57 |
| Celebration fanfare | `../sfx/celebration.mp3` | The first-pass sticker celebration (the music dips under it) | 0:05 |

Wind and Sing, Glass Harp and Tune In play no music: they make their own.

The title theme runs on into the field guide: going from the title to the
cards (or a bird's page, or the sticker book) lets it play to its end, and the
Field Guide loop starts after it. Coming back to the title starts the theme
again.

The tracks were delivered through `intake/` as 128 kbps MP3s at about -16
LUFS; they were trimmed of silence at each end and re-encoded at 112 kbps. The
fanfare was generated with ElevenLabs' sound-effects model from the prompt:
"Tiny triumphant toy-orchestra jingle, 6 seconds: toy piano and celesta play
a quick rising arpeggio, a calliope band organ answers with a cheerful two-bar
flourish, glockenspiel sparkle, ends on a bright resolved major chord and a
gentle music-box twinkle. Sweet vintage children's-book feel, no vocals."
(trimmed to 5.2 s with a fade, -16 LUFS).

## Optional later additions

Shared tracks stand in for these for now; each would be nice to have its own.

1. **Sticker Book** (stands in: Field Guide). A cosy, unhurried piece so the
   book feels like its own place: "Cosy whimsical craft-table tune, toy piano
   and glockenspiel over a lazy accordion waltz bass, a little music-box
   sparkle, relaxed and content, 3/4 time, 84 BPM, G major, instrumental,
   seamless loop."
2. **Finale: all the birds together** (stands in: Seaside Carousel Waltz).
   The most worth making: the end of the whole game deserves the title theme
   returning in full: "Grand gentle finale where the toy-piano title theme
   returns as a carousel waltz, band organ, accordion, clarinet and
   glockenspiel joining one by one like birds arriving, bird-call piccolo
   figures, uplifting, 3/4, 96 BPM, D major, instrumental."
3. **Arcade, for Lucky Dip** (stands in: Seaside Carousel Waltz): "Old
   penny-arcade music, a cheerful mechanical band organ with glockenspiel and
   ratchet clicks, like a clockwork amusement machine, 112 BPM, F major,
   instrumental, seamless loop."
