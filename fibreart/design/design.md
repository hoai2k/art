# Fibre Art: design

A shifting collage. The screen is one of Hanneke de Neve's pictures, built as
a live patchwork: a painted or quilted ground with cut pieces laid on it
(moons, hearts, trees, faces, figures, birds), threads and stitches over the
top, and patches of fabric showing through. The controllers reach into it.
A stick might stretch one moon, turn a whole panel, or set the entire picture
swirling. A button might make a single heart bloom, or dissolve the picture
into the next one. Some controls do small things and some do large ones.
Part of the play is finding the large ones, and part is using the small ones
to set them up: a moon nudged to the middle so the next swirl takes the whole
sky with it. When the scene shifts, the controls are dealt out again.

There is nothing to win and no way to lose. The aim is the feeling of her
work in motion: a dream that rearranges itself, one piece calling for another
("work creates more work, each new piece calls for another"), which you
learn to play a little like an instrument: a few small touches, then one
large gesture, and the picture is somewhere new.

This is a first design, written so the art can be requested. The prototype
waits for the images; how far the ideas below survive depends on how well the
generated pieces stretch, turn and dissolve.

## The picture

Each picture is a **tableau**, after one of her works (the list is in
[`image-requests.md`](image-requests.md)). A tableau has four layers, back to
front:

1. **Ground.** The full picture with the loose pieces taken out and the
   ground completed underneath them. It can itself be warped (a slow swirl, a
   ripple, a tide), panel by panel or as a whole.
2. **Panels.** Most of her pictures are divided into compartments: rooms,
   windows, quilt blocks, a framed scene inside a border. The game cuts the
   ground into those panels (rectangles or polygons defined per tableau) so a
   panel can slide, turn, fade or be swapped for the same panel of another
   tableau.
3. **Pieces.** The cut-out motifs, each its own transparent image: a moon, a
   heart, a tree, a face, a figure, a bird, a cloud. They are the main things
   that move.
4. **Threads.** Stitches, couched threads and ribbons, drawn on top: they
   trail behind moving pieces, sew pieces down when they settle, and unravel
   when something dissolves.

Fabric **textures** fill shapes and backgrounds where a panel is torn away or
a piece is stretched past its edges. **Dissolve masks** decide how one image
gives way to another: along a torn-paper edge, as a watercolour bloom, seam by
seam, thread by thread.

Every piece has a **home**: where it sits in the tableau's composition. Left
alone, pieces drift gently back toward home and the picture settles into the
painting it came from. Pushed, they leave it. The composition image is both
the reference the pieces are drawn from and the resting state of the game.

## Verbs

What an input can do to its target:

| Verb | Small | Large |
| --- | --- | --- |
| **Nudge** | A piece slides a little and springs back. | A panel slides out of its frame and the ground shows through. |
| **Stretch** | A moon pulls into an oval. | The whole picture pulls like cloth in one direction. |
| **Turn** | A face tilts. | A panel or the whole tableau rotates, pieces holding on. |
| **Fade** | A piece turns translucent. | A layer (all pieces, all threads) fades out, then back. |
| **Swirl** | A small eddy around one piece. | The picture twists into a slow whirlpool and unwinds. |
| **Bloom** | A heart swells and its stitches loosen. | Every piece of one kind swells together. |
| **Morph** | A piece steps along its morph chain (moon to sun). | Every piece on a chain steps at once. |
| **Dissolve** | A piece frays away and returns as another piece. | The tableau dissolves into the next one through a mask. |
| **Pour** | A wash of colour spreads from a piece. | The palette of the next tableau floods in. |
| **Stitch** | A thread runs from one piece to another. | Threads sew the whole picture back together and it settles. |

## Controls

Each player holds a controller. In every scene each input is **bound** to a
target and a verb at a scale: the left stick *stretches* the *crescent moon*
(small), the right trigger *swirls* the *whole picture* (large), A *blooms*
the *hearts* (medium), and so on.

- **Sticks** are continuous: direction and amount drive the verb, and letting
  go eases the target home.
- **Triggers** are continuous one-way amounts: how far to swirl, fade or pour.
- **Face buttons and bumpers** are events: bloom, morph a step, dissolve,
  stitch, swap two pieces.
- **D-pad** ("Select" in the instructions) steps the last control used to
  the next target of the same kind (the next moon, the next face) without
  changing the verb. In menus it moves between choices.
- **Menu** pauses; **View** shows the bindings found so far as a card.

### Finding the big controls

Each scene deals out its bindings when it begins and keeps them while it
lasts. Most do small things: a moon slides, a face tilts, one heart swells.
A few do large things: the whole picture swirls, a panel turns over, the
palette of the next scene pours in. Nothing says which is which. The player
finds out by trying, and the first time an input is used the target lights
up with a running stitch, so a found control stays known.

