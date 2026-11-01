# Bronze Drum: design notes

## The pitch

Two sisters, one bronze drum, an army of women. The player leads the Trưng
sisters' uprising by **drumming**. Every order to the army is a four-beat phrase
played on the drum, and the army answers on the next four beats. The drum is the
title object, the controller and the HUD.

Sources:

- **The story:** Phong Nguyen's novel *Bronze Drum* (2022), which tells the
  uprising of 40–43 CE. The game adapts the novel with the author's blessing, so
  its characters, scenes and structure are ours to use.
- **The look:** backlit hand-cut paper, inspired by Sarah Nguyen's suspended
  paper and fibre panels, and the friezes on Đông Sơn bronze drums. See
  [image-requests.md](image-requests.md) for the full art direction and the rule
  that prompts describe the qualities of her work and never name her.

## Core loop

| Action | Who | Controller | Keyboard | Mouse | Touch |
| --- | --- | --- | --- | --- | --- |
| **tùng**, the deep centre | Trưng Trắc, the elder: steady and disciplined | X | F D A ← | left half of the screen | the big drum's centre, or the left side |
| **cắc**, the rim | Trưng Nhị, the younger: fierce and free | B | J K L → | right half of the screen | the red rim ring, or the right side |
| **Shield and clear** | the army's shield wall; clears the rhythm dots | A | Space | click the bronze drum | Shield drum (trống chầu), or swipe the drum to clear |

**Phones and tablets.** A touch switches the HUD to a touch layout; mouse and
keyboard keep the desktop one. The drum becomes the instrument: it sits large
at the bottom centre, its centre is *tùng* and a lacquer-red ring round its rim
is *cắc*, as on a real bronze drum. Taps elsewhere fall back to the screen's
halves, so a phone can also be drummed with two thumbs, and several fingers
can play pairs and triplets. The two buttons are the drums that stand beside a
bronze drum in a temple or village hall. The Shield button, at the bottom right
where the right thumb rests, is a trống chầu, a hide-headed barrel drum. It
glows while an attack is coming and dims while it recovers, and it also clears
the rhythm (a separate mõ Reset drum stood beside it until shield and clear
became one button). Pause sits at the top. On every device the shield sounds a
stroke on the barrel drum, and a clear outside battle knocks the mõ (both
generated with ElevenLabs). Two gestures save reaching for the buttons: a
sideways swipe across the drum or the rhythm dots clears, and a tap on the
battle itself (the army, the enemy, the ground between) raises the shields.
Taps on the dots do nothing, so a swipe across them is clean; a swipe that
starts on the drum plays that first stroke before it clears.

**Small screens.** When the game is drawn at under 70% of its 1280 × 720
size (a phone held sideways, or a small window), two things change, on any
input device:

- The HUD grows to stay readable at arm's length, about 14 CSS pixels for body
  text: the bars, the instruction line (which breaks into two lines rather
  than shrinking), the rhythm dots and their label, the confirmations, and the
  command list, which puts each command's tiers on a second line so it can
  grow without reaching the drum.
- The camera opens on the wide shot to set the scene. At the first stroke, or
  five seconds in, it eases in on the action: ×1.45 in battle, centred between
  the army's front and the nearest enemy and following them, ×1.2 on the
  middle of the stage in the story chapters. It never shows past the painted
  edges. The HUD is not zoomed. Taps on the battle follow the zoom.

