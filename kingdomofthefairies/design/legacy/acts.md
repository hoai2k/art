# Widow's Bay — the five acts

The whole game is one evening at a toy theatre: five acts, each staged on
the same painted proscenium with a different piece of stage machinery
driving the play. The story follows the band's video in order, as seen in
the frames in [`references/video-frames/`](../references/video-frames/):

1. A sailor comes home across a storm, and the deck erupts in celebration as
   Widow's Bay comes into sight.
2. The sea witch sinks the ship anyway. The sailor wakes among the drowned
   revellers on the sea floor and follows the band's sinking guitar down into
   her grotto.
3. He crosses the Sea King's court and is swallowed by the whale.
4. He climbs out of the whale onto the shore.
5. He scales the cliff to Widow's Bay as the house burns, and carries the
   beloved out. A grand pageant and the band's curtain call close the show.

Whether a lamp is lit in her window depends on what he carried home.

**Sources.**

- **Lyrics:** the tea reading, the pearls with the beloved, the flowers with
  the sea witch, the past as a thrown stone, and the doubt over whether she
  waited.
- **Video:** every scene below is anchored to a frame timestamp (`0:25` is
  `references/video-frames/frame-025s.jpg`).
- **Accounts:** [`video-reference.md`](video-reference.md) describes the
  sequence. The reconstructions in
  [`references/visual-guide/`](../references/visual-guide/README.md) are
  interpretive, not stills, but useful for costume and creature detail.

Art ids in `code` refer to [`image-requests.md`](image-requests.md).

## Through-line

| Act | Title | Stage machine | What you carry out | Video |
| --- | --- | --- | --- | --- |
| I | The Crossing | wave cranks (three rows), then the deck set | **tea leaves**: the reading | deck party 0:25–0:45, storm and wreck 0:50–1:00, guitar sinking 1:05 |
| II | The Sleepers' Grotto | the flying harness, with a backcloth rolling up as you sink | **the guitar**, and **the sea rose** if you take it | drowned sleepers, red dragon, the woman in pink waking them 1:10–1:30; the moon-boat ride 1:35–1:40 |
| III | The Sea King's Court | processional floor tracks, and the whale as an eclipse | **her pearl** | the court, the pastel attendants, the white-robed king, the red sea creatures, the whale passing 1:45–2:25 |
| IV | The Whale's Road | the rocking cradle: the whole set tilts | **the stone** | the whale beached on a pink-tinted shore, travellers crawling from its mouth, its tail 2:30–2:40 |
| V | Widow's Bay | the cliff, then breakaway flats: a collapsing house | **her** (the rescue) | the cliff, the giant legs, the tiny guitarists 2:45–3:05; the red-orange collapse and the carry 3:10–3:15; the pageant 3:20 |

### Keepsakes

Keepsakes are carried between acts and decide the ending.

- **Tea leaves** (Act I; three leaves complete the reading). The reading is
  a prophecy: in later acts, a small tea-leaf omen glyph appears one beat
  earlier over every hazard. This is a gentle assist.
- **The guitar** (Act II) is the band's own, lost when the ship sank (`1:05`).
  Its music wakes the drowned. Every sleeper you wake with it joins the
  finale pageant. Carried to the end, the band plays it at the curtain call.
- **The sea rose** (Act II) is the witch's gift. Taking it wakes every
  sleeper at once and calms the red sea creatures in Act III, but it binds
  you to her.
- **Her pearl** (Act III) belongs to the beloved, and lies in the Sea King's
  treasury. Without it the window stays dark.
- **The stone** (Act IV) is the pebble of the lyric, "the past as a thrown
  stone". In Act V, throwing it breaks the locked shutter: a shortcut. In the
  dark ending, it is what you throw into the bay.

### Endings

Endings play in Act V, checked in this order:

1. **The Sea Witch's.** You took the rose. As you carry the beloved out, the
   witch's moon boat rises in the bay and claims you; the beloved is safe on
   the quay. Bittersweet. Tableau `ending-witch`.
2. **A Lamp in the Window.** You have her pearl: reunion at the lit window.
   Tableau `ending-lamp`.
3. **The Window is Dark.** No pearl. The house is saved, but she isn't
   waiting. A silhouette (`rival-silhouette`) stands in the doorway, and you
   throw the stone into the bay. Tableau `ending-dark`.