The large controls are what shift the scene. Finding one and leaning on it
is how the picture is carried somewhere new: a big swirl that leaves every
piece in a new place, a pour that turns the night quilt to dawn, a dissolve
into the next tableau.

### Small moves set up big ones

The large effects are not fixed in place. Each has an **anchor**, a piece it
is centred on, and a **reach** that depends on how the picture is arranged.
That is what the small controls are for:

- **Placing the anchor.** The swirl turns around the violet sun. Nudging the
  sun into the middle of the wood with a small control makes the next swirl
  take the whole wood with it; left in a corner, the same swirl only stirs
  that corner.
- **Linking pieces.** Effects travel along links. Two pieces of one morph
  chain that touch (a moon resting against a heart), or that a thread has
  sewn together, act as one: bloom one and the other blooms; morph the moon
  and the heart morphs with it. A few small moves can chain a large part of
  the picture together, so one button then moves all of it.
- **Opening a panel.** Some large controls are sleeping and only do a small
  thing until the picture is ready: a panel turns over only when a piece of
  the right kind sits in it (a moon in the window, a face in the frame); the
  tableau dissolves only when its pieces are lined up along the horizon,
  as she starts every picture from a horizon.
- **Clearing the way.** A piece in the path of a large effect can hold it
  back: a heavy tree stops the tide at its trunk until it is moved aside.

So a scene plays as small moves that set something up, followed by a large
effect that changes everything, after which the arrangement is new and the
small controls have new things to set up. Some setups are obvious; some are
found by accident.

### When bindings change

Bindings are dealt anew when the scene shifts: a new tableau, or a large
effect big enough to rearrange the picture. Within a scene they hold still,
so what has been found can be used. A few of the old bindings carry over to
the new scene at the same scale but on new targets, so the player is never
starting from nothing. Roughly six in ten bindings are small, three medium
and one large, and every scene has at least one large control and at least
one small control that sets it up.

### Showing what is bound

Nothing is drawn over the picture while playing: no captions, counters,
outlines or messages. The owner asked for this, to keep the player inside the
picture. What has been found lives in menus: the View button (Tab on a
keyboard) and the pause menu open the card of controls found in this scene,
with how to wake each large one. The threads between sewn pieces still show,
because they are stitches in the picture, not interface.

The hints are still there for anyone who wants them, behind **Show hints
while playing** in Settings (off by default). With it on: a found control's
target is outlined with a running stitch in the player's thread colour; a
small line drawing of the control (a stick, a trigger, a button) is pinned
near it for a few seconds; a dotted ring round a large control's anchor shows
its reach and tightens as its setup nears waking; player chips count what each
player has found; the scene's name shows as it begins; and short messages
mark a big find or a rearrangement.