**Full screen on phones** (the same approach as Widow's Bay). The canvas is
fitted to the *visible* viewport, measured from the visual viewport less the
safe-area insets, because iOS Safari's 100vh ignores its own bars
(`src/fit.js`). Getting the browser's bars out of the way (`src/chrome.js`):

- **Fullscreen API (Android, iPad, desktop).** Fullscreen needs a tap, never
  just turning the device, so the first tap after the device is in landscape
  requests fullscreen and locks landscape where the browser allows it.
- **iPhone Safari** has no fullscreen for anything but video. It does tuck its
  bars away in landscape when the page scrolls, so there the page is made a
  little taller than the screen. While the bars show outside play, a hint at
  the top says to swipe up, and the title's Fullscreen button points at it.
  During play the drum owns every gesture, so nothing scrolls.
- **Add to Home Screen.** `manifest.webmanifest` and `icons/` (the drum face,
  cut from BD-U02) install the game as a full-screen landscape app, which is
  how iPhones get true full screen.

**The Oath.** It has no ambience. Every bed tried here sounded synthetic
against the incense and the dusk, so the music carries the chapter alone, a
little louder than elsewhere. Each answered call lights an incense stick: a flare of light,
sparks and a ring, then a thicker first breath of smoke. Every lit stick sends
up a ribbon of smoke that curls through a slow swirling flow and climbs into the
sky as a thinning haze, so the column visibly thickens with each answer, and the
altar's glow grows. The chapter has no shields and no use for reset, so A and Y
(Space and R) instead blow a breeze over the shrine while held, A to the right,
Y to the left, in wandering gusts, with a soft wind sound. In every
call-and-answer chapter the next call follows an answer after a beat and a half
plus 0.4 s, less than half the earlier wait. The Oath's ambience is now a
crackling fire with crickets at dusk, and the foundry's a hand-powered forge
(both chosen from six takes each by measuring how tonal they are; the earlier
ones carried a synthetic fizz and a machine-like hum).

**Menus.** The pause menu and the other dialogs are cut from the delivered
paper sheet (BD-U04), nine-sliced so its border of herons and rings keeps its
shape, with menu buttons as strips of ink and lacquer paper. A panel never
grows taller than the screen: it scrolls, and on a short screen (a phone held
sideways) the pause and result buttons sit in two columns and the Close button
stays pinned in reach.

**A drum for every action.** Two companion drummers walk with the drum crew,
just behind the ranks: one with a trống chầu at her hip, one holding a mõ
(requests BD-C11 and BD-C12; drawn stand-ins until delivered). The bronze
drum answers the strokes, the barrel drum the shield and the mõ the reset.
Each shivers when struck: the HUD drum and the palanquin on every stroke, the
companion drummers and the touch buttons on a shield or a reset.
The sisters strike the drum (Trắc the centre, Nhị the rim). In the battle
chapters the player's strokes show only as the close-up sticks over the HUD
drum; the sisters on the palanquin stay still and then play the rhythm as the
army acts on it, with the replay. In the other chapters they strike with each
of the player's strokes. The close-up sticks show in the battle chapters and
in Drum Practice and Training, not in the other chapters:
Trắc's from the bottom left onto the sun-star, Nhị's from the right onto the
rim (BD-U20 and BD-U21). On the touch drum each lands where it was tapped. Settings, Drumsticks swaps in other pairs: Folk, a
pestle-like pole and a bamboo stick (BD-U22, BD-U24), or Ceremonial, a
lacquered beater and a horn-tipped stick (BD-U23, BD-U25). Reduce motion
turns the shiver off. Text is drawn larger, taps
buzz briefly if Vibration is on, and an upright phone holds the game behind a
screen of its own (not the pause menu) asking for it to be turned sideways;
the game carries on by itself once it is, and the screen's Menu button opens
the pause menu. The button faces are request BD-U16; until it is delivered
the renderer draws them.

The two leads' temperaments are built into the controls: Trắc holds the beat and
Nhị decorates it.

**No metronome; evenness.** A command is a four-beat rhythm, and the player
plays it at any speed from about 45 to 200 BPM. The reader fits a tempo to the
beats and judges whether they are *even*: every gap between beats (the first
stroke of each beat) must match the pattern at that tempo, within about ±37%
("perfect" within ±15%). The quick strokes of a pair or triplet only have to
fall inside their beat, in order. People play them as a flurry and then land
the next beat on time, so their spacing costs a little precision but never
breaks a phrase, and the wait for the next stroke is measured from the beat.
(An earlier reader judged every gap, which rejected natural triplets, such as
the Giao Chỉ call, RRR L RR L.) Every battle command opens with a single
stroke. The first two beats set the tempo, and only then can a pair or a
triplet be told apart from plain beats, and so one command from another (a
test enforces it). Where only one rhythm is expected (a call to answer, the
casting rhythm, the practice partner's call), it may open with a pair or a
triplet. Several calls do, and a test plays each one. The phrase fades as soon as no pattern can still
be finished in time, or when a stroke breaks the rhythm. A clears it at once.

**Seeing a mistake.** When a stroke breaks the phrase, the dots show what was
played: the strokes so far, and the wrong one where it actually fell, at the
player's own tempo, crossed out. The wrong drum on time sits in its expected
place with an X over it; a stroke too soon joins the beat before as a pair or
triplet and that beat is crossed out; a stroke after the phrase has run out of
time lands past its beat. No words: the X says it. It shows for about a
second, or until the next stroke. Demonstrations are drawn on the heard clock
(the audio clock less the device's output latency, from the browser's output
timestamp), so each light and the pointer's tap meet their sound.

**Answering early.** In the call-and-answer chapters the player may answer as
soon as they know the rhythm, during the call; the caller falls silent.

**One button to shield and clear.** A (Space, the barrel-drum button on touch)
always clears the rhythm dots, and in a battle also raises the shield wall, so a
player can shield and start the next command afresh in one motion; the shield is
ready again 0.7 s after raising it with nothing coming, 0.6 s after a block. In
chapters with no shields A only clears, with the mõ's knock. Y and the separate
touch Reset drum are gone; on touch, a swipe across the drum or the dots still
clears. Instructions and hints show the face buttons as the game's own drum
marks with the letter on top: X the gold tùng disc, B the black-and-red cắc
target, A the cream hide of the barrel drum.

**The Villages Answer** has a cricket-and-river night bed (frogs, water lapping
at a jetty; chosen so the crickets do not chirp at one steady rate, which would
pull against the player's tempo). Each village that answers comes to life: a
gong and voices over the water, its house flaring with lamplight and sparks, the
drum's rings, paper lanterns floating up. Then 2.6 s more for the scene to
settle back to the crickets before the next village calls.

**The pause menu** names the chapter being played.

**Winning a chapter.** No menu: the scene celebrates in its own way (paper
confetti over a battle or the coronation, lanterns rising when the villages
answer, embers from the incense, the foundry and the elegy) as the drum's rings
burst from the middle, with a title for the chapter ("The oath is sworn", "The
ford is ours"), its closing line, and one button, Continue (A, Enter or Space),
to the next chapter. Restart and the chapter list are in the pause menu, which
still opens. A loss keeps the menu with Play again.

In call and answer, an accepted answer stays lit for a moment and then clears,
so the next call's rhythm shows as ghosts while it is called; the drum is free
at once (no army cycle to wait out).

**Casting at the bellows' pace.** The foundry has a fixed pace (76 beats a
minute, never shown as a number). Its own drum plays the hammer rhythm softly
at that pace throughout, and the bellows beside the furnace squeeze on every
beat as the fire flares, so the pace is heard and seen. The player drums the
rhythm round after round without stopping. It is one continuous pour: every
stroke at the pace raises the bronze along a single line, a whole round a
little more, and the three drums are marks on that line, each reached after
about two and a half rounds. Passing one casts that drum (its rings burst from
the mould, sparks fly, "Drum 1 cast!") and makes it a checkpoint. A mistake, or
a round that rushes or drags, spills a little (about half a round's worth),
never below the last drum cast; stopping lets the bronze sink slowly back to
it. Elsewhere, the confirmation after a command names its pace in words
(quick, steady, slow) rather than BPM.

**Focus.** The game goes silent whenever its tab or window is in the
background, and a chapter in play pauses.

**Demonstrations.** The first time a hint shows a rhythm (the first march,
the first pair, the first triplet, the casting rhythm), the game plays it
before asking for it: the hint becomes "Listen — <name>: <rhythm>", the drum
plays it twice at about 109 BPM, each button in the hint swells and glows as
its stroke sounds, and a paper pointer taps under it and slides on to the next.
Rhythms already demonstrated are remembered between visits. After three uneven
or abandoned tries in a row at a rhythm, it is played again ("Listen again").
A stroke from the player ends a demonstration at once. Hints write each stroke
as a token in the device's own terms (an Xbox button, a key, the drum's centre
or rim), and strokes that share a beat are drawn small, touching and beamed.

**Difficulty** (Settings: Easy, Medium, Hard; Medium by default) sets the
rhythms, from the next chapter started (`rhythm.js`).
- **Easy** never reaches triplets. Tier I is plain beats, II adds a pair and III
  two (march `L RR L RR`, strike `R RR RR L`). Calls and the hammer rhythm play
  their triplets as pairs.
- **Medium** is the game as designed.
- **Hard** adds rests, written `.` for a silent slot:
  - march `L L . R`, `L L .R R`, `L R.R L R`;
  - strike `R . L R`, `R .R L R`, `R R.R L R`.

  Calls and the hammer rhythm get the same treatment (`rhythmFor`). After the
  first beat, each triplet loses its middle stroke and every other pair its
  first, making it an off-beat stroke. A rhythm with neither gets a silent third
  beat. The first beat and the last stroke are never changed.

The reader measures a stroke after a rest from the last stroke on a beat, and
a test plays every command and call at every difficulty. Rests show as a short
dash in the dots, the hints and the command table.

**Number of beats** (Settings, 3 to 8, four by default; separate from
Difficulty) sets how long every command and call is (`fitBeats`). The first
and last beats stay. A shorter rhythm keeps the middle beats that tell the
tiers apart (pairs and triplets first). A longer one repeats the middle beats
in order: at 6 beats, march II is `L L LR L LR R`. The army still answers for
four beats, starting on the beat after the command. A test plays every command
at every length and difficulty and checks each is read as itself and no two
are alike. Two beats are not offered: on Easy they cannot hold three distinct
strike tiers.

**Pairs, triplets and tiers.** A beat can hold one stroke, a pair (two) or a
triplet (three). Every command has three tiers. Tier I is four plain strokes;
tiers II and III add pairs and triplets. The deep tùng needs room to ring, so
two tùng strokes are always at least a beat apart. The quick strokes are on
the rim (cắc), and a pair opens with at most one tùng. A test enforces this
for every pattern.

**Power.** Each tier is ×1.4 the one below (×1, ×1.4, ×1.96). Evenness scales
power from ×0.72 at the edge of the window to ×1 when perfect, which covers
almost the whole gap between tiers. A sloppy tier II still just beats a perfect
tier I, and a sloppy tier III a perfect tier II. Power also scales with beat
length (×1 at 100 BPM), so the army does the same work per second whether the
player drums fast or slow: the Han keep their own war drum.

**The answer.** When a rhythm is accepted, the army answers for four beats at
the player's tempo:
- The army's drums play the rhythm back.
- The figures move on the drummed strokes: march steps, spear thrusts on tùng,
  arrows loosed on cắc, the elephant's stomps.
- The accepted pattern stays lit above the drum until it glows ready.

A march or a strike carries on in the same rhythm for up to two more rounds, at
reduced power (×0.6 and ×0.5), until the player starts the next phrase. Strokes
during the answer are ignored (Nhị's flourish, rim strokes between the
answer's beats for extra power, was removed: it went unexplained and unused).

**Chain.** Starting the next command within two beats of the drum glowing ready
keeps the chain. Four in a row wakes the drum (*trống thức*), and every command
becomes ×1.5 as strong.

**The shield.** Defence is separate from the drum. Han attacks travel and can
be seen coming: crossbow bolts fly for 0.9 s, the fort's volleys for 1.1 s, and
a spearman draws back for 0.7 s before his thrust lands. Pressing shield raises
a translucent dome rimmed with bronze shields over the whole army. It stays up
at least 0.5 s, and in any case until everything already in the air has landed,
so pressing while an attack is visibly on its way always deflects it fully.
Feedback is "Defended" under the drum, a ringing sound and sparks. Raising the
shield with nothing incoming makes it slower to be ready again (0.9 s against
0.3 s). A red "!" marks a Han soldier winding up for his first blow.

**Confirmations.** "Cleared" (A, in chapters without shields) and "Defended" (a deflected attack) appear
under the drum. When the rhythm is cleared, its dots tumble away.

| Command | Tier I | Tier II | Tier III | Effect | Unlocked |
| --- | --- | --- | --- | --- | --- |
| Tiến · March | `L L L R` | `L L LR R` | `L RRR L R` | advance, stopping at the enemy line; tiers II and III crash into it on arrival | ch. 1 |
| Đánh · Strike | `R R L R` | `R RR L R` | `R RRR L R` | spears hit the front enemy; archers shoot | ch. 1 |

In the patterns, L is tùng and R is cắc. Spaces separate the four beats, and
letters written together share a beat. Chapter 1 allows tiers I and II, and the
later chapters allow all three. The first stroke says what kind of order it
is: movement (march) starts on tùng, attacks (strike) on cắc.

**Outnumbered.** The women should look outnumbered and still able to win.
The rules count the Han in units, but each is drawn as a squad
(`render/host.js`): a spear unit is six soldiers in two ranks, a crossbow unit
five in a staggered line. As a unit is worn down its soldiers fall one by one
and the rest close up. Behind the line stands the rest of the host, rank on
rank of smaller, hazier soldiers that scroll slowly as far things do (always
partly on screen) and thin as the Han are beaten, or, holding the ford, as the
waves run out. A crossbow attack looses a volley of eight bolts (the fort
ten), and the women's archers twelve arrows. Only the look changed: units,
strength and damage are as before.

**Keeping the crowd cheap.** The backlit glow (a canvas shadow blur) was the
costliest thing on the field, paid again for every sprite and every rig piece
each frame. `render/glow.js` now bakes each image's glow once per size, scale
and colour and draws the baked copy; only the squad's lead soldier and the
front figures carry it, and the back rank and the host use cached haze-toned
copies with no glow. The parallax strips draw only their opaque band, not the
transparent sky above. Measured on the Outpost (shadow style), a battle frame
fell from about 25 ms with the host and the old glow to about 14 ms, a little
under the 14.4–15.3 ms it took before the host was added (water style 16 ms).

**A stronger march crashes in.** A march advances 2 × its power each beat and
stops at the enemy line, so a tier II or III march used to lose the ground it
had left once it reached the line. Now, on the beat a stronger march arrives
at the line, that leftover ground becomes a hit on the front enemy: 2 × the
ground left × the march's power, so arriving early in a
march hits hardest, at most about half a spear blow (`MARCH_HIT` in
`battle.js`). It happens once, on arrival: a march begun at the line does not
hit, and a tier I march never does.

**Two families.** There are only march and strike. Rally (healing) was removed:
the shield now does the defensive work. The elephant charge (Voi) is no longer
a rhythm of its own. In chapter 3, with the war elephant, a strike played while
the drum is awake becomes the charge: the elephant stomps on the drummed
strokes and tramples everything near it, and the charge spends the drum's
spirit. The women's cheer that was Rally's sound now plays when the drum wakes.

**Chapters** (in story order):

| # | Chapter | Mode | What the player does |
| --- | --- | --- | --- |
| 1 | The Garden at Mê Linh | battle | training on straw targets: march and strike, tiers I–II |
| 2 | The Oath | echo | a slow mourning drum calls five rhythms; each even answer lights an incense stick for the father |
| 3 | Casting the Drums | casting | repeat the hammer rhythm `L RR L RR` at one steady speed: each steady phrase pours, drifting more than ±12% from the first phrase's tempo cracks the mould; three drums |
| 4 | The Villages Answer | echo, tempo | six village drummers call harder rhythms; echo each evenly at about their speed (±30%) to light its lanterns |
| 5 | The Outpost on the Hát River | battle | crossbows and a palisade |
| 6 | The Citadel at Luy Lâu | battle | the war elephant at night; a strike on a waking drum is the charge |
| 7 | The Coronation at Mê Linh | echo | festival drummers call six rich rhythms; graded on evenness, no failing |
| 8 | Mã Viện Returns | hold the line | Han columns arrive in waves; hold the ford for 90 s. Built around the shield |
| 9 | The Drums Are Melted | echo | epilogue: each answered call silences one of five drums gathered for melting |

**The garden is the tutorial.** A "Lessons" list sits at the top left and
ticks off each lesson as the player does it, with a word of praise and a
chime: march; a stronger march (tier II); strike; cut down
the targets; block the stones. The hint line always names the current
lesson. When the last target falls the chapter stays open: two village
children run in from the right, stop a few paces ahead of the army (they
keep that distance as it moves) and lob stones. Holding the block (A) while a
stone is in the air raises the shield wall, as in battle, and knocks the
stone aside. A stone that gets through does no harm, but the women flinch
with their forearms over their faces. Two blocks pass the lesson; the
children run back off the way they came, and once they are gone the chapter
is won. Children are
"ghost" enemies: marches pass them, strikes ignore them, and they never count
towards winning or losing.

In the echo chapters the caller plays first and the player answers. Strokes
during the call are ignored ("listen first"). An unanswered call is played
again, and the chapter ends when every call has been answered, with the
player's average evenness. Call rhythms follow the same deep-stroke rule as
the commands. The reader accepts only the call's rhythm, so any even
performance of it counts.

**Balance check.** The battle tests play every battle chapter with a scripted player
who drums a phrase, waits for the answer, and starts the next at once.
- A steady player using only tier I and shielding each volley wins every battle
  chapter with most of the army left.
- Holding the ford needs the shield: without it a perfect drummer barely
  survives, and with it most of the army does.
- Without shielding, they still win with about 40% left.
- Higher tiers win faster.
- Sloppy drumming, fast or slow, still clears chapters 1 and 2.

## Opening each chapter

Each chapter opens on a card over its still scene: the chapter's number and
title, two sentences of its story (`story` in `stages.js`) and what to do in it
(`goal`). Nothing moves until the player begins (A, Space, a drum stroke, a tap
or a click); then the chapter's clock starts from zero. Restarting a chapter
from the pause menu skips the card. The chapter list shows the story and the
goal for the chapter in focus, and the goal's first sentence is the opening
caption once play begins.

## Drum Practice

On the title screen, under Press Start, is a mode with no right or wrong: the
drum, a choice of instruments, and dancers. It is for learning the core skill,
an even beat with pairs and triplets inside it, without a chapter at stake.

**Free drumming.** A rhythm is counted in beats: 2 to 12, set with D-pad ▲ ▼
(− and +, or the buttons beside the dots on touch), four by default like a
command. Each beat may hold one, two or three strokes, or none, so four
beats of triplets are twelve strokes. The player drums at any tempo, and the
strokes are read on a grid of beats (`transcribe` in `practice.js`): every
tempo is tried, each beat split into one, two or three slots, and slots may
stay empty, so rhythms hold rests (a silent beat, written `-`, or a silent slot
inside a beat, `.`). Each choice has a cost (`COST`): a pair costs a little, a
triplet a lot more, so strokes read as plain beats and eighths unless they
plainly fall in threes; a deep stroke off its beat costs a little; straying from the tempo already in the air (`prior`) costs
too. Rests are read only when the rhythm being copied has them (a partner's
call with a rest in it): then an empty slot or a silent beat costs a little,
and otherwise ten times as much, so uneven drumming reads as the plain beats
and pairs it almost certainly was rather than as rests. A finished rhythm read
shorter than the beats set would end in silent beats, so those count as rests
too (otherwise `L R L R L R` drummed a little unevenly read as three pairs at
half the tempo and three silent beats). Measured with simulated players
(steady drift, uneven strokes up to ±12% of a beat), plain rhythms now read
right 95% of the time, against 72% before, and with a rest 2% against 25%. 

**A steady reading.** The beats set (4 by default) pin the tempo (`pinned`):
the first stroke opens the first beat and the last falls in the last beat, so
the rhythm spans a little under n - 1 to n beats, and pairs cannot be read as
beats nor beats as pairs. The loop plays back at that tempo, the speed drummed;
the tempo already in the air (the loop just cleared) only breaks ties among the
readings the strokes allow, as when a rhythm opens with a pair. While the
rhythm is drummed the dots show only settled beats (`shown`): a beat appears
as a ghost once strokes have landed two beats past it and two readings in a
row agree on it, on everything before it and on the tempo, and it never
changes; the rest appear when the rhythm is complete, and the final reading
keeps to what is shown unless the strokes plainly say otherwise. Measured with
simulated players (whole sessions, uneven strokes up to ±12% of a beat),
beats already shown changed in 0–4% of rhythms, against 71–79% before, with
the readings as accurate as before (97–100% right) and the playback within 6%
of the speed drummed in 97–100%.

The rhythm is complete just before the beat after its last beat, at the tempo
its strokes have set, so a closing pair or triplet still fits. With no rests to
copy, a last beat still unstruck waits almost half a beat longer, so a dragged
final stroke ends the rhythm instead of leaving a rest and starting the next. It is then
locked in (`lockIn`): what was heard is fitted to the number of beats. Up to
two leading strokes may be dropped (at a cost, so only when that fits much
better), and a lone stroke well before the next is dropped outright; strokes
past the last beat, drummed in enthusiasm, are left out; silent beats at the
end are rests. A reading that fills fewer than half the beats is not taken.
It settles into solid dots and the drum crew plays it back from the next beat,
round after round.

A rhythm that opens with a pair or a triplet cannot be told from faster plain
beats until a tempo is known. A tempo already in the air is preferred (the
partner's, or in free drumming the loop just cleared), and a test drums 300
random rhythms at such a tempo and reads all but the two even triplet streams
exactly (those read as eighths, by design).

Once a rhythm loops it stays: strokes drummed over it are playing along (they
sound, move the dancers and feed the fire, but are not read as a rhythm), and
only A (Space, a swipe) stops it. The next rhythm drummed then becomes the
loop.

**Call and answer** (`CallSession`). One side calls a rhythm and the other
answers it; then the two play as one exchange, call and answer, round after
round, until A (Space, a swipe) clears it. The turn to call alternates: the
partner calls first, and each clear hands the call to the other side.
- **The partner calls:** the player answers with any rhythm of the same
  length. The answer sets the beat of the exchange (the call comes round again
  right after it). An unanswered call is played again.
- **The player calls:** the partner answers from the next beat with a riff
  (`riffOn`): the same first beat, with one or two later beats divided
  differently, at the player's tempo.

While the exchange plays, strokes are drumming along: heard (they move the
dancers and the fire) but not read as a rhythm. The exchange is kept as a loop
whose strokes are marked by who plays them, so the free-drumming loop code
drums it: the partner's half in their voice, the player's in their own drum.

An answer is read at the call's tempo, give or take about a third
(`readOptions`), so it cannot be mistaken for a rhythm twice as fast.

**In the chapters,** once a command is accepted the drum crew plays the rhythm
once more while the army acts, in the player's own drum, and its dots light
stroke by stroke with it; a sustained round after that is the army's drums,
lower and softer.

**Training** (`training.js`, wired in `main.js`). Every rhythm the chapters
ask the player to drum, in one numbered catalogue: the battle commands' tiers up
to each chapter's highest, the answering chapters' calls and the casting
rhythm, as designed (Medium, four beats). A rhythm used in several places is one
entry listing each use and chapter; entries are numbered in the order the game
first asks for them, so a number names the same rhythm whatever the settings.
Each is sorted by its shape (`levelOf`) into one of nine levels. A group is a
pair or a triplet; it is mixed when it switches drums inside (LR, LRR), and a
switch beside it is a change of drum between it and the stroke just before or
just after it.

1. **Steady:** quarter notes only.
2. **A pair:** one pair, and the whole rhythm on one drum.
3. **Switching:** one pair on one drum; the drums switch between beats.
4. **Turns:** one triplet on one drum, or one mixed pair, with no switch beside
   it (`L LR R`, not `L LR L`).
5. **Around:** one triplet or one mixed pair with a switch beside it, or two
   pairs or more.
6. **Runs:** two triplets or more, or pairs back to back; never pairs and
   triplets together.
7. **Mixed triplets:** a triplet that switches drums inside.
8. **Pairs and triplets:** both together, each on one drum.
9. **Everything:** pairs and triplets together, switching drums inside them.

The chapters' rhythms leave levels 2, 7 and 9 empty, so Training adds eight
rhythms of its own (`TRAINING_ONLY`, numbered after the chapters', marked
"Training only"), each keeping the deep-stroke rule. `LEVEL_OVERRIDES` moves a
numbered rhythm to another level by hand.

The screen shows the levels as numbered tabs across the top (◀ ▶, or a tap or
click), the level's name and what it holds at the head of its list, and the
level's rhythms down the left (▲ ▼): number, dots, uses, and how often
each was played well or missed this visit. It runs as an answering chapter of
its own: the partner plays the rhythm at its chapter's tempo, the player plays
it back, the reader judges it as in the game, a miss is told and counted, and a
rhythm played well leads on to the next (round again at the end of the level).
A plays it again. The point is to practise what the chapters ask, and to tune
which chapters ask for which rhythms, by number.

**The secondary drum.** The bronze drum stays the main drum. Beside it sits a
secondary drum, struck with Y (G or H; the small drum at the bottom right on
touch), and its strokes are part of the rhythm (drum `S`, a verdigris diamond
in the dots). LB and RB ([ and ], or ‹ › on touch) choose it from `SECONDS` in
`practice.js`: the barrel drum (trống chầu, the default, the drum that keeps
time for a performance), the mõ, the rice drum, low and high gongs, bamboo,
the lion-dance drum and cymbals. The loop, the replay, the partner's calls and
riffs play its strokes on it. The choice is remembered.

**Code.** `practice.js` holds the rhythm logic (reading, lock-in, the sessions)
and is tested on its own; `practice-play.js` is the shell's side (screens,
sound, scheduling the loop and partner), handed what it needs by `main.js`;
`render/practice.js` draws the green, the dots and the controls.

**The green.** The scene is the dusk sky and strips with a communal house
(đình), a lantern string, and a fire right of centre. The fire burns higher as
the drumming builds. Every stroke heard (the player's, the loop's, the
partner's) adds to the groove, and every five points of groove draws a dancer,
up to six. The dancers are feather-crowned like the figures on a Đông Sơn
drum, and they walk in from the right to places round the fire. A deep stroke
is a stamp with both arms up; a rim stroke is a hop with a flick to alternate
sides. When the drumming stops for two seconds the groove drains and the
dancers leave the way they came. Each new dancer is greeted by a shout and a clap
(`dancer-join`). The bed is a village edge at dusk (`amb-practice`): a breeze
in bamboo, a buffalo bell far off, birds settling. Over it the bonfire crackles
(`amb-fire`), quiet at first and rising with the fire as the drumming builds.
Nothing in either keeps a beat.

## Structure for the full game

The novel has two halves, and the game follows them:

- **Part one, the training years.** Short, quiet chapters at home: the garden,
  lessons, the sisters' friction, the father's death. These teach the rhythms
  through small scenes rather than battles.
Chapters 2–4 and 7–9 now cover the training years, the uprising and the
ending in playable form. What remains for the full game:

- **Part two, the uprising.** A campaign across the face of a bronze drum. Its
  rings are the regions to win over, and Mê Linh is the star at the centre.
  Each allied group (the mountain archers, the metalworkers of Nhật Nam, the
  river villages) adds a command or a unit.
- **The ending** is not a victory screen. The Han general Mã Viện collects and
  melts down the Lạc Việt drums. A quiet last scene about what is lost carries
  the book's point that the victory did not last.

## Art direction in one paragraph

Each depth is a panel of cut paper hung one in front of another, with a lamp
behind them all. The cuts glow, edges catch a rim of light, and each panel
throws a soft shadow on the one behind. The haze between panels is the lamp's
light. Figures are silhouettes whose detail is carried by cut holes: bead
collars, skirt bands, the lamellar slots of Han armour. Hits tear paper scraps
loose instead of drawing blood. The moon changes every chapter.
[image-requests.md](image-requests.md) has three style frames to settle how much
colour the paper carries before the full set is generated.

## Two looks: shadow puppets and water puppets

Settings, Style switches the whole game between two looks, at once and
mid-chapter. **Shadow puppets** is the look above. **Water puppets** stages the
same game as Vietnamese water puppetry (múa rối nước): lacquered wooden
puppets wading in a village pond, lacquer-painted scenery, red lanterns
strung overhead. Every image with the shadow-puppet look has a water-puppet
twin in the requests (BD-W, game id `wp-` + the shadow image's id, same size
and composition), and `art.js` hands out the twin in the water style. A twin
not yet delivered falls back to its shadow-puppet image, except the paper
fibre, the paper scraps and the paper panel, which the water style draws for
itself. The game draws the water style's own pieces (`render/pond.js`): the
pond over the feet and shins of everything standing on the ground, with the
scene mirrored faintly in it and rings of ripples round each figure (in place
of the foot shadows), the lantern string, and splashes and chips of lacquered
wood instead of paper scraps. Figures are lit from the front, with a soft
shadow behind instead of the backlight's glow, and the menu panels are black
lacquer edged in vermilion and gold. The sisters' jointed rigs stay the
shadow puppets' until the water twins' part sheets are cut; once the twin
sprite of a sister arrives and before her rig does, she is drawn whole.

## Open questions

- **Style.** White paper and lamplight, coloured papers, or shadow theatre
  (style frames S01–S03)?
- **Music (settled).** Because the player sets the tempo, nothing that plays
  during a chapter has a beat: each chapter has a beatless bed under the
  ambience, and a swell plays when the drum wakes. Themes with melody and metre
  play on the title and chapter select, with stings on the results and the
  ending piece after the epilogue. See `music-requests.md`. The five core
  tracks are delivered (Suno). Measured, none has a steady pulse: onset
  autocorrelation peaks at 0.07–0.22, where a steady beat scores about 1, so
  the beds don't fight the player's tempo. Loops crossfade on measured loop
  points rather than restarting (README, "Music").
- **A cultural reader.** Someone Vietnamese should check the costumes, names and
  how the Han are portrayed before production art.