**Then the pageant**, as in the video's closing tableau (`3:20`). The
apotheosis backcloth (`pageant-backcloth`) flies in, and a line of dancers in
pink tutus (`pageant-dancers`) crosses it. Every sleeper you woke steps into
the line, the Sea King and the witch take their places, and the band takes
the centre, playing the guitar if you brought it. Then the curtain call
(already built) and the playbill (`playbill`) with your keepsakes, sleepers
woken and score per act.

### The score

The score is the band's recording throughout. At about 76 BPM in 4/4 (see
the README's Sound section), each act has machinery that keeps time with it:

- Act I: the revellers dance on the beat.
- Act II: the clams open on the beat.
- Act III: the attendants step and the sea creatures snap on the beat.
- Act IV: the whale breathes every four bars (about 12.6 s).

Acts last 90–130 s, about half the song each.

### Shared rules, all acts

- Three lanterns of hull or heart; a hit costs one, then 1.6 s of grace.
  Losing all three ends on the magenta "The Sea Keeps Her Own" card. The
  retry carries on from the last checkpoint, not the top of the act: each act
  is divided into scenes (just past a key item, a new stretch of the stage),
  and the player resumes at the latest one with what they had gathered by
  then and full lanterns. *Restart Act* in the pause menu goes back to the
  top. See `src/acts/CONTRACT.md`, "Scenes and checkpoints".
- **Scene select** (pause menu, and the film-strip button on the title)
  starts any scene reached so far: every scene of a finished act, and the
  scenes reached in the act in progress.
- Pearls score everywhere.
- Acts unlock in order. The playbill is the act select; progress and
  keepsakes are saved per act, in their own save slot.
- The controller mapping stays the same: the stick or D-pad moves, **A** is
  the act's one action, **Menu** pauses, **B** goes back. Each act's card
  names its action.

---

## Act I — The Crossing (built; ending to change)

As built: three cranked wave rows, rocks rising through trapdoors, the
witch's lightning, the shifting wind, pearls, and the voyage ribbon. Pearls
mend the hull: each restores 1/`pearlsPerLantern` of a lantern (10 by
default, so ten pearls survive one more hit), never above full. The number
is in `src/game_config.js`.

**Keepsakes.** The three keepsakes become three **tea leaves** (`tea-leaf`),
which complete the reading in the cup (`keepsake-tea`). The pearl and the
rose move to Acts III and II.

**New ending: celebration, then the wreck.** It runs about 21 s after the
ship arrives, replacing the arrival card, in four scenes. Each scene shows
its moment and moves on: no lingering. Timings are `ENDING` and `CUES` in
`src/acts/act1.js`; watch it in the workbench (`workbench/#act1-ending`).