**Text is kept to a minimum** (the owner's ask). Loading shows no words, only a
row of pale tacking stitches sewn over in red as the first picture's images
arrive. The title screen has the title and Press Start (no subtitle),
with no hint line under it (so the guidelines' "Move left stick for options"
is left out; the stick still opens the corner buttons). The pause menu is
pictures, not words: controls found, hint, how to play, settings, next
picture, back to the title, as round badges in a 3 x 2 grid (up and down move
a row). There is no resume badge: a click outside a panel closes it, as do B
and Menu. Each badge's name is its accessible name and shows small on hover
or focus, in front of the badges below. The title's three corner buttons are
badges too (how to play and settings from the same set, fullscreen drawn until
its own badge, HK-U07, arrives). Panels close with a plain drawn X in the top
right: the set's eighth badge, crossed pins, faded to a faint cross at that
size, and the owner preferred a simple X to a cloth one. The instructions are
three sentences, the controller diagram, a short table and one line for mouse
and touch. The badges come from the appliqué set (HK-U06), cut by
`build_web.py` and swapped in by the game.

In menus the controller's stick steps like a key: once when pushed, then after
a pause at a steady pace while held, resetting when let go; a stick already
held when a menu opens waits to be let go. (Before, it stepped every frame
while held sideways, so focus raced round the pause menu.) Closing a panel
returns to the choice that opened it. A panel that is only text to read (how
to play, the hint, the controls found) scrolls with up and down on the d-pad
or either stick, so a controller player can read all of it.

**Credits.** Settings ends with a Credits button (in place of a Reduce motion
switch, which now follows the system setting): principal game designer Hoai
Nguyen and the technology (the AI tools it was made with, Claude Code, ChatGPT
Codex, ChatGPT image generation and Suno, plus WebGL 2), then one sentence:
inspired by the work of Hanneke de Neve, linked to her page at elevenland.com.

**Hint.** The eye in the pause menu opens a card for each player's big control:
a drawing of the control, the piece it is centred on (cut from the picture),
a small picture of what wakes it (to the middle, sewn together, brought to a
partner, or a tick when it is ready), and one line, such as "Bring a tree to
the middle (LS), then hold RT." It names the small control that moves the
piece, so it says plainly how to carry the picture on.

The pause button is out of sight while playing and comes up for a moment when
the mouse moves or the screen is touched, so a player with only a mouse or a
touch screen can still reach the pause menu. On a touch screen the pause menu
shows every badge's name under it, since there is no hover.

**The hand (touch and mouse).** There is no on-screen controller: the owner
found it got in the way of the picture. Instead the pieces are the controls.
The hand plays as the keyboard player, and whatever that player's controls are
bound to the piece under the finger answer it: dragging a piece plays its
sticks (direction and speed of the drag), holding it still plays its triggers
(pressing in after about a third of a second), and tapping it plays its
buttons, one after another, a tap each. The bare cloth does the same for the
controls bound to that panel of the picture. Every piece can also be grabbed,
dragged and flung (it keeps the finger's speed and glides home), pinched and
twisted. So a big control is woken by hand the way the hint says: drag the
anchor to the middle or to its partner, tap it to sew, then hold or drag it.
The hint and Controls Found name the gesture (drag, hold, tap) instead of the
input for a hand player.

**Full screen** (Bronze Drum's approach, `src/chrome.js`). The fullscreen
button shows only where the browser can do it (the standard API or Safari's
webkit one), and not when opened from the home screen. On a phone or tablet
on its side, the first touch asks for fullscreen (browsers allow it only
inside one) and locks landscape where it can. Safari on iPhone has no
fullscreen for a page, but tucks its bars away on its side when a finger
scrolls the page, so there the page is made taller than the screen; while
the bars show outside play, a stitched pill at the top says "Swipe up".
During play the page cannot scroll, so the hand keeps every gesture. The game
is fitted to the visible viewport (Safari's 100vh ignores its bars), and
`manifest.webmanifest` installs it from the home screen as a full-screen,
landscape app.

**Players.** One to four controllers, each with its own thread colour (red,
saffron, teal, violet) and its own bindings, dealt from targets the others
are not holding. One player can set up what another player's large control
then sets off.

**Keyboard and pointer.** Drag a piece to nudge it; drag with the right
button to turn; the wheel stretches; keys stand in for the face buttons and
are dealt bindings on the same rules.

## Moving between tableaux

A tableau lasts until a large dissolve or pour carries it on, usually after a
few minutes; if nobody finds one, it drifts on by itself after a while. The next tableau is chosen so at least
one piece can travel: pieces that share a **morph chain** (moon, sun, heart;
bare tree, budding branch, berry tree) step along it, then hold their place
while the old ground dissolves under them and the new one appears, then
drift to their new homes. So the crescent moon of the night quilt can become
the violet sun over the green wood.

## Rendering

WebGL2 on a single canvas.

- Pieces are textured meshes (a grid of 8 × 8 or so per piece), so stretch,
  swirl and bloom bend them rather than scaling flat quads.
- Swirl, ripple and tide are displacement fields applied to the ground and
  the pieces together, so the whole picture moves as one cloth.
- Dissolve is a shader: a mask texture thresholded over time, with a narrow
  band at the edge drawn as frayed thread or paper fibre in a colour from the
  outgoing tableau.
- Morph is a cross-dissolve between two chain stages through a mask, with the
  outline warped from one silhouette toward the next, so the change looks
  grown rather than faded.
- Threads are strokes along splines, textured from the stitch sheet.

## Life

The pictures are never quite still (`game/src/life.js`). Life changes only how
a piece is drawn, never where it is, so the controls, setups and homes are
untouched, and it runs under everything the players do.

- **Wind.** Each scene has its own wind (Viriditas the most, the crowd hardly
  any). A wandering breeze, and every 6 to 15 seconds a gust that sweeps across
  the picture from the left as a travelling front.
- **Trees, reeds, buds and flowers** bend from the base, more at the top, and
  lean further as a gust passes. **Loose leaves** lift from the trees or blow in
  from the left on a gust and tumble across (in the four windy outdoor scenes).
  Single leaves, clouds and ribbons on the ground are nudged by the gust and
  spring back.
- **People.** Faces tilt and settle, bodies and figures breathe; the dancers sway
  and rise as if dancing in place. Hair moves with the wind.
- **Sky.** Clouds drift and swell, suns and moons glow, stars twinkle.
- **Others.** Hearts beat twice and rest, fish swim and wiggle, ribbons and the
  comet band ripple, Blue Lady's water moves, the floating eye blinks, the bird
  bobs and hops, the reaching hand reaches.
- **Swaps from art.** Closed eyes for the open-eyed faces (blinks, about every
  four to seven seconds) and the bird's poses (a quick flap, and now and then a
  ruffle with a look back) come from the Life requests. Generated swaps are
  framed a little differently from the pieces they replace, so `build_web.py`
  fits each one onto its original's silhouette (best scale and offset) before
  saving it; without that, eyes and outlines visibly jumped.
- **Reduced motion** (the system setting; there is no switch in the game) scales
  all of it to a third and stops the blowing leaves.

The finished composition used to fade in under the pieces when everything was
home and still; with the pieces alive it showed as ghosts, so it is gone. The
pieces over the ground already read as the painting.

## Stand-ins

All 60 requests are delivered, so nothing is drawn as a stand-in now. The code
for stand-ins stays in `tools/build_web.py` for any future request: pieces cut
by colour from the composition, a blurred wash for a missing ground, an icon
from the moon chain, single scene leaves for the gusts, and no swaps (faces
only breathe and tilt). A scene's `standin` list in `web/scenes.json` says
which are in use.

## What playing it with the art showed

Played through every scene in Chromium with a simulated controller (see
`game/scripts/browser-check.mjs`; screenshots were reviewed by eye):

- **The pieces hold up.** Bent on 24 × 24 meshes, stretched to twice their
  size, turned and swirled, the cut-cloth pieces stay readable, and their
  frayed edges hide the seams of the mesh. The open question about hard
  stretching is answered: stretch stays.
- **Each scene reassembles into its composition.** With homes placed by eye,
  pieces over the ground come very close to the generated composition. The
  pieces are not pixel matches, which is fine for a collage.
- **The large swirl is a whirlpool of cloth.** At full reach it twists the
  whole picture and shows the backing fabric at the edges. It is dramatic; it
  is clamped by its own unwinding spring, and reduced motion halves it.
- **Scene changes are the most striking moment.** Halfway through a dissolve
  the two pictures interleave through the torn-paper or unravelling mask (the
  night quilt's moons in the Viriditas wood, the Golden Lady breaking through
  the quilt), which is the organic morphing the game is after. A traveller
  piece carries across and grows into its chain partner.
- **Turning a panel over** shows the scene's fabric (green silk, indigo batik)
  as a block of pure pattern, which reads as part of the quilt.
- **Layering needed a rule:** sky pieces (bands, clouds, suns) draw behind the
  rest, or the comet band covers the two moons.
- **Pinned drawings crowd** when several controls are found at once; at most
  four show. The hand, spool and needle drawings stand in for the controls
  themselves, which led to request HK-U05.

### With the second round of art (all requests delivered)

- **Moons and hearts and The dancers** now use generated pieces; they sit on
  their compositions as closely as the colour-cut stand-ins did, with cleaner
  edges. The dancers' fourth piece, a red dancer reaching up, has no place in
  the composition, so she stands small inside the empty quilted window.
- **Viriditas** has its real ground: the wood is dense and full, no longer thin.
- **Blinks** close the eyes in place in The Golden Lady, the crowd and The black
  tree once fitted; the bird's poses settle on its feet (raised wings are
  clipped a little at the top of the piece's frame).
- **Loose leaves and petals** blow across the windy scenes; a few sheet cells
  carried slivers of their neighbours, so each cell keeps only its main shape.
- **Tree and bird chains** let trees step from bare to budding to berried, and
  birds, fish and single leaves change into one another.
- The control drawings (a stick, a trigger, a button, a bumper, the D-pad) are
  pinned beside newly found controls.

## Open questions

- How many large controls a scene should have, and how hidden their setups
  should be, before finding them stops feeling like discovery and starts
  feeling random. Each player now has one large control (sometimes two) and the
  small one that sets it up; this wants playing with real people.
- Whether the card of controls found should say how to wake a large control
  (it does now) or leave that to be discovered.
- Sound: the owner's song, *Aksak Folk Dance* (a Suno piece by hoai2k, 4:34,
  in C minor), loops under every scene from Press Start; the Music slider sets
  its level, and it pauses while the page is in the background. The plucks,
  chimes and the rush of big movements are made in the browser, in the song's
  key (C minor pentatonic) so they play along with it. If the song cannot load,
  a held chord per scene stands in. Recorded sounds (plucked strings, a sewing
  machine, cloth) could replace the made ones; not requested yet.
- Online multiplayer through `multiplayer/` could let several people shape
  one collage from different places; not planned for the first build.
