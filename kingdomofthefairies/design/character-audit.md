# Character audit: the cast against the 1903 film

11 October 2026. Every delivered character sprite of the film edition, compared
with frames from the film (`references/expanded-world/source-frames/`, the
Wikimedia Commons copy) and with `film-story.md`. Requests for alternates are
round F8 in [image-requests.md](image-requests.md). All 64 alternates were delivered on 11 October 2026 and the tinted look is now
the film edition's default; Settings › Cast look › Original (or
`?look=original`) keeps the first art available.

## What the film looks like

*Le Royaume des fées* is photographed theatre, coloured by hand after printing:

- **A photographic base.** Real performers in costume on painted flats, shot in
  black and white: silvery greys, deep blacks, soft focus, film grain, flat
  frontal stage light. There are no drawn outlines.
- **A few stencil washes.** Colour was laid on with stencils in a handful of
  translucent aniline dyes: sea-green teal, orange-yellow, rose and coral red,
  pale blue, magenta. The washes bleed past their shapes, sit a little out of
  register, and leave large areas grey (faces, hands and walls are often
  untinted).
- **Stage costume.** Tunics, tights, robes, wigs, card crowns and props. Gold
  appears as a yellow wash, not as detail.

## What the delivered cast looks like

All 65 film sprites share one finish: crisp inked outlines, dense ornament
(gold filigree, embroidery, jewels, pearls), saturated colour everywhere, and
smooth painted shading on a clean ground. It reads as a modern storybook
chromolithograph: handsome, but cleaner, busier and more colourful than the
film. The difference shows most beside the painted sets, whose film-like
texture the figures lack.

## Character by character

| Character | Sprites | Accuracy to the film | Verdict |
| --- | --- | --- | --- |
| Prince Bel-Azor | 23 poses | Ornate silver plate, fleur-de-lis tunic, magenta plume and crimson cape. In the film he is an actor in a plain tunic and tights, armed later with a simple helmet, shield and sword. | Too clean and too ornate; redraw in the tinted look with plain armour |
| Azurine | 3 | Blue and rose gown covered in gold stars, jewelled circlet. The film shows a young woman in a plain pale gown. | Too ornate; tint and simplify |
| Aurora | 2 | Rose, cream and gold gauze with a heavy jewelled mantle. The film's Aurora is a dancer in a light rose gown with a yellow-tinted skirt. | Colours right, finish too rich |
| Water Fairy | 3 (with idle frames) | Shells, pearls and starfish over sea-green gauze. | Close in idea; needs the photographic look |
| King and queen | 2 | Crimson and ermine with gold fleurs-de-lis. | Close; too much gold |
| The three gift fairies | 3 | Gold-embroidered gowns. The film's court ladies wear pastel gowns and tall pointed hennins with veils. | Missing the hennins; tint |
| Demons | 2 | Solid red and teal performers with horns and torches. | Closest to the film; tint only |
| Crew | 12 (with idle frames, sleepers, rider) | Bold blue-and-gold striped livery. The film's courtiers wear padded doublets and hose in pale washes. | Too bold; tint |
| The witch | 5 | Redrawn after the film this week: a stooped crone in a sea-green robe. | Right figure; tint for the photographic base |
| Octopus, dolphin carriage, lobster guards | 4 | Heavily jewelled creatures. The film's sea court are stage props and performers in costume. | Too ornate; tint and simplify |
| Chariot, scrying eye | 2 | Painted props. | Tint |

## Recommendation

Commission round F8: 64 `-tinted` alternates at the same sizes and anchors, so
each drops over its original. Compare them in play with Settings › Cast look (or `?look=tinted`). If you
prefer them, switching is one line (the default look); if not, nothing changes.
The game's own film look (grain, flicker and stencil colour in Settings)
already moves the clean art part of the way, which is why the difference is
smaller in play than in the gallery.

## Delivery check (tinted alternates)