1. **Land ho** (1.7 s, after the harbour bell's two rings on arrival). The
   lighthouse is wheeled on and its beam sweeps the stage. The ship's bell
   rings three times, and as it finishes the scene changes.
2. **The celebration** (6 s, `0:25–0:45`). Stage machinery changes the scene
   in full view:
   - The three wave rows sink through the floor and the **deck set**
     (`deck-set`) rises in their place in 0.8 s. It has a carved rail with
     heraldic shields, the mast and rigging, barrels and coiled rope, and
     two hatches. Its deck floor lies at y 395–480 behind the rail, and the
     hatches open at x 320–500 and 785–960.
   - The band (`band-trio`) stand on the deck between the hatches.
   - The costumed revellers spring out of the hatches in quick succession
     and land in a different arrangement each voyage: on the barrels, on
     the coil of rope, by the bell and at the rail (`SPOTS`). They are the
     traveller in yellow (`reveller-yellow`), the shaggy green sea creature
     (`reveller-shaggy`), the harlequin (`reveller-jester`) and the lady in
     stripes (`reveller-lady`). Then they hold the tableau, nodding to the
     beat. A string of paper lanterns hangs across the rigging.
   - **Play:** press **A** on the beat. Each good beat lights one of the
     four lanterns and throws confetti, and lighting them all earns the
     *Revelry* bonus. This can't be failed: it's a breath before the fall.
3. **The turn** (4.4 s, `0:50–1:00`).
   - The music doesn't stop, but the sky bleaches to white as at `0:60`.
   - Ghostly sea spirits (`sea-spirit`), translucent white figures like
     Méliès double exposures, rise out of the sea.
   - The witch strikes the mast (1.2 s). The revellers hop across the deck
     toward the nearer hatch, one hop for every 120 px, and drop down it.
     The band stay where they are, and the deck set drops away (from 2.9 s).
4. **The wreck** (4.6 s).
   - The sea is back, and the ship is caught among the rocks (`0:55`). The
     waterspout (`waterspout`) lifts it.
   - It breaks in two at 2 s (`ship-wreck-bow`, `ship-wreck-stern`), and the
     halves go down with a splash at 3.2 s.
   - The stage drains dark blue. One last shot (3.6 s): **the guitar**
     (`guitar-sinking`) tumbles down through bubbles and kelp, as at
     `1:05`.
   - Iris out to the Act II card (1.2 s).

The ending runs whatever your score. The tea leaves you gathered carry on,
and a full reading shows as a glint in the cup as it sinks.

## Act II — The Sleepers' Grotto

**Opening** (`1:10`). The sea floor. The sailor lies among the drowned
revellers from the party. The game lays their cut-outs on their backs,
toy-theatre style, with bubbles rising from them. The red sea dragon
(`sea-dragon`) noses past, and the woman in pink, the sea witch, bends over
the sailor alone and breathes life into him. He wakes; the others sleep on.

**Stage.** The grotto backcloth (`grotto-backcloth`) rolls upward as you sink
deeper: from the dim wreck site, through the teal grotto, to the dark cave
floor. Rock wings (`grotto-wing-left`, `grotto-wing-right`) frame it. Coral
ground rows (`coral-flat-a`, `coral-flat-b`) slide across. Kelp
(`kelp-hanging`) and jellyfish hang on wires, fish schools (`fish-school`)
cross on sticks, and pieces of the wreck (`wreck-debris`) lie about.

**Machine: the flying harness.** The sailor swims on visible wires, hung
from a harness like a Victorian flying ballet (`sailor-swim-a` and
`sailor-swim-b`, two strokes).

- The **stick** swims in any direction. He drifts slowly, and the wires go
  slack and taut.
- **A** gives a strong kick-stroke, a burst of speed on a short cooldown.

**Play.**

- **The guitar** (`guitar-sinking`) keeps sinking ahead of you, always just
  out of reach, and leads you down. You catch it at the cave floor.
- **Sleepers** lie on ledges all the way down. Swim close with the guitar
  in hand (once you have it) or play the shell horns (`conch-horn`) found
  along the way, and they wake and float up out of shot. Each one counts
  toward the pageant.
- **Air.** A gauge drains slowly. Air vents (`air-vent`) refill it while you
  hover in the bubbles.
- **Pearls** sit in giant clams (`clam-open`, `clam-closed`) that open on
  the beat for one beat. Inside means a pearl; a closed clam is solid. Each
  gives its pearl, rests shut (`clamRest`), then regrows one more that grows
  only while the clam is open, in view (`clamGrow`, drawn in
  `clam-open-empty`); taken again, it stays shut and greyed (`SPENT` in
  `src/acts/shared.js`, the look of anything used up), as does a sounded conch.
- **Hazards:** eels (`eel`) dart from holes whose eyes glow first
  (`eel-hole`), and jellyfish (`jellyfish`) drift on their wires. The red
  dragon patrols the lowest third in a slow figure of eight.

**Close** (`1:20–1:30`). At the cave floor, the guitar settles in your hands.
The witch stands before her moon boat (`witch-stand`) and holds out **the sea
rose**.

- **A** takes it. With a wave of her wand she wakes every sleeper at once,
  and they rise around you (the video's awakening). But you are hers.
- **B**, or swimming away, refuses. She laughs, and the red sea creatures
  will be restless in Act III.

**Interlude: the moon-boat ride** (about 20 s, `1:35–1:40`). The witch's moon
boat (`witch-moonboat`), drawn by the dragon, carries you through the
undersea waves to the Sea King's court. This reuses Act I's three wave rows
(`waves-*`), tinted deep teal. It is a gentle bonus with pearls to gather
and nothing to lose. Choose your row with **up and down**.

## Act III — The Sea King's Court

**Stage.** The palace hall (`court-backcloth`): gold-ornamented arches,
coral-red columns, teal water light. Column wings (`court-wing-left`,
`court-wing-right`) frame it. The floor (`court-floor`) has three
processional grooves, the same three rows as Act I, now on the stage floor.
On the throne at the back sits **the Sea King** (`sea-king-throne`): a
crowned, white-bearded ruler in white and blue robes with a trident (`1:45`).
The witch (`witch-stand`) stands at his side.

**Machine: processional tracks.**

- Courtiers slide along the grooves in patterns, stepping on the beat: the
  pastel attendants of the video (`attendant-green`, `attendant-pink`,
  `attendant-blue`, `1:55–2:10`) and seahorse-helmed guards
  (`seahorse-guard`).
- Along the **front groove**, the giant red sea creatures of the video's
  foreground (`2:00–2:25`) crouch as sentries (`sentry-creature-closed`,
  `sentry-creature-open`). Their jaws snap open on the beat.
- The king's **gaze lantern** (`gaze-lantern`) sweeps the hall every so
  often. It stays dark for 5–8 s (4 s at the start). Then it gives a 3 s
  warning: the lantern pulses, a glow gathers in one wing and an arrow runs
  along the floor's front edge. Then its beam enters from that wing, crosses
  the whole stage at a steady 230 px/s and leaves by the far wing. Once it
  has passed you it is gone until the next warning. Caught in the light, you
  lose a lantern; the beam holds on you a moment and then sweeps on.
- You are the sailor on foot (`sailor-stand`, `sailor-walk-a`,
  `sailor-walk-b`), walking at 150 px/s. **Up and down** change groove, and
  **left and right** walk. **A** strikes a courtier's pose (`sailor-crouch`)
  that holds until you move or press A again; holding A also works. Posed
  beside a pink, blue or green attendant on your groove, you are hidden from
  the beam.
- The act opens with a silent-film intertitle after its card: "Press A
  beside a courtier to hide from the Sea King's lantern. Gather as many
  pearls as you can." The intertitle is shown in the A button of the input
  in use.

**The whale.** Every 20–25 s the giant whale (`whale-side`) glides across in
front of the whole stage, a huge dark flat on a track (`2:15–2:25`). It masks
the hall for about three seconds, and while it passes the gaze can't find
you: dash. A large fish (`fish-large`) swims the same track on smaller passes.

**Goal.** Reach the treasury pedestal beside the throne (`pearl-pedestal`) and
take **her pearl**: walking up to it on any groove takes it, no button
needed, and the pedestal pearl glows as you near it. If you took the rose, the sentries stay asleep. If you
refused it, they snap faster.

**Hand-off.** As you take the pearl, the whale turns to face the audience
with its mouth wide (`whale-mouth`) and swallows the stage in one lunge (one
courtier dives in after you, as at `2:20`). Iris out.

## Act IV — The Whale's Road

**Stage.** Inside the whale (`belly-backcloth`): the ribs as Gothic arches,
dim red-violet light, and a swinging lantern (`lantern-hanging`). Rib flats
(`rib-arch`) stand in front. Swallowed wreckage floats in the stomach water
(`belly-water`, a tiling strip like the waves): barrels (`barrel`), crates
(`crate`), a ship's figurehead (`figurehead`) and, absurdly, an upright piano
(`piano`). Pieces of your own ship float here too (`wreck-debris`).

**Machine: the rocking cradle.** The whole set sits on a visible cradle
(`cradle`) under the stage and **tilts** as the whale swims, so floating
wreckage slides downhill. Every four bars the whale **breathes**, and the
water rises, then falls.

**Play.** A climb across floating platforms.

- **Left and right** walk. **A** leaps (`sailor-leap`).
- **Catching an edge.** Falling just past the side of a platform he rose
  above (a missed landing, not one he walked off), he grabs its edge and hangs
  (`sailor-hang`), safe from the water; toward it, up or A hauls him over
  (`sailor-pullup`), and he climbs on his own after 0.7 s; away or down lets
  go. Tuning in `HANG` (`src/acts/act4.js`).
- Stand on the wreckage, ride it up as the water rises, and work toward the
  throat (`whale-throat`), where daylight shows.
- **The stone** (`keepsake-stone`) lies on the highest rib ledge.
- Hazards: at its lowest the water exposes the stomach floor, which costs a
  lantern. The tilt tips you off, and swallowed hooks swing on their lines.

**Hand-off** (`2:30–2:40`). The scene changes to the outside: the whale lies
beached on a rocky shore (`whale-beached`), its mouth open, under the video's
**pink tint** (the stage wash turns rose for this scene). You crawl out of
its mouth onto the rocks (`shore-rocks`), and any revellers you woke crawl
out after you. The whale slides back, and its tail (`whale-tail`) lifts and
slips away.

## Act V — Widow's Bay

**Part 1 — The cliff** (`2:45–3:05`). The cliff face (`cliff-face`) rises
from the shore to the stone house at the top, its wooden door hung with ivy
(`house-front`). The band are in the scenery at impossible scales, as in the
video:

- A band member's **giant legs** (`band-legs-giant`) stand on the clifftop.
  Their boots are a ledge to climb on, and they shift their weight on the
  beat.
- A **tiny guitarist** (`band-guitar`, drawn small) plays in a gap in the
  rock and marks the safe handhold.
- At the top, a **huge guitarist** (`band-beard`, drawn very large) leans
  into the foreground, as at `3:00`.

Climb with **up, down, left and right**. **A** leaps between ledges, and
loose stones fall from above.

**Part 2 — The burning house** (`3:10–3:15`).

- As you reach the door, the witch's storm strikes. The backcloth changes to
  its burning version (`bay-backcloth-fire`), the video's red-orange wash.
  Painted flame flats (`flame-flat`) on sticks and smoke flats (`smoke-flat`)
  roll across.
- **The house front swings open like a dollhouse** to reveal the cutaway
  (`stone-house`): three floors joined by the staircase (`staircase`) and
  ladders (`ladder`).
- Beams (`beam-fall`) and stones (`debris-stones`) drop through on cue,
  telegraphed by a shudder and dust, and floors break away behind you.
- If you carry **the stone**, **A** throws it to break the locked shutter: a
  shortcut that skips a floor.
- **Climb up** to the beloved (`beloved-stand`), then **carry her down**
  (`sailor-carry`, as at `3:15`): slower, with no leap, so the route down is
  different from the route up.
- Cross the quay (`harbour-quay`) as the house falls.

**Ending, pageant, curtain call.** See above.

---

## Sound for the new acts

All effects come from ElevenLabs through `source/build_sfx.py`, as period
stage foley tuned to the song (see `../CLAUDE.md`). Planned additions:

- **Act I ending.** Ship's bell (tuned), hatch bang, crowd cheer (a small
  theatre company), confetti pop, lantern light (tuned chime), mast struck,
  timber splitting, the sea spirits (an airy choir made with a wet finger on
  a glass), the guitar sinking (a muffled strum and bubbles).
- **Act II.** Harness creak, swim stroke, bubble burst, clam snap (tuned), a
  sleeper waking (a yawn under water), conch horn (tuned), eel lunge, jelly
  sting, air vent hiss, the witch's offer (a harp shimmer), taking the rose
  (a low bell), refusing (her laugh).
- **Act III.** Courtier footstep (one soft tap per beat), sentry snap,
  gaze-lantern hum, spotted gong, freeze (a cloth rustle), the whale's pass
  (a long low groan with water), taking the pearl (tuned chime), the swallow
  (a roaring gulp).
- **Act IV.** The whale breathing (a slow water rise and fall), timber creak
  on the tilt, barrel knock, a piano key plink (tuned, comic), dripping, the
  stone found, beaching surf.
- **Act V.** Rock scrape, giant footstep (on the beat), fire crackle loop (a
  stage fire of rattling silk), beam crash, stone tumble, shutter smash, the
  carry (heavy footsteps), the moon boat rising, the lamp lit (a warm swell),
  the stone thrown into the bay (plop), pageant applause.

## Unused video material

The opening palace revel (`0:10–0:20`) is the costumed court feast, with one
of the band dancing in the crowd, in black. It would make an overture: the
title curtain could open on it for a few seconds before Act I. It isn't
requested yet.

## Optional expansions

[`story-appendix.md`](story-appendix.md) gathers ideas from the
expanded-world references (the full 1903 film): the witch's two faces (the
pink glamour and the hooded crone), her red and teal imps, a betrothal
prologue that explains the stolen pearl, the Fairy's Gifts to spend pearls
on, a cast album, and three encores (the tower across the moat, the fire
chariot chase, and the armoury revel set to the whole song). None of them is
part of the five acts unless chosen.

## Build order

1. The Act I ending: deck celebration, storm, wreck, sinking guitar. Also the
   switch to tea leaves.
2. Act II and the moon-boat interlude.
3. Acts III and IV.
4. Act V, the endings, the pageant and the playbill save.

Each act ships to `main` when it is playable, with its card, its sound
effects and the art delivered so far; art not yet delivered draws
procedural stand-ins until it arrives.
