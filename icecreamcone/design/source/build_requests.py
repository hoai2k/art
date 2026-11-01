#!/usr/bin/env python3
"""Generate the Ice-Cream Cone Coot image requests and the game's asset list.

Edit the data in this file, then run:

    python3 icecreamcone/design/source/build_requests.py          # write
    python3 icecreamcone/design/source/build_requests.py --check  # verify up to date

Outputs:
    icecreamcone/design/image-requests.md          the open requests (status requested)
    icecreamcone/design/image-requests-history.md  the finished ones (delivered or retired)
    icecreamcone/game/src/asset-list.js     what the game loads

Statuses:
    requested  the game draws its own stand-in and does not try to load the file
    delivered  the file is in icecreamcone/game/assets/ and the game loads it in place
               of the stand-in
    retired    delivered once, no longer used: the file stays, the game does not
               load it
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "design" / "image-requests.md"
HISTORY = ROOT / "design" / "image-requests-history.md"
ASSET_LIST = ROOT / "game" / "src" / "asset-list.js"

# The look every image shares: an old picture book, ink and watercolour.
STYLE = (
    "Children's picture-book illustration in the style of Arnold Lobel's 1971 book The "
    "Ice-Cream Cone Coot and Other Rare Birds: fine brown-black pen-and-ink line with delicate "
    "crosshatching and stippling, soft transparent watercolour washes in a slightly faded "
    "early-1970s print palette (lemon and mustard yellow, olive and sage green, dusty pink and "
    "mauve, strawberry pink, ochre, slate blue, warm grey), on cream paper with visible grain. "
    "Whimsical, gentle and slightly eerie, dreamlike mood. No text, no lettering, no watermark, "
    "no border, no UI."
)

# Where the reference photos of the book live once pushed (icecreamcone/reference/).
REF_URL = "https://raw.githubusercontent.com/hoai2k/mini/main/icecreamcone/reference/"
REF = (
    "Match the design of this bird in the reference photo of the book, " + REF_URL + "{0} , "
    "keeping its shapes, colours and proportions, but as a clean new full-colour painting of "
    "the bird alone (no book, page, hands or printed text)."
)
REF_SCENE = (
    "For the drawing style, palette and mood, look at the reference photo of the book, "
    + REF_URL + "{0} ."
)

BIRD = (
    "The bird IS the object: a real, clearly recognisable everyday object that has come alive as "
    "a bird, with a round staring eye with a dot pupil, a long pointed beak, little wings or "
    "plumes, and long, thin, knobbly bird legs ending in spiky claws, growing naturally out of "
    "it, so the object's shape still reads at a glance. Calm and a little odd, not a cartoon "
    "mascot: no human expression, no smile."
)

ALPHA = (
    "Transparent background (PNG with alpha). If transparency is not possible, use a flat pure "
    "magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on "
    "integration."
)

PORTRAIT = (
    "Full-body portrait of the bird alone, standing in a three-quarter view facing left, filling "
    "about 80% of a square frame, centred, with a clean silhouette that still reads at 96 px. "
    "Only a small soft shadow under the feet. " + ALPHA
)

SCENE = (
    "Background painting for a children's minigame, wide 16:9, full bleed. The scene is empty of "
    "birds, people and animals (the game draws them on top). "
)

SECTIONS = {
    "book": (
        "Sticker book backgrounds",
        "One picture per bird for the pages of the sticker book, unlocked when the player passes that "
        "bird. The player picks one with LB/RB and arranges the bird stickers on it. Until a picture "
        "arrives, the book offers that bird's game scene instead.",
    ),
    "ui": ("Brand", "The title screen, the browser tab, the game library card and the book's paper."),
    "bird": (
        "Bird portraits",
        "One portrait per bird. Each is shown large on the bird's page in the field guide and is "
        "the bird itself in its minigame, where the game moves, tilts and squashes it.",
    ),
    "scene": (
        "Minigame scenes",
        "One background per minigame. The game draws the birds and everything that moves on top, "
        "so each scene leaves the play area quiet, as its prompt says.",
    ),
    "subject": (
        "Shuttercluck's subjects: the book's other birds",
        "Say Cheese photographs the undiscovered birds, the ones you don't play as: these are the rest of Lobel's "
        "birds: the 18 of the book's 28 that the field guide doesn't have a page for, so that "
        "every bird in the book has a painting. The names come from the book as quoted in its "
        "descriptions and reviews; most birds are matched to the crowded yellow endpapers "
        "(reference/endpapers-all-birds.jpg), where each prompt says where to look. Four are named "
        "but not found in our photos, so they are drawn from their names; two endpaper birds (the "
        "saw and the radio) are in the pictures but their names were not found, so they have plain "
        "names for now. The Drippet as the tap is a likely match, not a certain one. Each is drawn "
        "like the field-guide portraits, at the same framing, because the game raises them over "
        "hedges, walls and the knothole the same way.",
    ),
    "pocket": (
        "In our pocket: ten new rare birds",
        "A second flock in Lobel's manner, invented here, for when the field guide grows beyond "
        "the book's own birds. Until then they have no page, but they are among the undiscovered "
        "birds that Shuttercluck photographs in Say Cheese. Each note says what its game might "
        "be. Same framing as the portraits, so any of them can become a page later.",
    ),
    "more": (
        "New minigames: the book's other birds",
        "Scenes, sprites and variants for the minigames of the book's 18 birds that are joining "
        "the field guide (their portraits are the IC-R requests above). Each bird's requests are "
        "kept in design/source/more/<bird>.json beside this script. The birds join the guide "
        "once these are delivered; until then their games draw stand-ins (try them with ?more).",
    ),
    "sprite": (
        "Sprites and variants",
        "What the minigames need beyond one still portrait per bird, found while building them "
        "and checking them with the first art. A portrait can only breathe and hop, so a bird "
        "that steps, grows, sings or changes shows that with these variants; and the props each "
        "game still draws in code (scoops, hats, cars, stones, hiding places) get painted "
        "versions so nothing drawn in code sits on top of a painted scene. Every variant must "
        "match its delivered portrait exactly in design, colours and line (the portrait in "
        "game/assets/birds/ is the reference), drawn at the same scale and facing left.",
    ),
}

# A sheet of separate sprites: the game cuts them apart by their transparent gaps.
SHEET = (
    "A sprite sheet of separate objects on one transparent background, evenly spaced in the grid "
    "the prompt gives, each object centred in its cell with clear empty space all round it (no "
    "object touching another or the edge), all lit the same way from the upper left, no cast "
    "shadows. " + ALPHA
)
VARIANT = (
    "Exactly the same bird as in its delivered portrait (same design, proportions, colours, "
    "line and texture; use that portrait image as the reference), at the same scale, facing "
    "left, with only the change described. "
)

# Each bird: id (also the file name), name, the reference photo in
# icecreamcone/reference/, the portrait description and its minigame scene.
# Order is the order of the field guide. The descriptions follow the book's own
# drawings; see icecreamcone/reference/README.md.
BIRDS = [
    {
        "id": "coot",
        "name": "The Ice-Cream Cone Coot",
        "ref": "cover-ice-cream-cone-coot.jpg",
        "look": "The Ice-Cream Cone Coot, as on the book's cover: its body is a golden waffle "
        "ice-cream cone lying on its side, tip pointing back and down, crowned with a big lumpy "
        "lemon-yellow scoop (tiny brown speckles) as its chest and back. A thin neck striped red "
        "and yellow like a candy straw curves up to a head that is a pink strawberry scoop, with "
        "one big pale-blue round eye and a beak that is a small waffle cone pointing forward. "
        "Three orange wafer fingers tipped with magenta bobbles stick out behind the head as a "
        "crest. A little mint-green and pistachio drip where cone meets scoop. Two long thin legs "
        "striped pink and white, ending in spiky magenta bird feet.",
        "scene": "A sunny seaside promenade in summer: a striped ice-cream cart with an awning at "
        "the far right edge, a pale wide sky with a few soft clouds over a calm sea, and a flat "
        "wooden boardwalk running along the bottom fifth. Keep the whole upper two-thirds open, "
        "plain sky, because ice-cream scoops fall through it.",
        "used": "Scoop Stack, the scoop-catching game",
    },
    {
        "id": "cupadee",
        "name": "The Cupadee",
        "ref": "cupadee-and-shuttercluck.jpg",
        "look": "The Cupadee: a pale-yellow china teacup with a dusty-pink band around its rim is "
        "its body, tipped slightly forward. Its round eye with a dot pupil is on the side of the "
        "cup, a long sharp ochre beak points forward and down from the cup's front, and the cup's "
        "curly handle is at the back with a little tuft of yellow tail feathers. It stands on two "
        "very long, thin, knobbly legs with spiky claws.",
        "scene": "A tea table in a sunny old-fashioned kitchen: a lace-edged tablecloth across the "
        "bottom third, a window with a geranium, a dresser with plates far behind. Keep the "
        "tabletop and the space above it clear, because the teapot and the Cupadee go there.",
        "used": "Tea Time, the pouring game",
    },
    {
        "id": "shuttercluck",
        "name": "The Shuttercluck",
        "ref": "cupadee-and-shuttercluck.jpg",
        "look": "The Shuttercluck: its body is a boxy old 1930s camera in dark brown-black "
        "leatherette with a little viewfinder and a winding knob on top. Its single big round "
        "lens, ringed in yellow, is its one staring eye on the front. A long, tapering tan beak "
        "sticks straight out of the camera's side, curly pink plumes rise from the top as a crest "
        "and curl out of the back as a tail, and it stands on two short scaly orange legs with "
        "grey claws.",
        "scene": "A quiet meadow at midday: tall grass along the bottom, a low mossy stone wall, two "
        "round bushes, a hollow old tree with a knothole, a hedge and a wooden gate, spread evenly "
        "across the picture with sky above, so there are many places a bird might peek out from.",
        "used": "Say Cheese, the photograph game",
    },
    {
        "id": "gullfinch",
        "name": "The Gramophone Gullfinch",
        "ref": "gramophone-gullfinch.jpg",
        "look": "The Gramophone Gullfinch, in olive and mustard yellow: a huge fluted brass "
        "gramophone horn flares out behind its head like a giant flower, a small green-grey finch "
        "head with a round eye and a spray of long curved yellow crest feathers sits where the "
        "horn narrows, a neck of overlapping scaly feathers curves down to its body, which is a "
        "square record-player box with a black record and a tone arm on top and a crank handle on "
        "the side. It stands on one long, thin yellow leg with long claws, the other leg raised.",
        "scene": "A cosy old parlour in the evening: patterned wallpaper, a fringed lamp, an "
        "armchair, a rug and a little table, all around the edges. Keep the centre and the lower "
        "middle open, plain wall and floor, for the gramophone and the notes that float to it.",
        "used": "Wind and Sing, the music game",
    },
    {
        "id": "plume",
        "name": "The Flowerpot Plume",
        "ref": "flowerpot-plume.jpg",
        "look": "The Flowerpot Plume: a dusty-pink terracotta flowerpot is its body, with a small "
        "ochre-yellow face on the upper front of the pot (one round eye, a short magenta beak), "
        "a little pink wing on its side, a pink tail tuft at the back, and two short orange legs. "
        "A small yellow-green sprout of leaves grows from the soil at the top of the pot, which "
        "is its head.",
        "scene": "A sunny cottage garden: a long wooden potting bench runs across the lower third, "
        "a brick wall with climbing roses behind it, open sky above. Keep the bench top and the "
        "sky above it clear, because the pots and the watering can go there.",
        "used": "Bloom, the watering game",
    },
    {
        "id": "bobolinks",
        "name": "The Highbutton Bobolinks",
        "ref": "highbutton-bobolinks.jpg",
        "look": "The Highbutton Bobolinks: a pair of old-fashioned ladies' high-button boots in "
        "dusty mauve-pink leather with a row of small round buttons, cream soles and little "
        "heels. Each boot is a bird: a round yellow eye near the top and a long white pointed "
        "beak opening upward out of the boot's top, singing. The two stand side by side, one "
        "slightly behind the other, as a left and a right.",
        "scene": "A night stream through woods seen from the side: dark blue-black sky with a "
        "small glowing yellow moon, gnarled branches at the edges, dark water across the lower "
        "half catching the moonlight. Keep the water's surface open, without stones, because the "
        "game places the stepping stones.",
        "used": "Left Foot, Right Foot, the stepping-stone game",
    },
    {
        "id": "peeper",
        "name": "The Newspaper Peeper",
        "ref": "newspaper-peeper.jpg",
        "look": "The Newspaper Peeper: its body is a folded sheet of old newspaper standing "
        "upright, covered in columns of tiny grey print, a bold headline and two small printed "
        "photos; long torn strips of newspaper curl up and back from the top as its crest and "
        "tail. A pale-yellow bird head with a round eye and a long thin open beak leans out "
        "from the top-left corner, and it stands on two yellow legs with long claws.",
        "scene": "An old print shop: a big iron printing press at the left edge, drying sheets "
        "pegged on lines along the top, wooden type cases on the far wall, a plank floor along "
        "the bottom. Keep the middle open, because letters flutter through it.",
        "used": "Hot off the Press, the letter-catching game",
    },
    {
        "id": "piffle",
        "name": "The Pincushion Piffle",
        "ref": "pincushion-piffle.jpg",
        "look": "The Pincushion Piffle: a plump round olive-ochre pincushion body bristling with "
        "pins along its back like a crest: pearl-headed pins in rose, cream and plum, long "
        "needles, hatpins and two safety pins. A silver thimble with a lacy dimpled pattern sits "
        "on the front like a little hat, a short pointed tail sticks out at the back, and it "
        "walks on two thin dark legs.",
        "scene": "A sewing table seen from above at a slight angle: a patterned quilt laid across "
        "it, a tape measure, a spool of red thread and a pair of scissors at the edges. Keep the "
        "middle of the quilt open, because the stitching path is drawn there.",
        "used": "Stitch in Time, the sewing game",
    },
    {
        "id": "dodo",
        "name": "The Dollarbill Dodo",
        "ref": "dollarbill-dodo.jpg",
        "look": "The Dollarbill Dodo: its body is a long, flat, green-yellow paper banknote held "
        "level like a plank, with ornate engraved borders, scrolls and a numeral 1 in each corner "
        "(an invented note, not a real currency, no portrait). Curly yellow-green feather tufts "
        "at the back end, a long two-pointed yellow beak at the front, and two thin yellow legs "
        "underneath.",
        "scene": "A shop counter in an old general store: a polished wooden counter top across "
        "the lower third, a brass till at the far left, shelves of jars behind. Keep the counter "
        "top clear, because the hats the Dodo hides under go there.",
        "used": "Spot the Dodo, the shell game",
    },
    {
        "id": "crow",
        "name": "The Safecrossing Crow",
        "ref": "endpapers-all-birds.jpg",
        "look": "The Safecrossing Crow, as in the bottom right of the book's endpapers: its head "
        "is an old-fashioned dark-green cast-iron traffic signal lantern with a knob on top, "
        "little spikes at the sides and three round lamps (red, amber, green) in a column, a "
        "short pointed beak and a tuft of orange tail feathers. The lantern sits on a long thin "
        "black pole that is its neck, and it stands on two very long, thin black legs with pink "
        "spiky feet. Show all three lamps dim and unlit, because the game lights them.",
        "scene": "A small-town street crossing seen from slightly above: a road runs straight "
        "across the middle of the picture from left to right, with a striped zebra crossing in "
        "its centre, a pavement in the foreground at the bottom and another along the far side, "
        "old shop fronts and a tree behind. The road and pavements are empty of cars and people.",
        "used": "Safe Crossing, the traffic game",
    },
]

OBJECTS = {
    "coot": "an ice-cream cone with strawberry and lemon scoops",
    "cupadee": "a yellow teacup",
    "shuttercluck": "an old box camera",
    "gullfinch": "a wind-up gramophone",
    "plume": "a terracotta flowerpot with a blooming plume",
    "bobolinks": "a pair of pink high-button boots",
    "peeper": "a newspaper",
    "piffle": "a pincushion full of pins",
    "dodo": "a banknote",
    "crow": "a traffic light on stilt legs",
}
ALL_BIRDS = "; ".join(f"{b['name'][4:] if b['name'].startswith('The ') else b['name']} ({OBJECTS[b['id']]})" for b in BIRDS)

REQUESTS = [
    {
        "id": "IC-U01",
        "section": "ui",
        "name": "Title logo",
        "key": "logo",
        "file": "assets/ui/logo.png",
        "size": "1600 x 800, transparent",
        "used": "The title screen above Press Start, and the card on the game library page.",
        "standin": "The title set in the page's serif font in brown ink.",
        "ref": "cover-ice-cream-cone-coot.jpg",
        "status": "delivered",
        "prompt": "A hand-lettered picture-book title in brown ink and watercolour, like the "
        "cover of an early-1970s children's book: old-fashioned, slightly wobbly serif letters "
        "with fine crosshatched shading, filled with soft washes of strawberry pink, vanilla cream "
        "and waffle-cone ochre. Two lines, spelled exactly: a large first line \"The Ice-Cream Cone "
        "Coot\" and a smaller second line \"and Other Rare Birds\". A tiny ink drawing of a coot "
        "whose body is an ice-cream cone stands at the end of the second line. For the lettering "
        "and the coot, see the book's cover: " + REF_URL + "cover-ice-cream-cone-coot.jpg . Wide landscape "
        "composition, the lettering filling about 85% of the width, even margins, no other text. "
        + ALPHA,
    },
    {
        "id": "IC-U02",
        "section": "ui",
        "name": "Title background",
        "key": "titleBg",
        "file": "assets/ui/title-bg.webp",
        "size": "1920 x 1080, opaque",
        "used": "Full-screen behind the title screen; also the cover of the game library card.",
        "standin": "A painted-in-code landscape of hills under a pale sky.",
        "ref": "endpapers-all-birds.jpg",
        "status": "delivered",
        "prompt": STYLE + " A wide, dreamy landscape at golden hour: gentle rolling hills, a "
        "winding path, a split-rail fence and a few round trees, a pale peach and slate-blue sky. "
        "Small in the middle distance, rare birds made of everyday objects go about their day: a "
        "teacup bird on long legs, a camera bird, a pair of pink high-button boots singing on a "
        "fence, a traffic-light crow on stilt legs, a newspaper bird. Keep the upper-middle "
        "half calm and open (plain sky) for the title, and the bottom-right corner quiet for "
        "buttons. Full-bleed 16:9.",
    },
    {
        "id": "IC-U03",
        "section": "ui",
        "name": "App icon and favicon",
        "key": "icon",
        "file": "assets/ui/icon.png",
        "size": "1024 x 1024, transparent",
        "used": "Browser tab, home-screen icon (scaled to 512, 192 and 180 px).",
        "standin": "A drawn icon: an ice-cream cone with a coot's head on a cream tile.",
        "ref": "cover-ice-cream-cone-coot.jpg",
        "status": "delivered",
        "prompt": STYLE.replace("No text, no lettering, no watermark, no border, no UI.", "")
        + "App icon: the Ice-Cream Cone Coot from the book's cover (" + REF_URL
        + "cover-ice-cream-cone-coot.jpg ): its pink strawberry-scoop head with the big pale-blue "
        "eye, waffle-cone beak and orange wafer crest, and the top of its striped neck, on a rounded-square cream paper tile with a thin brown "
        "ink border. Bold and simple, readable at 48 px; the bird fills about 75% of the tile. No "
        "text. Transparent corners outside the rounded square (PNG with alpha), or flat magenta "
        "#FF00FF corners if transparency is not possible.",
    },
    {
        "id": "IC-U04",
        "section": "ui",
        "name": "Paper texture",
        "key": "paper",
        "file": "assets/ui/paper.webp",
        "size": "1024 x 1024, opaque, tiling",
        "used": "The pages of the field guide, behind every page and card.",
        "standin": "A flat cream colour with a faint drawn grain.",
        "status": "delivered",
        "prompt": "A flat scan of plain, slightly aged cream watercolour paper: soft natural "
        "grain, very faint fibres, a few barely-there warm speckles, even lighting, no folds, no "
        "stains, no vignette, nothing drawn on it. A square tile that repeats seamlessly in both "
        "directions: each edge continues exactly into the opposite edge.",
    },
    {
        "id": "IC-U05",
        "section": "ui",
        "name": "All the birds together",
        "key": "gathering",
        "file": "assets/ui/gathering.webp",
        "size": "1920 x 1080, opaque",
        "used": "The last page of the field guide, shown once every bird has been spotted.",
        "standin": "Every bird's portrait (or stand-in) drawn together on a hillside.",
        "ref": "endpapers-all-birds.jpg",
        "status": "delivered",
        "prompt": STYLE + " " + BIRD + " A crowded, happy gathering of all the rare birds "
        "together for a group portrait, each clearly visible: "
        + ALL_BIRDS + ". Packed and lively like the book's endpapers (" + REF_URL + "endpapers-all-birds.jpg ), "
        "on a pale lemon-yellow ground with a grassy strip along the bottom. Full-bleed 16:9.",
    },
]

for n, b in enumerate(BIRDS, 1):
    REQUESTS.append({
        "id": f"IC-B{n:02d}",
        "section": "bird",
        "name": b["name"],
        "key": f"bird.{b['id']}",
        "file": f"assets/birds/{b['id']}.png",
        "size": "1024 x 1024, transparent",
        "used": f"The bird's page, and the bird itself in {b['used']}.",
        "standin": "The bird drawn in code from simple shapes in ink and wash.",
        "status": "delivered",
        "ref": b["ref"],
        "prompt": STYLE + " " + BIRD + " " + b["look"] + " " + PORTRAIT + " " + REF.format(b["ref"]),
    })

for n, b in enumerate(BIRDS, 1):
    REQUESTS.append({
        "id": f"IC-S{n:02d}",
        "section": "scene",
        "name": b["name"].replace("The ", "") + " scene",
        "key": f"scene.{b['id']}",
        "file": f"assets/scenes/{b['id']}.webp",
        "size": "1920 x 1080, opaque",
        "used": f"Behind {b['used']}.",
        "standin": "A simple painted-in-code version of the same place.",
        "status": "delivered",
        "ref": b["ref"],
        "prompt": STYLE + " " + SCENE + b["scene"] + " " + REF_SCENE.format(b["ref"]),
    })


def asset(path: str) -> str:
    return REF_URL.replace("reference/", "game/" + path)


# Scoop Stack's camera pulls back as the stack grows (to half size), so it
# needs the seaside painted far wider and taller than one screen: the
# delivered scene is the bottom-centre of this one. At full zoom-out the view
# is all of it; at zoom 1 it is exactly the old scene, the region 25%-75%
# across and 46.7%-96.7% down (see WIDE in game/src/games/coot.js).
REQUESTS.append({
    "id": "IC-S11",
    "section": "scene",
    "name": "Ice-Cream Cone Coot scene, wide",
    "key": "scene.cootWide",
    "file": "assets/scenes/coot-wide.webp",
    "size": "3840 x 2160, opaque",
    "used": "Scoop Stack, once the stack grows tall: the camera pulls back over it, so the "
    "seaside shrinks with the Coot instead of the Coot shrinking on a fixed backdrop.",
    "standin": "The delivered scene stays fixed and only the Coot and its scoops shrink.",
    "status": "delivered",
    "ref": "cover-ice-cream-cone-coot.jpg",
    "prompt": STYLE + " " + SCENE + "The same sunny seaside promenade as the existing scene ("
    + asset("assets/scenes/coot.webp") + "), seen from twice as far away: extend that picture "
    "outwards on every side, keeping it unchanged, as if the camera had pulled straight back. "
    "The existing picture must sit, at exactly half the width and half the height of this one, "
    "in the region from 25% to 75% across and from 46.7% to 96.7% down, with the boardwalk, the "
    "railing, the sea's horizon and the ice-cream cart all continuing seamlessly out of it at the "
    "same height. Below it, a little more of the near boardwalk planks fills the bottom 3.3%. To "
    "the left and right, the promenade goes on: more railing posts, the boardwalk, the sea and the "
    "far headland with its lighthouse on the left, and a bench or a lamp post on the right. Above "
    "it, a tall, open, pale summer sky with a few soft clouds, seagulls far off and nothing else, "
    "because ice-cream scoops fall through all of it. Keep the horizon a straight level line. "
    "Wide 16:9.",
})


# The book's birds the field guide doesn't have, for Shuttercluck to photograph.
# (id, name, where the reference shows it, description). `where` None: only
# named in the book's text, so drawn from the name.
ENDPAPERS = "endpapers-all-birds.jpg"
SUBJECTS = [
    ("milkmidge", "The Milkbottle Midge", "the white bottle bird near the middle of the left-hand page",
     "A small glass milk bottle full of white milk with a foil cap for a crest, tiny wings, one "
     "eye and a short beak, standing on two little legs."),
    ("waterglassgoose", "The Waterglass Goose", "the white tumbler bird on the page facing the Newspaper Peeper",
     "A plain white drinking glass (a tumbler) tipped on its side as the body, a long pale goose "
     "neck and small head rising from it, dark tail feathers, on long thin legs."),
    ("niffy", "The Jackknife Niffy", "top left of the left-hand page, flying",
     "A red folding pocketknife with its blades half open like wings and a sharp blade for a beak, "
     "a small round eye on the handle's end. A little menacing, as in the book."),
    ("snippit", "The Cutitup Snippit", "the pink scissors bird, upper left of the left-hand page",
     "A pair of pink-handled dressmaker's scissors: the long blades are the beak, the hinge screw "
     "its one eye, the finger loops its body, with fluttery pink tail feathers and thin legs."),
    ("buttonbeaks", "The Buttonbeaks", None,
     "Named in the book but not found in the photos, so drawn from its name: a pair of small "
     "round birds whose beaks and eyes are big sewing buttons with thread holes, plump bodies of "
     "button-sized feathers, on thin legs, standing side by side."),
    ("broomwhisk", "The Broomwhisk", "bottom left of the left-hand page, standing on its bristles",
     "A tall straw broom standing on its bundled bristles, which splay out like a skirt of tail "
     "feathers, with a slim bird's head and neck where the handle ends."),
    ("keycrane", "The Key Crane", "top right of the right-hand page",
     "A long old brass door key laid flat as the body, its ring bow as a round head with one eye, "
     "the bit's teeth as a little tail, with a dark crest like a top hat and long thin legs."),
    ("garbagecanary", "The Garbage Canary", "the dented dustbin bird, left of the left-hand page",
     "A dented grey galvanised dustbin with its lid tipped up like a cap, a yellow canary's head "
     "peering out from under the lid, scraps of paper for tail feathers, on thin legs."),
    ("steampressersparrow", "The Steampresser Sparrow", None,
     "Named in the book but not found in the photos, so drawn from its name: an old cast-iron "
     "steam iron as the body, puffs of steam from its sole like ruffled feathers, the handle "
     "arching over its back like folded wings, a sparrow's brown head and beak at the point."),
    ("wetweatherwren", "The Wetweather Wren", None,
     "Named in the book but not found in the photos (a review says its picture shows rain), so "
     "drawn from its name: a small round furled black umbrella with a crook handle for a tail, a "
     "tiny wren's head with one bright eye at the tip, rain falling on it, thin legs in a puddle."),
    ("glovedove", "The Glove Dove", "the long pink glove bird, middle of the right-hand page",
     "A long pink rubber washing-up glove, fingers splayed back as a crest of tail feathers, the "
     "cuff as a long neck ending in a head with one eye and a long beak, over a scalloped grey-blue "
     "feathered body, on two thin legs."),
    ("titthrush", "The Ten O'clock Tit Trush", "the yellow pocket watch bird, middle of the left-hand page",
     "A round gold pocket watch with its lid open, its face showing ten o'clock as a big round "
     "body, the winding crown as a little head and beak, a short chain for a tail, pink plumes."),
    ("plugsocketswift", "The Plugsocket Swift", "the light bulb bird, upper middle of the right-hand page",
     "A high-voltage bird: its head is an old clear light bulb with a glowing filament and one eye, "
     "on a brass screw cap neck, its body an old round wall plug socket, with swept-back swift's "
     "wings and a trailing flex for a tail."),
    ("saltshakershrike", "The Saltshaker Shrike", None,
     "Named in the book but not found in the photos, so drawn from its name: a glass salt shaker "
     "with a domed perforated silver cap as the head, a shrike's hooked beak and black eye mask, "
     "a few grains of salt falling, on thin legs."),
    ("ladlelark", "The Soupladle Lark", "the grey ladle bird, middle left of the left-hand page",
     "A grey enamel soup ladle: the round bowl is the body, the long hooked handle a curving neck "
     "with a small head and beak at its end, on two thin legs."),
    ("drippet", "The Drippet", "most likely the blue tap bird, bottom left of the left-hand page",
     "A blue-painted brass water tap: the spout is the beak with a drip at its tip, the cross "
     "handle on top a crest, one round eye on the body, leaving a little puddle wherever it runs."),
    ("sawbird", "The Saw Bird (name not found)", "the handsaw across the middle of the right-hand page",
     "A long carpenter's handsaw: the toothed blade is a long serrated beak, the wooden handle "
     "the head and body with one eye, with a few feathers and thin legs."),
    ("radiobird", "The Radio Bird (name not found)", "the portable radio bird, bottom of the right-hand page",
     "A small 1960s portable transistor radio with a carrying handle and a speaker grille as the "
     "body, a long curving striped neck with a crested head, and long thin legs."),
]
# Which subjects have been delivered (filled in on integration).
DELIVERED_SUBJECTS: set[str] = {
    'milkmidge',
    'waterglassgoose',
    'niffy',
    'snippit',
    'buttonbeaks',
    'broomwhisk',
    'keycrane',
    'garbagecanary',
    'steampressersparrow',
    'wetweatherwren',
    'glovedove',
    'titthrush',
    'plugsocketswift',
    'saltshakershrike',
    'ladlelark',
    'drippet',
    'sawbird',
    'radiobird',
}

for n, (sid, name, where, look) in enumerate(SUBJECTS, 1):
    ref = "newspaper-peeper.jpg" if sid == "waterglassgoose" else ENDPAPERS
    refnote = (
        f"Match this bird as the book shows it in the reference photo {REF_URL}{ref} ({where}), "
        "keeping its shapes and colours, but as a clean new full-colour painting of the bird alone "
        "(no book, page, hands or other birds)."
        if where else
        f"For the drawing style and palette, look at the book's birds in {REF_URL}{ENDPAPERS} ."
    )
    REQUESTS.append({
        "id": f"IC-R{n:02d}",
        "section": "subject",
        "name": name,
        "key": f"subject.{sid}",
        "file": f"assets/subjects/{sid}.png",
        "size": "1024 x 1024, transparent",
        "used": "Say Cheese (the Shuttercluck): it peeks out of a hiding place to be photographed.",
        "standin": "The object drawn in code in ink and wash, with an eye, a beak and legs.",
        "status": "delivered" if sid in DELIVERED_SUBJECTS else "requested",
        "ref": ref,
        "prompt": STYLE + " " + BIRD + " " + look + " " + PORTRAIT + " " + refnote,
    })

# Delivered paintings that need painting again: the fix replaces the same file
# once it arrives (the delivered one stays in the game until then).
REDOS = [
    ("ladlelark", "The Soupladle Lark, painted again",
     "The delivered painting (" + REF_URL.replace("reference/", "game/") + "assets/subjects/ladlelark.png"
     ") has the ladle's hook drawn as a separate piece floating above the bird's back. Paint the "
     "same bird again, matching it in every other way (the speckled grey enamel bowl as the body, "
     "the long handle as the neck rising to the head with its yellow beak and staring eye, the "
     "grey-blue wings and tail, the ochre legs), but with the ladle in ONE piece: the hook at the "
     "end of the handle curls back from the top of the head as a crest, part of the same handle. "
     "Nothing floats apart from the bird."),
]
DELIVERED_REDOS = {"ladlelark"}
for sid, name, fix in REDOS:
    REQUESTS.append({
        "id": "IC-R" + str([s[0] for s in SUBJECTS].index(sid) + 1).zfill(2) + "b",
        "section": "subject",
        "name": name,
        "key": f"redo.{sid}",
        "file": f"assets/subjects/{sid}.png",
        "size": "1024 x 1024, transparent",
        "used": "Replaces the delivered painting of the same name in the same file.",
        "standin": "The delivered painting, as it is.",
        "status": "delivered" if sid in DELIVERED_REDOS else "requested",
        "prompt": STYLE + " " + BIRD + " " + fix + " " + PORTRAIT,
    })

# Ten new birds in Lobel's manner, kept for later (not loaded by the game).
POCKET = [
    ("hourglassheron", "The Hourglass Heron",
     "A tall wooden-framed hourglass as the body, pale sand trickling from the top bulb to the "
     "bottom, a long heron's neck and dagger beak rising from the top of the frame, on very long legs.",
     "Turn it over at the right moment to keep the sand running."),
    ("spectaclesnipe", "The Spectacle Snipe",
     "A pair of round wire-rimmed spectacles: the two lenses are its two big round eyes, the "
     "bridge between them its long thin snipe's beak, the folded arms its tail, on wiry legs.",
     "Spot the differences through its lenses."),
    ("bellowsbittern", "The Bellows Bittern",
     "A pair of leather-and-wood fireside bellows as the body, the brass nozzle its beak, the "
     "pleated leather puffing in and out as it breathes, two handles as stubby wings.",
     "Puff a feather or the embers along at the right strength."),
    ("lampshadeloon", "The Lampshade Loon",
     "A fringed, pleated parchment lampshade as a bell-shaped body glowing softly from inside, "
     "the fringe as tail feathers, a loon's dark sleek head and neck on top, on thin legs.",
     "Light up the moths that come to it, not the bats."),
    ("concertinacurlew", "The Concertina Curlew",
     "A small hexagonal concertina squeezebox with patterned ends and pleated bellows as the "
     "body, a curlew's long down-curved beak from one end, buttons like a row of tiny feathers.",
     "Squeeze and stretch in time to play its tune."),
    ("weathervanewarbler", "The Weathervane Warbler",
     "A green-copper rooftop weathervane: the arrow is the body and beak, the swallow-tailed vane "
     "its tail, the N-E-S-W cross below like perched feet on a little roof ridge.",
     "Turn into the wind as it changes."),
    ("mousetrapmagpie", "The Mousetrap Magpie",
     "The mousetrap itself is the whole torso: a flat honey-brown wooden plank with a coiled "
     "spring and snapping metal bar built into it. A yellow cheese wedge forms its head and "
     "left-pointing beak, with round cheese holes and one round staring eye set in its side. "
     "The spring bar rises as its crest. Two thin bird legs grow from the wood below, small "
     "black-and-white wing tufts from its sides, and a long blue-black magpie tail from the "
     "rear. No feathered torso or conventional magpie head beneath the trap, and no separate "
     "cheese accessory sitting on top.",
     "Grab the shiny things without setting itself off."),
    ("hatboxhoopoe", "The Hatbox Hoopoe",
     "A round striped hatbox with its lid lifting like a crest of hoopoe feathers, a long thin "
     "curved beak, a ribbon bow, on thin legs.",
     "Catch the hats that blow off people's heads."),
    ("candlestickkiwi", "The Candlestick Kiwi",
     "A brass candlestick with a dripping white candle whose small flame is its crest, a round "
     "kiwi body in the saucer at the bottom, a long thin kiwi beak, short sturdy legs.",
     "Shelter its flame from the draughts."),
    ("rollingpinrail", "The Rollingpin Rail",
     "A floury wooden rolling pin laid flat as the body, the handles as a stubby tail and a neck "
     "with a small rail's head and beak, on quick little legs.",
     "Roll out the pastry evenly before it tears."),
]
DELIVERED_POCKET: set[str] = {
    'hourglassheron',
    'spectaclesnipe',
    'bellowsbittern',
    'lampshadeloon',
    'concertinacurlew',
    'weathervanewarbler',
    'mousetrapmagpie',
    'hatboxhoopoe',
    'candlestickkiwi',
    'rollingpinrail',
}

for n, (pid, name, look, game) in enumerate(POCKET, 1):
    REQUESTS.append({
        "id": f"IC-N{n:02d}",
        "section": "pocket",
        "name": name,
        "key": f"pocket.{pid}",
        "file": f"assets/pocket/{pid}.png",
        "size": "1024 x 1024, transparent",
        "used": "Say Cheese (the Shuttercluck), as one of the undiscovered birds it photographs; "
        "later, a page of its own. A game idea: " + game,
        "standin": "The object drawn in code in ink and wash, with an eye, a beak and legs.",
        "status": "delivered" if pid in DELIVERED_POCKET else "requested",
        "prompt": STYLE + " " + BIRD + " " + look + " " + PORTRAIT + " For the drawing style and "
        "the way the object becomes a bird, look at the book's birds in " + REF_URL + ENDPAPERS + " .",
    })

# The new minigames' requests, one JSON file per bird in more/: a list of
# {id, name, key, file, size, used, standin, prompt, status?, ref?}. A prompt
# may use {STYLE}, {BIRD}, {SHEET}, {VARIANT}, {SCENE}, {ALPHA} and {REF_URL}
# for the shared texts above.
MORE_DIR = Path(__file__).resolve().parent / "more"
SHARED = {"STYLE": STYLE, "BIRD": BIRD, "SHEET": SHEET, "VARIANT": VARIANT, "SCENE": SCENE,
          "ALPHA": ALPHA, "REF_URL": REF_URL}
MORE = sorted(
    (r for f in MORE_DIR.glob("*.json") if not f.name.startswith("._") for r in json.loads(f.read_text())),
    key=lambda r: r["id"],
)
for r in MORE:
    prompt = r["prompt"]
    for k, v in SHARED.items():
        prompt = prompt.replace("{" + k + "}", v)
    REQUESTS.append({**r, "section": "more", "prompt": prompt, "status": r.get("status", "requested")})

SPRITES = [
    ("IC-P01", "Scoop Stack props", "sprites.scoops", "assets/sprites/scoops.png", "2048 x 1024, transparent",
     "Scoop Stack: the falling ice creams and the things that knock them off.",
     "Scoops, a cherry, a pickle and a sock drawn in code.",
     STYLE + " " + SHEET + " A 5 x 2 grid of ten objects, each about 300 px across: seven single round "
     "lumpy scoops of ice cream with no cone (strawberry pink, lemon yellow, vanilla cream, chocolate "
     "brown, mint green, pistachio, blueberry), seen from the side, soft and slightly melting at the "
     "bottom edge; one glossy red cherry with a stem and a tiny gold sparkle; one green dill pickle; "
     "one striped wool sock. Lumpy, crosshatched shadows, like the scoops on the Coot's cover."),
    ("IC-P02", "Coot walking and looking up", "sprites.cootPoses", "assets/sprites/coot-poses.png", "2048 x 1024, transparent",
     "Scoop Stack: the Coot runs left and right, and looks up at the falling scoops.",
     "The portrait, hopping.",
     STYLE + " " + VARIANT + " The Ice-Cream Cone Coot (" + asset("assets/birds/coot.png") + ") in "
     "two poses side by side on one sheet, each in its own half: left, mid-stride with its left leg "
     "reaching forward; right, standing with its head tipped back looking straight up, beak pointing "
     "to the sky, so a scoop can land on its head. " + ALPHA),
    ("IC-P03", "Cupadee, empty cup facing up", "sprites.cupadeeOpen", "assets/sprites/cupadee-open.png", "1024 x 1024, transparent",
     "Tea Time: the game paints the tea inside the cup and a fill line on it.",
     "The game's own cup drawn over the portrait.",
     STYLE + " " + VARIANT + " The Cupadee (" + asset("assets/birds/cupadee.png") + ") standing with "
     "its cup upright and level, not tipped, the rim seen slightly from above as a wide open ellipse "
     "so the whole empty white inside of the cup is visible, ready to be filled. " + ALPHA),
    ("IC-P04", "Teapot", "sprites.teapot", "assets/sprites/teapot.png", "1024 x 1024, transparent",
     "Tea Time: the teapot that tips and pours.",
     "A teapot drawn in code.",
     STYLE + " An old-fashioned round china teapot with a long curved spout pointing to the left, a "
     "rose pattern and a domed lid with a knob, level (not pouring), hanging from a short loop of "
     "string on its handle. Centred, filling about 70% of the frame. " + ALPHA),
    ("IC-P05", "Say Cheese hiding places", "sprites.hides", "assets/sprites/hides.png", "2048 x 1024, transparent",
     "Say Cheese: the foreground pieces the rare birds peek out from behind. Each is drawn over "
     "the meadow scene, with the bird between the scene and it.",
     "Bushes, a wall, a tree, a gate pillar, a hedge and grass drawn in code.",
     STYLE + " " + SHEET + " A 3 x 2 grid of six foreground pieces matching the meadow scene ("
     + asset("assets/scenes/shuttercluck.webp") + "), each cut out cleanly at its base: a round "
     "leafy bush; a low mossy dry-stone wall section; an old tree trunk with a dark knothole halfway "
     "up (only the trunk, cut off above the knothole); a square stone gate pillar with a ball on "
     "top; a clipped hedge section; a clump of tall meadow grass and wildflowers."),
    ("IC-P06", "Gullfinch singing", "sprites.gullfinchSing", "assets/sprites/gullfinch-sing.png", "1024 x 1024, transparent",
     "Wind and Sing: the Gullfinch's pose for each note the player hits.",
     "The portrait, breathing.",
     STYLE + " " + VARIANT + " The Gramophone Gullfinch (" + asset("assets/birds/gullfinch.png")
     + ") in full song: beak wide open, head thrown back a little, crest feathers flared, a few small "
     "ink musical notes drifting out of the horn. " + ALPHA),
    ("IC-P07", "Plume growing, four stages", "sprites.plumeGrowth", "assets/sprites/plume-growth.png", "2048 x 1024, transparent",
     "Bloom: the plant in each Flowerpot Plume's pot as it is watered, from sprout to the book's "
     "towering bloom, and wilted.",
     "An ink stem, leaves and flower drawn in code over the portrait.",
     STYLE + " " + SHEET + " A 4 x 1 row of four plants only (no pot, no bird), each growing up from "
     "a small mound of soil at the bottom centre of its cell, all at the same scale: 1) a short stem "
     "with four leaves; 2) a taller stem with leaves and a closed pink bud; 3) the full bloom from "
     "the book (" + REF_URL + "flowerpot-plume.jpg ): a tall leafy stem topped by a huge rounded "
     "flower head of many petals in rose, slate blue, ochre and mauve; 4) the same tall plant "
     "wilted, the stem bent over and the flower drooping, leaves curled and brownish."),
    ("IC-P08", "Bobolinks, one boot at a time", "sprites.bobolinkBoots", "assets/sprites/bobolink-boots.png", "2048 x 1024, transparent",
     "Left Foot, Right Foot: each boot steps on its own.",
     "The pair's portrait hopping as one.",
     STYLE + " " + VARIANT + " The Highbutton Bobolinks (" + asset("assets/birds/bobolinks.png")
     + ") as two separate single boots on one sheet, each in its own half: left half, the left boot "
     "alone, standing; right half, the right boot alone, standing. Same boot design as the pair, "
     "each a bird with its eye and its long white beak open upward. " + ALPHA),
    ("IC-P09", "Stepping stones", "sprites.stones", "assets/sprites/stones.png", "2048 x 1024, transparent",
     "Left Foot, Right Foot: the stones across the moonlit stream.",
     "Flat discs drawn in code.",
     STYLE + " " + SHEET + " A 3 x 2 grid of six flat, rounded river stepping stones seen from a "
     "low side angle, wet on top and catching pale moonlight, with a thin ring of dark water "
     "ripple around each base, for a night scene (" + asset("assets/scenes/bobolinks.webp") + ")."),
    ("IC-P10", "Newsprint scraps", "sprites.scraps", "assets/sprites/scraps.png", "2048 x 1024, transparent",
     "Hot off the Press: the scraps the letters are printed on as they flutter down.",
     "Paper rectangles drawn in code.",
     STYLE + " " + SHEET + " A 4 x 2 grid of eight small torn scraps of old newspaper, each roughly "
     "square with ragged torn edges, slightly curled, with faint grey columns of tiny print and a "
     "blank cream patch in the middle (the game prints a big letter there)."),
    ("IC-P11", "Hats", "sprites.hats", "assets/sprites/hats.png", "2048 x 1024, transparent",
     "Spot the Dodo: the hats on the shop counter that the Dodo hides under.",
     "Hats drawn in code.",
     STYLE + " " + SHEET + " A 3 x 1 row of three gentleman's hats seen from the side, sitting on "
     "their brims: a black bowler with a plum band, a tall black top hat with a grey band, and a "
     "brown bowler with a faded green band. Each about the same width."),
    ("IC-P12", "Old cars", "sprites.cars", "assets/sprites/cars.png", "2048 x 1024, transparent",
     "Safe Crossing: the cars that stop and go at the Crow's light.",
     "Simple cars drawn in code.",
     STYLE + " " + SHEET + " A 2 x 2 grid of four small rounded 1930s motor cars in side view, all "
     "facing left (the game mirrors them for the other lane): dusty pink, pale blue, mustard yellow "
     "and sage green, with running boards, round headlamps and spoked wheels, for a small-town "
     "street (" + asset("assets/scenes/crow.webp") + ")."),
    ("IC-P13", "Little crossing birds", "sprites.chicks", "assets/sprites/chicks.png", "2048 x 1024, transparent",
     "Safe Crossing: the little birds that wait on the pavement and cross on red.",
     "Small ink birds drawn in code.",
     STYLE + " " + SHEET + " A 3 x 2 grid of six small round sparrow-like birds facing left, in soft "
     "browns, buffs and dusty pinks with round staring eyes and thin legs, in the book's odd, "
     "gentle way: three standing waiting, two mid-step walking, one flapping off in a fright."),
    ("IC-U06", "Medals", "medals", "assets/ui/medals.png", "2048 x 1024, transparent",
     "Nothing any more: the game dropped medals for a best score and New World Records. "
     "Kept, delivered, in case it is wanted again; the game does not load it.",
     "None.",
     STYLE + " " + SHEET + " A 3 x 1 row of three round prize rosettes with short ribbon tails, "
     "hand-drawn in ink and watercolour: bronze (warm brown-orange), silver (cool grey) and gold "
     "(warm yellow ochre), each with a tiny ice-cream cone embossed in the centre. No text."),
]
# Delivered IDs are explicit so future sprite requests retain their stand-ins.
DELIVERED_SPRITES = {
    "IC-P01", "IC-P02", "IC-P03", "IC-P04", "IC-P05", "IC-P06", "IC-P07",
    "IC-P08", "IC-P09", "IC-P10", "IC-P11", "IC-P12", "IC-P13", "IC-U06",
}
# Delivered but no longer used: the file stays, the game does not load it.
RETIRED = {"IC-U06"}
for sid, name, key, file, size, used, standin, prompt in SPRITES:
    REQUESTS.append({
        "id": sid, "section": "sprite" if sid.startswith("IC-P") else "ui", "name": name, "key": key,
        "file": file, "size": size, "used": used, "standin": standin,
        "status": "retired" if sid in RETIRED else "delivered" if sid in DELIVERED_SPRITES else "requested",
        "prompt": prompt,
    })


# Sticker book backgrounds: a whole-place picture per bird, shaped for the
# open book's two pages, unlocked when the bird is passed.
BOOK_PLATE = (
    "A full-colour picture for the two facing pages of an open children's sticker album, wide 2:1, "
    "full bleed. The left half and the right half must each work as a complete picture on its own, "
    "because on a phone held upright the two halves are shown one above the other; a vertical strip "
    "about 6% wide down the exact middle is the book's fold and holds nothing important. It is a "
    "lovely, calm, lived-in place for arranging bird stickers on, so it is empty of birds, people and "
    "animals, with plenty of open, softly painted space spread across both halves (sky, grass, floor, "
    "water, wall) where stickers can sit and still stand out: keep the detail light and mid-toned "
    "there and let it gather richer around the edges and corners. A whole place rather than a game "
    "background: a wide view with depth, a clear time of day and small charming details to find. "
)
BOOK = [
    ("coot", "The Ice-Cream Cone Coot", "A seaside town on a summer afternoon: a curving sandy beach and a promenade with railings, a row of faded striped bathing huts, a striped ice-cream cart with its awning, a little pier with a lighthouse far off, a wide pale sky with soft clouds over a calm sea."),
    ("cupadee", "The Cupadee", "A cottage garden at teatime: a tea table laid on the lawn under an old apple tree, with a lace cloth, a teapot, a cake stand and cups, bunting strung between the branches, the cottage's open kitchen door and windows behind, late golden light."),
    ("shuttercluck", "The Shuttercluck", "Rolling countryside for spotting birds: a hedgerow with a wooden stile, a winding footpath, a pond with reeds, a windmill on a far hill, wildflowers in the long grass, a big sky with high clouds."),
    ("gullfinch", "The Gramophone Gullfinch", "A park bandstand on a summer evening: an ornate painted bandstand with paper lanterns lit, deckchairs on the lawn around it, old trees, a path with lamp posts, a soft violet dusk sky."),
    ("plume", "The Flowerpot Plume", "A walled flower garden in full bloom: an old glasshouse, a potting shed with stacked terracotta pots, beds of roses, foxgloves and hollyhocks, a brick wall with climbing roses, a watering can by a gravel path, bright morning."),
    ("bobolinks", "The Highbutton Bobolinks", "A riverbank at night under a big full moon: willows leaning over the water, a little wooden jetty with a lantern, the moon's path on the river, a sleepy town with a few lit windows on the far bank, a deep blue starry sky."),
    ("peeper", "The Newspaper Peeper", "A cobbled town square on an early morning: a newspaper kiosk with bundles of papers, an old printing house with tall windows, a clock tower, café tables not yet set out, pale morning sky."),
    ("piffle", "The Pincushion Piffle", "A haberdashery shop interior: shelves of bolts of cloth, drawers of buttons, spools of thread in every colour, ribbons on reels, a dressmaker's dummy, a long counter with scissors and a tape measure, warm lamplight."),
    ("dodo", "The Dollarbill Dodo", "A busy old market street: a general store with awnings, a little bank with columns, a greengrocer's with crates, a post box, shop signs without words, cobbles, a sunny day."),
    ("crow", "The Safecrossing Crow", "A little town crossroads after school: a zebra crossing, a lollipop crossing sign, a small schoolhouse with a bell, a corner sweet shop, trees and a low wall around a playground, afternoon light."),
    ("milkmidge", "The Milkbottle Midge", "A dairy farm lane at dawn: pastures with a wooden gate, a red barn, a milk stand with churns by the lane, a village with chimney smoke beyond, a pink and gold sunrise sky."),
    ("waterglassgoose", "The Waterglass Goose", "A glass conservatory at evening: tall arched glass panes, potted palms and ferns, a long table set with crystal glasses and candles, the garden in blue dusk outside."),
    ("niffy", "The Jackknife Niffy", "A formal topiary garden: clipped hedges shaped into balls, spirals and peacocks, a gravel walk, a stone fountain, a wheelbarrow with garden shears, a sunny summer day."),
    ("broomwhisk", "The Broomwhisk", "A sunny old courtyard: whitewashed walls with blue shutters, a stone well, steps up to a door with pots of geraniums, a broom leaning by the door, swept flagstones, a fig tree, warm midday light."),
    ("buttonbeaks", "The Buttonbeaks", "A tailor's shop window and street: a bow window full of coats, waistcoats and a dummy, a big button-shaped shop sign without words, a bench outside, a washing line in a back garden over the wall, breezy day."),
    ("keycrane", "The Key Crane", "An old seaside amusement arcade at evening: rows of wooden prize-crane cabinets with glowing glass fronts, a carousel through the open doors, strings of lights, a patterned carpet, the sea and sunset beyond."),
    ("snippit", "The Cutitup Snippit", "A country fair: striped tents, bunting, a coconut shy, a big wheel on the hill, a hoopla stall with prizes on strings, a fence of wooden posts, a bright breezy afternoon."),
    ("garbagecanary", "The Garbage Canary", "A town back lane on bin day: a row of back gates and yards, chimney pots, a rag-and-bone cart, dustbins with lids, washing lines, leaves blowing, a fresh grey-blue morning."),
    ("steampressersparrow", "The Steampresser Sparrow", "An old laundry yard: sheets and shirts drying on long lines, a wash house with a steaming copper, a mangle, wicker baskets, sunlight through the linen."),
    ("wetweatherwren", "The Wetweather Wren", "A rainy market street: shop awnings dripping, puddles reflecting lit shop windows, an umbrella stand by a door, cobbles shining, soft grey rain over tall narrow houses."),
    ("glovedove", "The Glove Dove", "A big old farmhouse scullery: a deep sink by a window, a wooden plate rack full of dishes, copper pans hanging, a dresser with jugs, a tiled floor, morning sun."),
    ("titthrush", "The Ten O’clock Tit Trush", "A clockmaker's shop: walls covered in clocks of every shape, a grandfather clock, a workbench with tiny tools and a magnifying lamp, pocket watches on a velvet tray, a bay window to the street."),
    ("plugsocketswift", "The Plugsocket Swift", "A town street at night: tall houses with warmly lit windows, lamp posts glowing, wires strung between the roofs, a crescent moon and stars, a cat-free quiet pavement."),
    ("saltshakershrike", "The Saltshaker Shrike", "An old café bistro: little round tables with checked cloths and salt and pepper shakers, a long counter with a coffee urn, a chalkboard without words, big windows onto the street, lunchtime bustle without the people."),
    ("ladlelark", "The Soupladle Lark", "A farmhouse kitchen at suppertime: a big black range with a soup pot steaming, ladles and spoons hanging on hooks, a long wooden table with bowls set out, strings of onions, a window with evening light."),
    ("drippet", "The Drippet", "A rainy-day garden: an old iron water pump, a water butt, watering cans of all sizes, a greenhouse with rain on its panes, a vegetable patch, puddles on the path, soft grey sky."),
    ("sawbird", "The Saw Bird", "A carpenter's workshop: a long workbench with planes and chisels, saws hanging on the wall, stacks of planks, curls of wood shavings on the floor, a half-built rocking chair, sunlight through a dusty window."),
    ("radiobird", "The Radio Bird", "A moonlit town rooftop: chimney pots, slate roofs and old radio aerials against a starry sky, a lit attic window, a church spire in the distance, a big round moon."),
]
DELIVERED_BOOK = set(['bobolinks', 'broomwhisk', 'buttonbeaks', 'coot', 'crow', 'cupadee', 'dodo', 'drippet', 'garbagecanary', 'glovedove', 'gullfinch', 'keycrane', 'ladlelark', 'milkmidge', 'niffy', 'peeper', 'piffle', 'plugsocketswift', 'plume', 'radiobird', 'saltshakershrike', 'sawbird', 'shuttercluck', 'snippit', 'steampressersparrow', 'titthrush', 'waterglassgoose', 'wetweatherwren'])
for n, (bid, name, scene) in enumerate(BOOK, 1):
    REQUESTS.append({
        "id": f"IC-SB{n:02d}", "section": "book", "name": f"Sticker book: {name}", "key": f"book.{bid}",
        "file": f"assets/book/{bid}.webp", "size": "2048 x 1024, opaque",
        "used": f"A background for the sticker book's pages, unlocked by passing {name}.",
        "standin": f"{name}'s game scene.",
        "status": "delivered" if bid in DELIVERED_BOOK else "requested",
        "prompt": STYLE + " " + BOOK_PLATE + scene,
    })

# The first sticker-book pictures came back as soft, realistic watercolours
# with no pen line; each is redrawn in the book's own look into the same file.
BOOK_REDO = (
    "The delivered picture ({0}) has the right place and composition but the wrong look: it is a "
    "soft, realistic, glossy watercolour with no ink line, saturated colour, glowing light and "
    "photographic depth, so it does not match the rest of this game. Draw the same place again in "
    "the game's own look, matching its scene for the same bird ({1}): every shape outlined in fine "
    "brown-black pen line, shade done with crosshatching and stippling, flat transparent washes in "
    "the faded palette with plenty of cream paper showing through, simple flattened perspective "
    "and fewer, larger shapes: an illustration printed in a 1971 picture book, not a painting. "
)
DELIVERED_BOOK_REDOS: set[str] = set(['bobolinks', 'broomwhisk', 'buttonbeaks', 'coot', 'crow', 'cupadee', 'dodo', 'drippet', 'garbagecanary', 'glovedove', 'gullfinch', 'keycrane', 'ladlelark', 'milkmidge', 'niffy', 'peeper', 'piffle', 'plugsocketswift', 'plume', 'radiobird', 'saltshakershrike', 'sawbird', 'shuttercluck', 'snippit', 'steampressersparrow', 'titthrush', 'waterglassgoose', 'wetweatherwren'])
GAME_URL = REF_URL.replace("reference/", "game/")
for n, (bid, name, scene) in enumerate(BOOK, 1):
    REQUESTS.append({
        "id": f"IC-SB{n:02d}b", "section": "book", "name": f"Sticker book: {name}, redrawn in ink",
        "key": f"bookredo.{bid}", "file": f"assets/book/{bid}.webp", "size": "2048 x 1024, opaque",
        "used": "Replaces the delivered sticker-book picture of the same bird in the same file.",
        "standin": "The delivered picture, as it is.",
        "status": "delivered" if bid in DELIVERED_BOOK_REDOS else "requested",
        "prompt": STYLE + " " + BOOK_REDO.format(GAME_URL + f"assets/book/{bid}.webp", GAME_URL + f"assets/scenes/{bid}.webp")
        + BOOK_PLATE + scene,
    })


# The gathering painted again with all 28 birds once the field guide grew.
MORE_OBJECTS = [
    ("milkmidge", "Milkbottle Midge", "a milk bottle"), ("waterglassgoose", "Waterglass Goose", "a drinking glass"),
    ("niffy", "Jackknife Niffy", "a pocketknife"), ("broomwhisk", "Broomwhisk", "a straw broom"),
    ("buttonbeaks", "Buttonbeaks", "a pair of buttons"), ("keycrane", "Key Crane", "an old brass key"),
    ("snippit", "Cutitup Snippit", "a pair of scissors"), ("garbagecanary", "Garbage Canary", "a dustbin"),
    ("steampressersparrow", "Steampresser Sparrow", "an old steam iron"), ("wetweatherwren", "Wetweather Wren", "an umbrella"),
    ("glovedove", "Glove Dove", "a rubber glove"), ("titthrush", "Ten O’clock Tit Trush", "a pocket watch"),
    ("plugsocketswift", "Plugsocket Swift", "a plug socket with a light-bulb head"), ("saltshakershrike", "Saltshaker Shrike", "a salt shaker"),
    ("ladlelark", "Soupladle Lark", "a soup ladle"), ("drippet", "Drippet", "a water tap"),
    ("sawbird", "Saw Bird", "a handsaw"), ("radiobird", "Radio Bird", "a transistor radio"),
]
GATHER_REFS = ", ".join(
    [f"{b['name']}: {GAME_URL}assets/birds/{b['id']}.png" for b in BIRDS]
    + [f"The {n}: {GAME_URL}assets/subjects/{i}.png" for i, n, _ in MORE_OBJECTS]
)
ALL_28 = ALL_BIRDS + "; " + "; ".join(f"{n} ({o})" for _, n, o in MORE_OBJECTS)
REQUESTS.append({
    "id": "IC-U05b", "section": "ui", "name": "All 28 birds together", "key": "redo.gathering",
    "file": "assets/ui/gathering.webp", "size": "1920 x 1080, opaque",
    "used": "Replaces the gathering of the first ten birds: the last page of the field guide, shown once "
    "all 28 birds have been spotted.",
    "standin": "The delivered gathering of the first ten birds.",
    "ref": "endpapers-all-birds.jpg",
    "status": "delivered",
    "prompt": STYLE + " " + BIRD + " A crowded, happy gathering of all 28 rare birds of the field guide "
    "in one continuous woodland-edge farmyard: apple trees and hollow trunks, a red barn, a rustic fence, "
    "flowers and vegetable beds, stumps and a small pond under a pale lemon-yellow sky, lively like the "
    "book's endpapers (" + REF_URL + "endpapers-all-birds.jpg ). Every one of the 28 is "
    "there exactly once and clearly recognisable: " + ALL_28 + ". Paint each one as it is painted in its "
    "portrait (" + GATHER_REFS + "), same shapes and colours, naturally varied sizes and depths. Scatter "
    "them asymmetrically through the habitat, perched on branches or fences, near the pond, among flowers, "
    "and peeking from foliage, a tree hollow or the barn. Some may be partly hidden by scenery, but every "
    "distinctive object-bird remains recognisable. No grid, list, aligned rows or repeated strips. "
    "Their eyes look about in all directions; some sing. Full-bleed 16:9, no text.",
})

# The same gathering laid out for the sticker book's two pages, to try as the
# book's default page with a greyed spot per bird that its sticker snaps into.
REQUESTS.append({
    "id": "IC-U08", "section": "book", "name": "Sticker book: all 28 birds together", "key": "book.gathering",
    "file": "assets/book/gathering.webp", "size": "2048 x 1024, opaque",
    "used": "The sticker book's first picture (on trial as its default), with "
    "assets/book/gathering.atlas.json: each bird's painted spot is greyed out until the player snaps "
    "that bird's sticker into it. Also the finale on upright screens, its halves stacked.",
    "standin": "The sticker book's plain page.",
    "ref": "endpapers-all-birds.jpg",
    "status": "delivered",
    "prompt": STYLE + " " + BIRD + " All 28 rare birds of the field guide gathered together, laid out for "
    "the two facing pages of an open sticker album, wide 2:1, full bleed. The left half and the right half "
    "are each a complete picture on its own (on a phone they are shown one above the other), with exactly 14 "
    "birds on each half, and a vertical strip about 6% wide down the exact middle (the book's fold) with no "
    "bird on it or touching it. One continuous woodland-edge farmyard with apple trees, hollow trunks, "
    "a red barn, a rustic fence, flowers and vegetable beds, stumps and a small pond beneath a pale "
    "lemon-yellow sky, lively like the "
    "book's endpapers (" + REF_URL + "endpapers-all-birds.jpg ). Every one of the 28 is there exactly once "
    "and clearly recognisable: " + ALL_28 + ". Paint each one as it is painted in its portrait ("
    + GATHER_REFS + "), same shapes and colours, scattered asymmetrically at varied depths and sizes, "
    "perched on branches or fences, among flowers, near the pond, or peeking from foliage, a hollow or "
    "the barn. Scenery may partly hide a bird, but every distinctive object-bird stays recognisable. "
    "No grid, list, aligned rows or repeated strips; no bird crosses the centre fold or an outer edge. "
    "Keep the spaces between them calm. No text.",
})

def asset_list() -> str:
    data = {
        r["key"]: {"file": r["file"], "delivered": r["status"] == "delivered"} for r in REQUESTS
    }
    return (
        "// Generated by icecreamcone/design/source/build_requests.py. Do not edit by hand:\n"
        "// change the data there and rerun it. A delivered asset is loaded in place of\n"
        "// its stand-in; a requested one is not loaded at all.\n"
        "export const ASSETS = " + json.dumps(data, indent=2) + ";\n"
    )


def entries(rs) -> list[str]:
    out = []
    for key, (title, blurb) in SECTIONS.items():
        section = [r for r in rs if r["section"] == key]
        if not section:
            continue
        out += [f"## {title}", "", blurb, ""]
        for r in section:
            out += [
                f"### {r['id']} · {r['name']}",
                "",
                f"- **File:** `icecreamcone/game/{r['file']}`",
                f"- **Size:** {r['size']}",
                f"- **Used for:** {r['used']}",
                f"- **Stand-in until delivered:** {r['standin']}",
                *( [f"- **Reference:** [`reference/{r['ref']}`](../reference/{r['ref']})"] if r.get("ref") else [] ),
                f"- **Status:** {r['status']}",
                "",
                "```text",
                r["prompt"],
                "```",
                "",
            ]
    return out


def status_line() -> str:
    delivered = sum(r["status"] == "delivered" for r in REQUESTS)
    retired = sum(r["status"] == "retired" for r in REQUESTS)
    return f"{len(REQUESTS) - delivered - retired} requested, {delivered} delivered, {retired} retired, {len(REQUESTS)} in total."


def document() -> str:
    open_ = [r for r in REQUESTS if r["status"] == "requested"]
    out = [
        "# The Ice-Cream Cone Coot: image requests",
        "",
        "Artwork still wanted for the Ice-Cream Cone Coot game in `icecreamcone/`. Only open "
        "requests are listed here; delivered and retired ones move to "
        "[`image-requests-history.md`](image-requests-history.md). Generated from "
        "`source/build_requests.py`; edit the data there and rerun it, which also rewrites the "
        "history and `icecreamcone/game/src/asset-list.js`.",
        "",
        "## How to use this list",
        "",
        "1. Each prompt is complete on its own: paste it as it stands. The shared style text is already in every prompt.",
        "2. Save each image under the file name in its **File** line and drop it in `icecreamcone/intake/`. On integration "
        "it moves to that path under `icecreamcone/game/`, its status flips to `delivered`, the game loads it in place "
        "of its stand-in and the request moves to the history.",
        "3. Images that need transparency say so in their prompts. If the generator cannot produce alpha, use a flat "
        "pure magenta `#FF00FF` background as the prompts say; it is keyed out on integration.",
        "4. Opaque images are listed as `.webp`; PNG or JPEG is fine too, they are converted on integration.",
        "5. Nothing here blocks the game: every image has a stand-in drawn in code until it arrives.",
        "6. Prompts that name a reference photo of the book in `icecreamcone/reference/`, or an earlier "
        "painting, link to it. Give that image to the image generator along with the prompt where "
        "it can take an image.",
        "",
        "## Status",
        "",
        status_line(),
        "",
    ]
    if not open_:
        out += ["Nothing is waiting: every request has been delivered.", ""]
    out += entries(open_)
    return "\n".join(out).rstrip() + "\n"


def history() -> str:
    done = [r for r in REQUESTS if r["status"] != "requested"]
    out = [
        "# The Ice-Cream Cone Coot: finished image requests",
        "",
        "Every image request that has been delivered (or delivered and later retired), with the "
        "prompt it was made from. The open requests are in "
        "[`image-requests.md`](image-requests.md). Generated from `source/build_requests.py`.",
        "",
        "## Status",
        "",
        status_line(),
        "",
    ]
    out += entries(done)
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    outputs = {DOC: document(), HISTORY: history(), ASSET_LIST: asset_list()}
    if "--check" in sys.argv:
        stale = [p for p, text in outputs.items() if not p.exists() or p.read_text() != text]
        for p in stale:
            print(f"out of date: {p.relative_to(ROOT.parent)} (rerun build_requests.py)")
        return 1 if stale else 0
    for p, text in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        print(f"wrote {p.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