All 64 match their originals' canvas size, anchor and foot line. The tinted
prince was measured separately for body scale (`FILM_BODY_SCALE_TINTED` in
`src/theme.js`) rather than inheriting the original poses' factors; the two
sets differ by a few per cent per pose. The tinted gift fairies hold their own
gifts, so the prologue no longer draws a second gift prop in their hands (only
Aurora's flower, which her art does not hold).

## Round F9: the rest of the film edition

With the cast tinted, the figures, creatures and props the film edition still
draws in the first, clean style stood out beside them: Neptune and his three
attendants, the seahorse guard, the sea dragon, the sea spirit, the jellyfish
and fish, the whale, the four gifts, the five keepsakes, the sinking sword,
Aurora's star, the armour pickups, the tower window and the pearl. Round F9
requests a tinted alternate of each (31) on the same terms as F8. These are
older sprites drawn stretched to their boxes; their alternates are drawn the
same way, not with the film art's proportional fitting.

Delivered 11 October 2026: all 31 match their originals' canvas and placement
and load in play (checked in Neptune's court, the grotto, the tempest, the
beach, the armoury and the procession). The delivery also fixed a loader bug
from the F9 change (a local name hid the asset path, so no art loaded); CI now
runs `qa/assets-loader.test.mjs` to catch that.

## Motion and placement audit (12 October 2026)

Every film scene was played and photographed mid-walk.

- **Walking.** The delivered prince walk pairs hardly move the legs, and the
  court-dress pair changes costume between frames. The game now alternates
  walk A with the standing pose, so he steps without a costume flicker, until
  the stride frames of round F10 arrive. Azurine glides on a slide where she
  walks (the wedding street, the apotheosis); round F11 requests her stride
  frames, which the game uses once both are delivered.
- **Ground lines.** On the prologue rampart he walked across the front of the
  balustrade; he now walks on the coping (y 484). The lobster palace started
  him behind the left curtain; he now starts in view. The other scenes keep
  their feet on their floors.
- **Layering.** The demons' chariot flew across the gargoyles on the
  foreground parapet; it now flies above their heads.

## Walking-cycle requirement

The stride-only F10/F11 briefs were incomplete. Ground walking now requires contact A → passing A → contact B → passing B. The passing phases bring the legs together beneath the hips, with one foot supporting and the other swinging through. They are not standing stills. Use consistent face, costume, head/body scale and ground anchor across all four phases. Review the cycle together, including a carried character when present.

F12 supplies passing frames for armed Bel-Azor, court-dress Bel-Azor, Azurine (both looks), and the shared sailor. F13 supplies complete walking-while-carrying cycles for both prince looks and the shared sailor. Every ground-walking selector uses `src/walking.js`, including the prologue, tempest deck, sea court, whale, cavern, tower floors, coast, wedding street and scripted older-edition walks. Procedural ground-walker fallbacks have legs-together phases too. Stair and slope walking also inserts passing phases between its existing step poses, keeping the support-boot anchor. Climbing, swimming, stationary carrying and airborne actions keep their own poses.

## Delivery check: walking cycles (13 October 2026)

The F10–F13 frames were compared side by side against their standing poses
(canvas, ground line, head height, costume) and watched in play (the court,
the tempest deck, the quay carry, the wedding street and the apotheosis).

- **Even and consistent:** the tinted prince (armed and in court dress),
  Azurine in both looks, both carrying cycles and the sailor's carry. Every
  frame shares its standing pose's canvas and ground line, and the carrying
  frames take the carrying pose's body scale.
- **The Original-look prince limps:** stride B (armed and court dress) is a
  longer lunge than stride A, so the head drops 24–26 px of 360 on alternate
  steps. Round F14 requests even `-redo` frames, which replace the two stride B
  files on delivery. The tinted look, the default, is unaffected.
- **The sailor's sack:** his new passing frames carry the sack, but his first
  walk frames do not. Until his own strides (`sailor-stride-a/b`, F14) arrive,
  he holds each stride through its passing beat (a two-frame walk) instead of
  blinking the sack on and off. `src/art.js` switches to the full four-phase
  cycle when both strides are delivered, and `qa/walking-browser.mjs`
  then requires it.

F14 delivered: the two Original-look prince B repairs now match stride A’s painted head-top and ground bounds (y=4 and y=360). The sailor’s new sack-carrying strides match the passing-frame head top (y=0) and ground (y=360), restoring his four-phase walk in both older editions. All four were reviewed together and checked in the walking browser suite. Superseded prince artwork remains archived with its generation records.

## Body size and head height (13 October 2026)

Play-testing found the prince bobbing as he walked. Comparing stride with
stride had missed it: in the tinted look the stride frames' heads sit 14 px
(armed) and 23 px (court dress) of 360 below the passing frames, where a walk
dips about 9 px. `design/source/audit_sprites.py` now measures every walking
cycle (and every figure's canvas and ground line) and writes
[sprite-audit.md](sprite-audit.md). Until the F16 redraws arrive, those four
frames are scaled up from the feet to a natural dip (`src/sprite-fit.js`).

## Delivery check: F17 and F18 (13 October 2026)

- **The man-at-arms (F17)**, all six frames: an open kettle-hat, the crew's
  green-and-ochre stripes and a red-and-ochre shield. Nothing he wears is the
  prince's any more, so Act II wakes him in his own place again (the stand-in
  crewman was only until this arrived). Canvas and ground line match his idle
  frames; the sprite audit passes.
- **The tinted lobster guard's shut pose (F18)** now has the open pose's red,
  shading and sea-green weed, so the guard no longer changes colour as he
  opens his claws for a bowing prince.
