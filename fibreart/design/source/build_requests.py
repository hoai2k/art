#!/usr/bin/env python3
"""Generate the Fibre Art image requests and the game's asset list.

Edit the data in this file, then run:

    python3 fibreart/design/source/build_requests.py          # write
    python3 fibreart/design/source/build_requests.py --check  # verify up to date

Outputs:
    fibreart/design/image-requests.md   the request document
    fibreart/design/asset-list.json     what the game loads, with each piece's name

Statuses:
    requested  the game cuts a stand-in from the reference photos (or draws noise)
    delivered  the file is in fibreart/game/assets/ and the game loads it
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "design" / "image-requests.md"
ASSET_LIST = ROOT / "design" / "asset-list.json"

# Where the reference photos live on main (fibreart/reference/).
REF_URL = "https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/"

# The look every picture shares, from the style notes in reference/README.md.
STYLE = (
    "Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who "
    "makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built "
    "from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly "
    "irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, "
    "machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures "
    "and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid "
    "dark contour over washes of colour that spill past the line. Deep indigo, black and teal "
    "grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green "
    "light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, "
    "as in a fresh photograph of the real cloth, not faded. No text, no lettering, no "
    "signature, no watermark, no picture frame, no UI."
)

LOOK = "For the style, materials and palette, look at her work in these reference photos: {0} ."

ALPHA = (
    "Transparent background (PNG with alpha). If transparency is not possible, use a flat pure "
    "magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on "
    "integration."
)

COMPOSITION = (
    "A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as "
    "the key a game scene is built from: every motif named below will later be cut out and "
    "moved on its own, so give each one a clear, readable silhouette, keep the motifs apart "
    "from each other (touching at most at an edge, never overlapping much), and make each "
    "one a distinct piece of cloth or paint against the ground. "
)

GROUND = (
    "The same picture as the attached composition, request {0} (file {1}), at exactly the same "
    "framing and scale, but with these motifs taken out: {2}. Where each one was, continue "
    "the ground underneath as if it had never been there (the sky, the field, the patchwork, "
    "the stitching running on), with no gap, hole, outline or ghost of the removed shape. "
    "Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. "
)

PIECES = (
    "A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves "
    "each one on its own. Draw each motif below exactly as it appears in the attached "
    "composition, request {0} (file {1}): same design, colours, materials, stitching and "
    "scale relative to each other, in the same orientation it has there (do not turn it to fit "
    "the cell). Each piece is complete and whole, including any part that was hidden behind "
    "another motif, with its own frayed or painted edge all round and a little of its "
    "stitching or thread running loose past the edge. "
)

GRID = (
    "Lay them out in a grid of {0} columns and {1} rows, in the order listed, from left to right "
    "and top to bottom, one per cell and centred in it, with plenty of clear background around "
    "each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide "
    "lines, outlines around the cells or shadows. "
)

CHAIN = (
    "A morph chain: one motif changing step by step into others, for a game that blends each "
    "stage into the next. {0} stages in one row from left to right, all at the same size and "
    "centred on the same point in their cells, each about as wide and tall as the others so "
    "one can grow out of the last. Each stage is a finished cut-cloth motif with stitched "
    "edges, and each shares something with its neighbours (the curve of an edge, a colour, a "
    "line of stitches, the closed eyes) so the change feels grown rather than swapped. The "
    "stages, in order: {1}. Even spacing, plenty of clear background between them, nothing "
    "touching. No numbers, arrows or labels. "
)

TILE = (
    "A seamlessly tiling square texture of one fabric, photographed flat and straight on in "
    "even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must "
    "repeat in both directions with no visible seam. The fabric: {0}. Rich, saturated colour; "
    "the weave and thread visible up close. No motifs that read as a picture on their own. "
)

MASK = (
    "A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white "
    "is where an image disappears first and pure black where it disappears last, with every "
    "shade of grey between, so that as a threshold sweeps from white to black the image wears "
    "away in this way: {0}. Use the full range from pure white to pure black, with smooth "
    "gradients inside the shapes and fine, crisp detail along their edges. Nothing else in "
    "the image, no texture of paper or cloth, no text. "
)


def grid(n: int) -> tuple[int, int]:
    cols = 1
    while cols * cols < n:
        cols += 1
    return cols, -(-n // cols)


def numbered(items: list[str]) -> str:
    return " ".join(f"{i}. {s[0].upper() + s[1:]}." for i, s in enumerate(items, start=1))


def links(files: list[str]) -> str:
    return " , ".join(REF_URL + f for f in files)


# Each tableau is a scene after one or more of her works. "keep" stays in the
# ground; "pieces" are cut out and move. Every tableau has at least one piece
# that can anchor a large effect and one that can travel along a morph chain.
TABLEAUX = [
    {
        "n": 1,
        "key": "viriditas",
        "name": "Viriditas",
        "after": "her painting Viriditas",
        "refs": ["paintings/viriditas.jpg"],
        "scene": "A dense wood of slender trees under a dark sky, after her painting Viriditas "
        "(Hildegard of Bingen's word for the greening life force). Acid yellow and yellow-green "
        "light fills the spaces between thin, wavering teal and bottle-green trunks; clusters "
        "of small red-orange berries and buds hang from the branches; a large violet disc, a "
        "sun or moon, glows behind the trees; the sky at the top is deep purple and indigo "
        "with swirling darker strokes; olive and ochre undergrowth along the bottom, with a "
        "few orange marks like fallen leaves. Painted on silk with stitched lines along some "
        "of the trunks.",
        "keep": "the sky, the yellow-green light between the trees, the undergrowth",
        "pieces": [
            "the large violet sun disc",
            "the tallest teal tree, trunk and branches, from the ground to the top",
            "a second slender teal tree, leaning left",
            "a third slender tree, bottle green, forked near the top",
            "a short young tree with a few buds",
            "a cluster of red-orange berries, large",
            "a cluster of red-orange berries, medium",
            "a cluster of red-orange berries, small",
            "a single dark green bud on a curved stem",
            "a swirl of dark purple sky, cut out like a cloud",
            "a small bird of stitched teal silk among the branches",
            "a patch of orange fallen leaves",
        ],
    },
    {
        "n": 2,
        "key": "night-quilt",
        "name": "Moons and hearts",
        "after": "her fibercollage of moons and hearts",
        "refs": ["fibre/fibercollage-moons-and-hearts.jpg"],
        "scene": "A night quilt of patchwork blocks, after her fibercollage of moons and "
        "hearts: deep indigo and black blocks bordered by red and orange batik and printed "
        "cotton, stitched together with bright blue running stitch and zigzag. On the dark "
        "blocks: a pale yellow crescent moon with a sleeping face, a round pale yellow moon "
        "with a sleeping face in profile, and two red velvet hearts, each embroidered with a "
        "small white crown-like pattern. A pale yellow stitched hand reaches toward the lower "
        "heart. A few small batik flowers in red and yellow.",
        "keep": "the patchwork of blocks and batik borders, the blue stitching between them",
        "pieces": [
            "the crescent moon with the sleeping face",
            "the round moon with the sleeping face in profile",
            "the upper red heart with its white embroidery",
            "the lower red heart with its white embroidery",
            "the pale yellow stitched hand",
            "a cluster of small red and yellow batik flowers",
            "one indigo block from the middle of the quilt, as a square of cloth with its stitched edge",
            "a strip of red and orange batik border",
            "a small white batik star",
        ],
    },
    {
        "n": 3,
        "key": "golden-lady",
        "name": "The Golden Lady",
        "after": "her painting The Golden Lady",
        "refs": [
            "paintings/the-golden-lady-acrylic-on-silk-2016.jpg",
            "paintings/the-golden-lady-detail-face.jpg",
            "paintings/the-golden-lady-detail-dress.jpg",
            "paintings/the-golden-lady-detail-sky.jpg",
        ],
        "scene": "A young woman from the waist up, after her painting The Golden Lady, acrylic "
        "on silk: short orange-gold hair, a pale oval face with dark almond eyes and a small "
        "mouth, a long neck, a saffron-yellow dress with a V neck and loose sleeves, one hand on "
        "her hip. She stands a little left of centre, so the picture is wider than the original. "
        "Behind her a green field runs to a low horizon, a slim tree stands at the left edge, "
        "and the sky is soft lilac, pink and sky blue with tall smoky grey-violet and blue "
        "clouds rising on the right. Loose, wet brushwork; brown contour lines over the colour.",
        "keep": "the field, the horizon, the pale sky",
        "pieces": [
            "her head and neck, without the hair",
            "her orange-gold hair, as one piece",
            "her body in the saffron dress, from the shoulders to the waist, with the arm on her hip",
            "the slim tree at the left edge",
            "the tallest smoky grey-violet cloud",
            "a blue cloud",
            "a pink cloud",
            "a small pale sun low in the sky",
        ],
    },
    {
        "n": 4,
        "key": "black-tree",
        "name": "The black tree",
        "after": "her fibercollage of a black tree and faces",
        "refs": ["fibre/fibercollage-black-tree-and-faces.jpg", "mixed-media/collage-faces-tree-and-houses.jpg"],
        "scene": "A wide fibercollage after her black tree and faces: a rust-red and cream "
        "patchwork ground, a large black appliqué tree with bare, curving branches and a few "
        "big leaf shapes in black, ochre and cream, three women's faces cut from cream and "
        "white cloth with dark drawn features (one with long dark hair, one pale with closed "
        "eyes, one dark-skinned with a gold mask-like look), a band of black and white "
        "piano-key stripes across the top, harlequin diamonds in red and cream on the right, "
        "and a small row of Dutch gabled houses.",
        "keep": "the rust and cream patchwork, the piano-key band, the harlequin diamonds",
        "pieces": [
            "the black tree, trunk and branches",
            "a large black leaf",
            "a large ochre leaf",
            "a cream leaf",
            "the face with long dark hair",
            "the pale face with closed eyes",
            "the dark face with the gold mask-like look",
            "the row of small gabled houses",
            "a single red and cream harlequin diamond",
        ],
    },
    {
        "n": 5,
        "key": "two-moons",
        "name": "Two moons over lace mountains",
        "after": "her quilt of two moons bound in blue satin",
        "refs": ["fibre/quilt-two-moons-blue-satin.jpg", "fibre/tapestry-10-figure-sun-and-bird.jpg"],
        "scene": "A quilt after her two moons bound in blue satin: a range of pointed "
        "mountains pieced from white lace and pale floral prints with violet and rose, under "
        "a night sky of indigo and navy, with a band of pale yellow and sky-blue stripes "
        "sweeping across the top like a comet's trail. Two large pale moons of white and "
        "silver cloth hang above the peaks, and a golden crescent of couched gold thread hangs "
        "between them. The whole quilt is bound in shiny turquoise satin.",
        "keep": "the night sky, the turquoise satin binding",
        "pieces": [
            "the left pale moon",
            "the right pale moon",
            "the golden crescent of couched thread",
            "the lace mountain range, as one long piece",
            "the striped band of pale yellow and sky blue",
            "a single small lace peak, separate from the range",
            "a small silver star",
        ],
    },
    {
        "n": 6,
        "key": "dancers",
        "name": "The dancers",
        "after": "her quilt of red and blue dancers",
        "refs": ["fibre/quilt-red-and-blue-dancers.jpg", "fibre/quilt-red-figure-and-rose.jpg"],
        "scene": "A quilted panel after her red and blue dancers: a white and pale grey "
        "ground divided by red-printed borders into four or five compartments of different "
        "sizes, like rooms. In them, figures printed and painted in red and in cobalt blue "
        "dance, leap and turn, their limbs long and flowing; a round red sun in the top left "
        "compartment; a tall blue plant with curling leaves; a small framed window of quilted "
        "pale blue. A border of red and white triangles along the bottom.",
        "keep": "the white ground, the red borders between the compartments, the triangle border",
        "pieces": [
            "the leaping blue dancer",
            "the turning red dancer",
            "a pair of blue dancers holding hands",
            "a red dancer reaching up",
            "the round red sun",
            "the tall blue plant with curling leaves",
            "the small quilted window, as an empty frame",
        ],
    },
    {
        "n": 7,
        "key": "man-and-woman",
        "name": "Man and woman",
        "after": "her tapestry Man and Woman",
        "refs": ["fibre/tapestry-man-and-woman.jpg", "paintings/painting-embrace-in-blue.jpg"],
        "scene": "A tapestry after her Man and Woman: an old man and an old woman with grey "
        "and white hair sit facing each other across a table, their hands meeting in the "
        "middle, pieced from grey and mauve fabric with lace and white thread for their hair. "
        "A red patterned tablecloth with a looping scarlet ribbon runs along the bottom. "
        "Behind them a soft grey-rose ground with a little peaked house on the left, a large "
        "copper-gold sun of metallic cloth top left, and two bare brown trees on the right "
        "with orange leaves of silk. Scraps of lace and white embroidery here and there.",
        "keep": "the grey-rose ground, the table",
        "pieces": [
            "the man, seated, facing right",
            "the woman, seated, facing left",
            "the copper-gold sun",
            "the little peaked house",
            "the larger bare tree",
            "the smaller bare tree",
            "a single orange silk leaf",
            "the looping scarlet ribbon from the tablecloth",
        ],
    },
    {
        "n": 8,
        "key": "blue-lady",
        "name": "Blue Lady",
        "after": "her tapestry Blue Lady",
        "refs": ["fibre/tapestry-blue-lady.jpg", "mixed-media/watercolor-woman-at-window.jpg"],
        "scene": "A night tapestry after her Blue Lady: a woman lies stretched out along "
        "the middle of the picture as if floating on a river, her body pieced from many blues, "
        "teals and slate greys of cotton, satin and corduroy, her face pale and calm with "
        "closed eyes, her long hair flowing behind her into the water. The ground is a dark "
        "ribbed blue-black, with ripples of stitched teal thread. A small pale moon above, a "
        "fish of patterned blue cloth below her, a few tall reeds at the right edge.",
        "keep": "the dark ribbed ground, the stitched ripples",
        "pieces": [
            "the reclining woman, her face, body and hair as one piece",
            "the small pale moon",
            "the fish of patterned blue cloth",
            "a cluster of tall reeds",
            "a long ripple of stitched teal thread",
            "a scrap of turquoise satin, like a wave crest",
        ],
    },
    {
        "n": 9,
        "key": "crowd",
        "name": "The crowd of faces",
        "after": "her painting of a crowd of faces",
        "refs": ["paintings/painting-crowd-of-faces.jpg", "mixed-media/watercolor-face-with-handwriting.jpg"],
        "scene": "A painting after her crowd of faces: dozens of small faces, oval heads on "
        "long necks with simple drawn features, some with eyes closed and some looking out, "
        "packed together in rose, ochre, cream, dusty blue and slate, filling the picture "
        "like a crowd seen from above or a field of flowers. A little right of centre, one "
        "much larger face with wide open eyes looks straight out. A single large eye floats "
        "at the left. Lines of looping handwriting, unreadable, drift across the top.",
        "keep": "the packed crowd behind, the drifting handwriting",
        "pieces": [
            "the large face with wide open eyes",
            "the single floating eye",
            "a rose face with closed eyes",
            "an ochre face looking left",
            "a dusty blue face looking up",
            "a cream face with a long neck",
            "a slate face in profile",
            "a small pale face, smiling",
            "a pair of faces cheek to cheek",
        ],
    },
    {
        "n": 10,
        "key": "silk-bird",
        "name": "The silk bird",
        "after": "her fibercollage of a silk bird",
        "refs": ["fibre/fibercollage-silk-bird.jpg", "fibre/fibercollage-netting-and-pink-silk.jpg"],
        "scene": "A painted canvas after her silk bird: on a pale cream and grey ground, a "
        "large bird pieced from silk in magenta, cobalt, turquoise and violet flies left, its "
        "wings swept back; a small calm face is set in its breast like a locket. Long ribbons "
        "of colour (pale gold, rose, sky blue and lilac) swirl around it in loops, painted and "
        "stitched. Lower right, a fish of brown netting with orange stitching; a pink silk "
        "triangle in one corner.",
        "keep": "the pale painted ground",
        "pieces": [
            "the silk bird with the face in its breast",
            "a long gold ribbon loop",
            "a rose ribbon loop",
            "a sky-blue ribbon loop",
            "a lilac ribbon loop",
            "the netting fish with orange stitching",
            "the pink silk triangle",
        ],
    },
]

# Morph chains: pieces of one chain can grow into each other, so a piece can
# carry from one tableau into the next.
CHAINS = [
    {
        "key": "moon",
        "name": "Moon to sun to heart",
        "refs": ["fibre/fibercollage-moons-and-hearts.jpg", "paintings/viriditas.jpg", "fibre/quilt-two-moons-blue-satin.jpg"],
        "stages": [
            "a pale yellow crescent moon with a sleeping face",
            "a round pale moon, the sleeping face turned to the front",
            "a violet sun disc of painted silk, the face fading into its glow",
            "a copper-gold sun of metallic cloth with short stitched rays",
            "a red velvet heart with a white embroidered crown, its top curves the sun's rays",
        ],
    },
    {
        "key": "tree",
        "name": "Bare tree to berry tree",
        "refs": ["fibre/fibercollage-black-tree-and-faces.jpg", "paintings/viriditas.jpg", "paintings/woman-with-branch-yellow-field.jpg"],
        "stages": [
            "a bare black appliqué tree with curving branches",
            "the same tree budding, small green buds along the branches",
            "a tree with orange silk leaves",
            "a slender teal tree with clusters of red-orange berries",
            "a single budding branch, as if held in a hand",
        ],
    },
    {
        "key": "face",
        "name": "Sleeping face to open eyes",
        "refs": ["paintings/painting-crowd-of-faces.jpg", "paintings/the-golden-lady-detail-face.jpg", "mixed-media/watercolor-face-with-handwriting.jpg"],
        "stages": [
            "a pale oval face with closed eyes, drawn in one dark line on cream cloth",
            "the same face waking, eyes half open",
            "the face with dark almond eyes wide open, looking out",
            "the face turned three-quarters, gold hair beginning to show",
            "a mask-like gold and ochre face, eyes closed again",
        ],
    },
    {
        "key": "bird",
        "name": "Bird to fish to leaf",
        "refs": ["fibre/fibercollage-silk-bird.jpg", "fibre/fibercollage-netting-and-pink-silk.jpg", "fibre/tapestry-10-figure-sun-and-bird.jpg"],
        "stages": [
            "a silk bird in magenta and cobalt, wings spread",
            "the bird folding its wings, its body lengthening",
            "a fish of patterned blue cloth",
            "a fish of brown netting with orange stitching",
            "a long orange silk leaf, its veins the fish's stitches",
        ],
    },
    {
        "key": "figure",
        "name": "Dancer to sleeper",
        "refs": ["fibre/quilt-red-and-blue-dancers.jpg", "fibre/quilt-red-figure-and-rose.jpg", "fibre/tapestry-blue-lady.jpg"],
        "stages": [
            "a red silhouette of a standing figure, cut from one piece of cloth, no face",
            "a blue printed dancer, arms raised",
            "a dancer turning, leaning over",
            "a figure crouching, curled forward",
            "a woman lying stretched out, pieced from blues, eyes closed",
        ],
    },
    {
        "key": "flower",
        "name": "Rose to berries to heart",
        "refs": ["fibre/quilt-red-figure-and-rose.jpg", "paintings/viriditas.jpg", "fibre/fibercollage-moons-and-hearts.jpg"],
        "stages": [
            "a pink fabric rose with layered petals",
            "a violet bloom, opening",
            "a cluster of red-orange berries",
            "a cluster of small red and yellow batik flowers",
            "a small red heart, stitched",
        ],
    },
]

TEXTURES = [
    ("indigo-batik", "Indigo batik", "deep indigo cotton batik with small pale crescent and dot patterns, slightly uneven dye", "fibre/fibercollage-moons-and-hearts.jpg"),
    ("rust-paisley", "Rust paisley", "rust red and orange printed paisley cotton with fine black detail", "fibre/quilt-red-figure-and-rose.jpg"),
    ("gold-damask", "Gold damask", "heavy olive-gold damask woven with large leafy scrolls on a dark ground", "fibre/tapestry-20-crouching-figure-on-damask.jpg"),
    ("turquoise-satin", "Turquoise satin", "shiny turquoise satin with soft rippled highlights", "fibre/quilt-two-moons-blue-satin.jpg"),
    ("black-lace", "White lace on black", "white floral lace laid over black cotton", "fibre/quilt-two-moons-blue-satin.jpg"),
    ("brown-netting", "Brown netting", "coarse brown netting over dark felt, with a few loose orange threads", "fibre/fibercollage-netting-and-pink-silk.jpg"),
    ("green-silk", "Yellow-green painted silk", "silk painted in acid yellow and yellow-green washes with soft teal blooms", "paintings/viriditas.jpg"),
    ("ultramarine-canvas", "Ultramarine painted canvas", "canvas painted in deep ultramarine with visible brush marks", "paintings/painting-embrace-in-blue.jpg"),
]

MASKS = [
    ("torn-paper", "Torn paper", "torn along wandering rips, like collage paper being pulled away in strips from one corner"),
    ("watercolour-bloom", "Watercolour bloom", "spreading outward from several points like wet watercolour blooms, with ragged, cauliflower edges"),
    ("seams", "Seams", "block by block along a patchwork of irregular rectangles, each block going in turn, the seams between them last"),
    ("unravel", "Unravelling thread", "thread by thread along long horizontal lines, like a woven cloth unravelling from the top"),
    ("swirl", "Swirl", "in a spiral from the centre outward, with the arms of the spiral wavering like a painted stroke"),
    ("stitch-line", "Stitch line", "from one side to the other along a wavering line of running stitches, dashes of white ahead of the edge"),
]

SECTIONS = {
    "ui": ("Brand and interface", "The title, the icon, and the pieces of the interface drawn in her line."),
    "tableau": (
        "Tableaux",
        "Each scene has three requests: the **composition** (`-A`), the full picture, which is "
        "the reference for the other two and the scene's resting state; the **ground** (`-B`), "
        "the same picture with the moving pieces taken out; and the **pieces** (`-C`), those "
        "pieces cut out on one transparent sheet. Make the composition first, then the ground "
        "and the pieces with it attached.",
    ),
    "chain": (
        "Morph chains",
        "Motifs that grow into each other, so pieces can travel from one scene to the next. "
        "Each stage is cut apart on integration and blended into the next in the game.",
    ),
    "texture": (
        "Fabric textures",
        "Seamless swatches that fill shapes and show through where a panel is torn away or a "
        "piece is stretched past its edge.",
    ),
    "mask": (
        "Dissolve masks",
        "Greyscale maps that decide how one image wears away into another. The game can make "
        "plain noise ones itself; these give the dissolves her materials.",
    ),
    "anim": (
        "Life",
        "Small extra pictures that make the scenes feel alive: loose leaves and petals that blow "
        "across on a gust, eyes that close for a blink, a bird's wings. Most of the life is "
        "made in code (trees bending in the wind, breathing, drifting clouds, swimming fish); "
        "these are the parts code cannot fake. Each swap is drawn exactly over the piece it "
        "replaces, so attach that piece.",
    ),
}

REQUESTS: list[dict] = [
    {
        "id": "HK-U01",
        "section": "ui",
        "name": "Title",
        "key": "logo",
        "file": "assets/ui/logo.png",
        "size": "1600 x 700, transparent",
        "used": "The title screen above Press Start, and the card on the game library page.",
        "standin": "The title set in a hand-drawn style in code.",
        "ref": ["mixed-media/watercolor-face-with-handwriting.jpg", "fibre/fibercollage-moons-and-hearts.jpg"],
        "prompt": "A title for a game, spelled exactly \"Fibre Art\", written in one flowing line "
        "of dark red thread as if stitched into cloth, the loops of the letters like her "
        "looping handwriting, with a few loose thread ends. Beneath the words, a short row of "
        "small cut-cloth motifs sewn on with running stitch: a pale yellow crescent moon with "
        "a sleeping face, a red heart, a teal tree, a violet sun. Wide landscape composition "
        "filling about 85% of the width, no other text. " + LOOK.format(links(
            ["mixed-media/watercolor-face-with-handwriting.jpg", "fibre/fibercollage-moons-and-hearts.jpg"]
        )) + " " + ALPHA,
    },
    {
        "id": "HK-U02",
        "section": "ui",
        "name": "App icon and favicon",
        "key": "icon",
        "file": "assets/ui/icon.png",
        "size": "1024 x 1024, transparent",
        "used": "Browser tab and home-screen icon (scaled to 512, 192 and 180 px).",
        "standin": "A drawn crescent moon on an indigo tile.",
        "ref": ["fibre/fibercollage-moons-and-hearts.jpg"],
        "prompt": STYLE + " App icon: a pale yellow crescent moon with a sleeping face, cut "
        "from cloth and sewn with visible stitches onto a rounded-square tile of deep indigo "
        "batik, a small red heart tucked in the crescent's curve, a running stitch in bright "
        "blue around the tile's edge. Bold and simple, readable at 48 px; the moon fills about "
        "70% of the tile. Transparent corners outside the rounded square (PNG with alpha), or "
        "flat magenta #FF00FF corners if transparency is not possible. "
        + LOOK.format(links(["fibre/fibercollage-moons-and-hearts.jpg"])),
    },
    {
        "id": "HK-U03",
        "section": "ui",
        "name": "Line drawings for the interface",
        "key": "lineDrawings",
        "file": "assets/ui/line-drawings.png",
        "size": "2048 x 2048, transparent",
        "used": "Menus, the instructions, the bindings card and the little drawings pinned "
        "beside a piece when a control is found.",
        "standin": "Plain vector strokes.",
        "ref": ["mixed-media/drawing-embrace-with-boots.jpg", "paintings/painting-embrace-in-blue.jpg", "mixed-media/watercolor-woman-at-window.jpg"],
        "prompt": "A sheet of small line drawings in the style of Hanneke de Neve's pen "
        "drawings: each one a single fluid, unbroken dark brown-black ink line, drawn fast "
        "with a fine pen, no shading and no colour fill. " + GRID.format(4, 3) + "The drawings, "
        "in order: " + numbered([
            "a woman's face with closed eyes, an oval head on a long neck",
            "a woman's face with open almond eyes, looking out",
            "two figures embracing",
            "a figure seen from behind at a window, arms open",
            "a hand reaching, fingers open",
            "a hand holding a needle with a loose thread",
            "a crescent moon with a sleeping face",
            "a heart with a small crown drawn inside",
            "a bare tree",
            "a bird in flight",
            "a pair of felt boots",
            "a spool of thread",
        ]) + " " + LOOK.format(links(
            ["mixed-media/drawing-embrace-with-boots.jpg", "paintings/painting-embrace-in-blue.jpg", "mixed-media/watercolor-woman-at-window.jpg"]
        )) + " " + ALPHA,
    },
    {
        "id": "HK-U04",
        "section": "ui",
        "name": "Stitches and threads",
        "key": "threads",
        "file": "assets/ui/threads.png",
        "size": "2048 x 2048, transparent",
        "used": "Threads drawn along splines in the game: the outline round a found control's "
        "target, the threads that link pieces, trails behind moving pieces, menu dividers.",
        "standin": "Dashed strokes drawn in code.",
        "ref": ["fibre/fibercollage-moons-and-hearts.jpg", "fibre/fibercollage-netting-and-pink-silk.jpg", "fibre/tapestry-10-figure-sun-and-bird.jpg"],
        "prompt": "A sheet of real sewing thread and stitches photographed flat, for a game "
        "that cuts each one out and bends it along a path. Each item lies in a perfectly "
        "straight horizontal line across almost the full width of the sheet, one above the "
        "other with wide gaps, nothing touching. In order from top to bottom: " + numbered([
            "a running stitch in white cotton thread, even dashes as if sewn through cloth that is not there",
            "a running stitch in bright blue thread",
            "a machine zigzag stitch in orange thread",
            "a couched gold thread, a thick gold cord held down by tiny cross stitches",
            "a loose length of red embroidery thread, lying straight, slightly twisted",
            "a length of white thread with a frayed end on the right",
            "a narrow ribbon of rose silk, lying straight and flat",
            "a narrow ribbon of turquoise satin, lying straight and flat",
        ]) + " Even soft light, no shadows. " + ALPHA,
    },
]

# The pause menu is pictures to choose between, not words (the owner's ask).
REQUESTS.append({
    "id": "HK-U06",
    "section": "ui",
    "name": "Pause menu pictures",
    "key": "pauseIcons",
    "file": "assets/ui/pause-icons.png",
    "size": "2048 x 1024, transparent",
    "used": "The pause menu's buttons, which are pictures with no words, and the close button of every panel.",
    "standin": "Simple line icons drawn in code.",
    "ref": ["fibre/fibercollage-moons-and-hearts.jpg", "fibre/tapestry-man-and-woman.jpg"],
    "note": "Attach HK-U02 (assets/ui/icon.png) and HK-U03 (assets/ui/line-drawings.png) so the badges match the icon and the line.",
    "prompt": STYLE + " A sheet of eight round appliqué badges for a game's pause menu, each one a "
    "circle of cream linen with a dashed red running stitch round its edge, and on it one simple "
    "motif cut from cloth and sewn on, bold and readable at 80 px, centred, filling about two thirds "
    "of the badge. All eight the same size, the same cream linen and the same stitched border, so "
    "they read as one set. " + GRID.format(4, 2) + "The motifs, in order: " + numbered([
        "a play triangle pointing right, cut from saffron silk (resume)",
        "an open hand of pale yellow cloth, palm up, with short loose threads running from its fingertips (the controls you have found)",
        "a single wide-open eye of cream and blue cloth, its lashes stitched in dark thread (a hint: look closely)",
        "an open book whose pages are pieces of cloth, with lines of running stitch for writing (how to play)",
        "a wooden spool wound with red thread, a needle stuck through it (settings)",
        "a small square quilt block in indigo and red with a stitched arrow pointing right (the next picture)",
        "a little peaked house of patchwork with a red roof (back to the title)",
        "two dressmaker's pins crossed in an X (close)",
    ]) + " No words or letters anywhere. " + LOOK.format(links(["fibre/fibercollage-moons-and-hearts.jpg", "fibre/tapestry-man-and-woman.jpg"]))
    + " " + ALPHA,
    "pieces": ["resume", "controls", "hint", "howto", "settings", "next", "title", "close"],
})

# HK-U06's eighth badge (two crossed pins) did not read at the size of a close
# button, and the owner preferred a plain drawn X there, so the close button
# stays drawn in code. The title screen's three corner buttons take badges
# like the pause menu's: How to play and Settings reuse HK-U06; fullscreen
# needs one of its own.
REQUESTS.append({
    "id": "HK-U07",
    "section": "ui",
    "name": "Fullscreen badge",
    "key": "fullscreenBadge",
    "file": "assets/ui/fullscreen-badge.png",
    "size": "512 x 512, transparent",
    "used": "The fullscreen button in the bottom right of the title screen, beside the How to play and Settings badges from HK-U06.",
    "standin": "A cream cloth circle with a drawn four-corner frame.",
    "ref": ["fibre/fibercollage-moons-and-hearts.jpg"],
    "note": "Attach HK-U06 (assets/ui/pause-icons.png) and match its badges exactly: the same cream linen, the same dashed red running stitch border, the same size and light.",
    "prompt": STYLE + " One round appliqué badge, matching the attached set of pause menu badges "
    "exactly (the same circle of cream linen, the same dashed red running stitch round its edge, the "
    "same size, lighting and style), for a game's fullscreen button. On it, a small rectangle of "
    "patterned cotton (a little picture, like a window) with four bold corner brackets of deep red "
    "felt sewn just outside its corners, each bracket an L pointing outward, as if the picture is "
    "growing to fill the frame. It must read plainly as fullscreen even at 48 px: bold shapes, strong "
    "contrast against the cream. No words, no letters. Centred, nothing else on the badge. " + ALPHA,
})

# Asked for after the first play: the pin beside a found control borrowed a
# hand, a spool and a needle; these say plainly which kind of control it was.
REQUESTS.append({
    "id": "HK-U05",
    "section": "ui",
    "name": "Line drawings of the controls",
    "key": "controlDrawings",
    "file": "assets/ui/control-drawings.png",
    "size": "2048 x 1024, transparent",
    "used": "The small drawing pinned beside a piece when a control is found, and the card of controls found.",
    "standin": "The hand, spool and needle from the line drawings (HK-U03).",
    "ref": ["mixed-media/drawing-embrace-with-boots.jpg"],
    "note": "Attach HK-U03 (assets/ui/line-drawings.png) so the line matches.",
    "prompt": "A sheet of small line drawings in the same hand as the attached sheet of line drawings: "
    "each one a single fluid, unbroken dark brown-black ink line, drawn fast with a fine pen, no "
    "shading and no colour fill, slightly wobbly and human, never mechanical. "
    + GRID.format(4, 2)
    + "The drawings, in order: " + numbered([
        "a thumbstick seen from above at an angle, a round cap on a short stem, with a curved arrow circling it",
        "a trigger seen from the side, a curved paddle being pressed by one fingertip",
        "a single round button being pressed by a fingertip, small lines radiating from it",
        "a long rounded shoulder button pressed by a fingertip",
        "a cross-shaped D-pad seen from above, one arm pressed",
        "a hand holding a game controller loosely, seen from above, drawn in one line",
        "two hands each holding a controller, side by side",
        "a thread running from a controller to a small crescent moon, as if the controller pulls the moon on a string",
    ])
    + " No letters or symbols on the controls. "
    + LOOK.format(links(["mixed-media/drawing-embrace-with-boots.jpg"]))
    + " " + ALPHA,
})

for t in TABLEAUX:
    n = f"{t['n']:02d}"
    look = LOOK.format(links(t["refs"]))
    comp_id, comp_file = f"HK-T{n}-A", f"assets/tableaux/{t['key']}/composition.webp"
    cols, rows = grid(len(t["pieces"]))
    REQUESTS += [
        {
            "id": comp_id,
            "section": "tableau",
            "name": f"{t['name']}: composition",
            "key": f"{t['key']}.composition",
            "file": comp_file,
            "size": "1920 x 1080, opaque",
            "used": f"Scene {t['n']}, after {t['after']}: its resting state, the reference for its "
            "ground and pieces, and a picture to keep on its own.",
            "standin": "The reference photo, stretched to fill.",
            "ref": t["refs"],
            "prompt": STYLE + " " + COMPOSITION + t["scene"] + " The motifs that will move: "
            + "; ".join(t["pieces"]) + ". " + look,
        },
        {
            "id": f"HK-T{n}-B",
            "section": "tableau",
            "name": f"{t['name']}: ground",
            "key": f"{t['key']}.ground",
            "file": f"assets/tableaux/{t['key']}/ground.webp",
            "size": "1920 x 1080, opaque",
            "used": f"Scene {t['n']}: the layer behind the pieces, cut into panels and warped by the large effects.",
            "standin": "The reference photo, blurred where the pieces sit.",
            "ref": t["refs"],
            "note": f"Attach {comp_id} when generating. What stays: {t['keep']}.",
            "prompt": STYLE + " " + GROUND.format(comp_id, comp_file, "; ".join(t["pieces"])) + look,
        },
        {
            "id": f"HK-T{n}-C",
            "section": "tableau",
            "name": f"{t['name']}: pieces",
            "key": f"{t['key']}.pieces",
            "file": f"assets/tableaux/{t['key']}/pieces.png",
            "size": "2048 x 2048, transparent",
            "used": f"Scene {t['n']}: the pieces that move, cut apart in this order on integration.",
            "standin": "Ovals and rectangles cut from the reference photo.",
            "ref": t["refs"],
            "note": f"Attach {comp_id} when generating. {len(t['pieces'])} pieces in a {cols} x {rows} grid.",
            "pieces": t["pieces"],
            "prompt": STYLE + " " + PIECES.format(comp_id, comp_file) + GRID.format(cols, rows)
            + "The pieces, in order: " + numbered(t["pieces"]) + " " + look + " " + ALPHA,
        },
    ]

for i, c in enumerate(CHAINS, start=1):
    REQUESTS.append({
        "id": f"HK-M{i:02d}",
        "section": "chain",
        "name": c["name"],
        "key": f"chain.{c['key']}",
        "file": f"assets/chains/{c['key']}.png",
        "size": "3000 x 700, transparent",
        "used": "Pieces that change into one another, and carry over between scenes.",
        "standin": "A cross-fade between pieces of the tableaux.",
        "ref": c["refs"],
        "pieces": c["stages"],
        "prompt": STYLE + " " + CHAIN.format(len(c["stages"]), "; ".join(c["stages"]))
        + LOOK.format(links(c["refs"])) + " " + ALPHA,
    })

for key, name, fabric, ref in TEXTURES:
    REQUESTS.append({
        "id": f"HK-X{len([r for r in REQUESTS if r['section'] == 'texture']) + 1:02d}",
        "section": "texture",
        "name": name,
        "key": f"texture.{key}",
        "file": f"assets/textures/{key}.webp",
        "size": "1024 x 1024, opaque, tiling",
        "used": "Fills and backings behind torn panels and stretched pieces.",
        "standin": "A flat colour from the scene's palette with noise.",
        "ref": [ref],
        "prompt": TILE.format(fabric) + LOOK.format(links([ref])),
    })

for key, name, how in MASKS:
    REQUESTS.append({
        "id": f"HK-D{len([r for r in REQUESTS if r['section'] == 'mask']) + 1:02d}",
        "section": "mask",
        "name": name,
        "key": f"mask.{key}",
        "file": f"assets/masks/{key}.png",
        "size": "1024 x 1024, greyscale",
        "used": "Dissolves between scenes and between morph stages.",
        "standin": "Value noise generated in code.",
        "prompt": MASK.format(how),
    })

DELIVERED_IDS = {
    "HK-U07",
    "HK-U06",
    "HK-A01",
    "HK-A02",
    "HK-A03",
    "HK-A04",
    "HK-A05",
    "HK-U02",
    "HK-U05",
    "HK-T01-B",
    "HK-T02-C",
    "HK-T06-C",
    "HK-M02",
    "HK-M04",
    "HK-D01",
    "HK-D02",
    "HK-D03",
    "HK-D04",
    "HK-D05",
    "HK-D06",
    "HK-M01",
    "HK-M03",
    "HK-M05",
    "HK-M06",
    "HK-T01-A",
    "HK-T01-C",
    "HK-T02-A",
    "HK-T02-B",
    "HK-T03-A",
    "HK-T03-B",
    "HK-T03-C",
    "HK-T04-A",
    "HK-T04-B",
    "HK-T04-C",
    "HK-T05-A",
    "HK-T05-B",
    "HK-T05-C",
    "HK-T06-A",
    "HK-T06-B",
    "HK-T07-A",
    "HK-T07-B",
    "HK-T07-C",
    "HK-T08-A",
    "HK-T08-B",
    "HK-T08-C",
    "HK-T09-A",
    "HK-T09-B",
    "HK-T09-C",
    "HK-T10-A",
    "HK-T10-B",
    "HK-T10-C",
    "HK-U01",
    "HK-U03",
    "HK-U04",
    "HK-X01",
    "HK-X02",
    "HK-X03",
    "HK-X04",
    "HK-X05",
    "HK-X06",
    "HK-X07",
    "HK-X08",
}

# Requests the image service rejected on the first try ("input rejected by
# safety system; category other"). The retry leaves out the artist's name and
# the photos of her work (two of which showed her), and attaches images already
# generated for this game instead, which passed.
ASSET_URL = "https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/"
PLAIN_STYLE = STYLE.replace(
    "Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes "
    "fibercollages, quilts, tapestries and paintings:",
    "Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings:",
)
RETRY = {
    "HK-U02": ["game/assets/chains/moon.png", "game/assets/textures/indigo-batik.webp"],
    "HK-T01-B": ["game/assets/tableaux/viriditas/composition.webp"],
    "HK-T02-C": ["game/assets/tableaux/night-quilt/composition.webp"],
    "HK-T06-C": ["game/assets/tableaux/dancers/composition.webp"],
    "HK-M02": [
        "game/assets/tableaux/viriditas/pieces/02-the-tallest-teal-tree-trunk-and-branches-from-the-ground-to-the-top.png",
        "game/assets/tableaux/black-tree/pieces/01-the-black-tree-trunk-and-branches.png",
        "game/assets/tableaux/man-and-woman/pieces/05-the-larger-bare-tree.png",
    ],
    "HK-M04": [
        "game/assets/tableaux/silk-bird/pieces/01-the-silk-bird-with-the-face-in-its-breast.png",
        "game/assets/tableaux/blue-lady/pieces/03-the-fish-of-patterned-blue-cloth.png",
        "game/assets/tableaux/silk-bird/pieces/06-the-netting-fish-with-orange-stitching.png",
        "game/assets/tableaux/man-and-woman/pieces/07-a-single-orange-silk-leaf.png",
    ],
}
for r in REQUESTS:
    if r["id"] not in RETRY:
        continue
    prompt = r["prompt"].replace(STYLE, PLAIN_STYLE).replace("in the style of Hanneke de Neve's pen drawings", "in a fluid pen-drawing style")
    cut = prompt.find("For the style, materials and palette, look at her work")
    if cut >= 0:
        end = prompt.find(" .", cut) + 2
        prompt = prompt[:cut] + "Match the look of these images, made earlier for the same game: " + " , ".join(ASSET_URL + f for f in RETRY[r["id"]]) + " ." + prompt[end:]
    r["prompt"] = prompt
    r["ref"] = []
    r["attach"] = RETRY[r["id"]]
    r["note"] = (r.get("note", "") + " Retry: the first attempt was rejected by the image service (category other). This "
                 "prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.").strip()

SWAP = (
    "Replacement pieces for animation, each drawn to sit exactly in place of the attached "
    "original piece: the same size, framing, outline, colours, cloth and stitching, the same "
    "pose and the same position in its cell, with only the change described. Laid over the "
    "original, everything but that change must line up. "
)


def anim(id_, name, key, file, size, used, standin, attach, prompt, refs_=None, pieces=None):
    return {
        "id": id_, "section": "anim", "name": name, "key": key, "file": file, "size": size,
        "used": used, "standin": standin, "ref": refs_ or [], "attach": attach,
        "note": "Attach the files listed under Attach; they are the pieces this matches.",
        "prompt": prompt, **({"pieces": pieces} if pieces else {}),
    }


P = "game/assets/tableaux/"
REQUESTS += [
    anim(
        "HK-A01", "Loose leaves and petals", "anim.drift", "assets/anim/drift.png", "2048 x 1024, transparent",
        "Single leaves and petals blown across the windy scenes (Viriditas, The Golden Lady, "
        "The black tree, Man and woman) on each gust, turning as they go.",
        "The single leaves from The black tree and Man and woman.",
        [P + "man-and-woman/pieces/07-a-single-orange-silk-leaf.png", P + "black-tree/pieces/03-a-large-ochre-leaf.png",
         P + "viriditas/pieces/12-a-patch-of-orange-fallen-leaves.png"],
        STYLE + " A sheet of single small cut-cloth leaves and petals, each one loose and whole, "
        "lying flat, seen from straight above, with frayed edges and a line of stitching for its "
        "vein, for a game that blows them across the picture. " + GRID.format(6, 2) + "In order: "
        + numbered([
            "an orange silk leaf", "a red-orange silk leaf, slightly curled", "a saffron leaf",
            "an ochre leaf", "a cream leaf with a brown stitched vein", "a black leaf with a white stitched vein",
            "a small yellow-green leaf", "a teal leaf", "a pink rose petal", "a red petal",
            "a single red-orange berry with a short stem", "a white blossom with five petals",
        ])
        + " Each about the same size. " + LOOK.format(links(["fibre/fibercollage-black-tree-and-faces.jpg", "paintings/viriditas.jpg"]))
        + " " + ALPHA,
        refs_=["fibre/fibercollage-black-tree-and-faces.jpg", "paintings/viriditas.jpg"],
        pieces=["orange", "red-orange", "saffron", "ochre", "cream", "black", "yellow-green", "teal",
                "rose petal", "red petal", "berry", "blossom"],
    ),
    anim(
        "HK-A02", "The Golden Lady blinks", "anim.blink.golden-lady", "assets/anim/blink-golden-lady.png", "1024 x 1024, transparent",
        "Her face for a moment with her eyes closed, every few seconds, so she breathes and blinks instead of staring.",
        "No blink: she breathes and tilts her head.",
        [P + "golden-lady/pieces/01-her-head-and-neck-without-the-hair.png"],
        STYLE + " " + SWAP + "The piece: her head and neck, without the hair. The change: her eyes "
        "are closed, drawn as two calm downward curves with lashes in the same dark line, as if she "
        "is blinking. One piece, centred. " + LOOK.format(links(["paintings/the-golden-lady-detail-face.jpg"])) + " " + ALPHA,
        refs_=["paintings/the-golden-lady-detail-face.jpg"],
    ),
    anim(
        "HK-A03", "The crowd blinks", "anim.blink.crowd", "assets/anim/blink-crowd.png", "2048 x 1024, transparent",
        "The open-eyed faces of the crowd blink now and then, each on its own rhythm.",
        "No blink: the faces breathe and tilt.",
        [P + "crowd/pieces/01-the-large-face-with-wide-open-eyes.png", P + "crowd/pieces/04-an-ochre-face-looking-left.png",
         P + "crowd/pieces/05-a-dusty-blue-face-looking-up.png", P + "crowd/pieces/08-a-small-pale-face-smiling.png"],
        STYLE + " " + SWAP + GRID.format(4, 1) + "The pieces, each with its eyes closed as if blinking, "
        "drawn as calm downward curves in the same dark line: " + numbered([
            "the large face with wide open eyes", "the ochre face looking left",
            "the dusty blue face looking up", "the small pale smiling face",
        ]) + " " + LOOK.format(links(["paintings/painting-crowd-of-faces.jpg"])) + " " + ALPHA,
        refs_=["paintings/painting-crowd-of-faces.jpg"],
        pieces=["01", "04", "05", "08"],
    ),
    anim(
        "HK-A04", "The black tree blinks", "anim.blink.black-tree", "assets/anim/blink-black-tree.png", "2048 x 1024, transparent",
        "The two open-eyed women of The black tree blink now and then.",
        "No blink: they breathe and tilt.",
        [P + "black-tree/pieces/05-the-face-with-long-dark-hair.png", P + "black-tree/pieces/07-the-dark-face-with-the-gold-mask-like-look.png"],
        STYLE + " " + SWAP + GRID.format(2, 1) + "The pieces, each with its eyes closed as if "
        "blinking, drawn as calm downward curves in the same line: " + numbered([
            "the face with long dark hair", "the dark face with the gold mask-like look",
        ]) + " " + LOOK.format(links(["fibre/fibercollage-black-tree-and-faces.jpg"])) + " " + ALPHA,
        refs_=["fibre/fibercollage-black-tree-and-faces.jpg"],
        pieces=["05", "07"],
    ),
    anim(
        "HK-A05", "The bird's wings", "anim.bird", "assets/anim/bird-viriditas.png", "2048 x 1024, transparent",
        "The small teal bird in Viriditas flicks its wings and ruffles now and then on its branch.",
        "The bird hops and tilts instead.",
        [P + "viriditas/pieces/11-a-small-bird-of-stitched-teal-silk-among-the-branches.png"],
        STYLE + " " + SWAP + GRID.format(3, 1) + "The changes, in order: " + numbered([
            "its wings half open, lifted a little off its back, as if about to fly",
            "its wings fully raised above its back, feathers spread",
            "its feathers ruffled and its head turned to look back over its shoulder",
        ]) + " Its feet stay on the same spot in every one. "
        + LOOK.format(links(["paintings/viriditas.jpg"])) + " " + ALPHA,
        refs_=["paintings/viriditas.jpg"],
    ),
]

for r in REQUESTS:
    r.setdefault("status", "delivered" if r["id"] in DELIVERED_IDS else "requested")


def refs(r: dict) -> list[str]:
    return r.get("ref") or []


def asset_list() -> str:
    data = {
        r["key"]: {
            "id": r["id"],
            "file": r["file"],
            "delivered": r["status"] == "delivered",
            **({"pieces": r["pieces"]} if r.get("pieces") else {}),
        }
        for r in REQUESTS
    }
    return json.dumps(data, indent=2) + "\n"


def document() -> str:
    delivered = sum(r["status"] == "delivered" for r in REQUESTS)
    out = [
        "# Fibre Art: image requests",
        "",
        "Artwork for Fibre Art, the shifting collage in `fibreart/` (see [`design.md`](design.md)). "
        "Generated from `source/build_requests.py`; edit the data there and rerun it, which also "
        "rewrites `asset-list.json`.",
        "",
        "## How to use this list",
        "",
        "1. Each prompt is complete on its own: paste it as it stands. The shared style text is already in every prompt.",
        "2. **Give the generator the reference photos.** Every request names photos of Hanneke's own work in "
        "`fibreart/reference/`, and its prompt links to them. Attach them where the generator takes images: "
        "they matter more than the words.",
        "3. **Composition first.** Each scene has three requests. Make the composition (`-A`) first and settle it: "
        "it is a finished picture in its own right, and the reference for the rest. Then make the ground (`-B`) and "
        "the pieces (`-C`) with the composition attached, so the pieces match it in shape, colour and scale. If a "
        "piece drifts from the composition, regenerate the piece, not the composition.",
        "4. Save each image under the file name in its **File** line and drop it in `fibreart/intake/`. On "
        "integration it moves to that path under `fibreart/game/`, its status flips to `delivered`, and the pieces "
        "on a sheet are cut apart and named in the order the prompt lists them.",
        "5. Transparent images are `.png`. If the generator cannot produce alpha, use a flat pure magenta "
        "`#FF00FF` background as the prompts say; it is keyed out on integration. Opaque images are listed as "
        "`.webp`; PNG or JPEG is fine too.",
        "6. If a generator struggles with a whole sheet, split it: the first half of the list and the second half "
        "as two images, saved as `pieces-1.png` and `pieces-2.png`, each in the same order and at the same scale.",
        "7. Nothing here blocks a prototype: until an image arrives the game cuts a stand-in from the reference "
        "photos, or draws noise for the masks and textures.",
        "8. Order of work: a few compositions first (Viriditas, Moons and hearts, The Golden Lady are enough to "
        "test the idea), then their grounds and pieces, then the morph chains, then the rest. The textures and "
        "masks can come any time.",
        "",
        "## Status",
        "",
        f"{len(REQUESTS) - delivered} requested, {delivered} delivered, {len(REQUESTS)} in total.",
        "",
    ]
    for key, (title, blurb) in SECTIONS.items():
        out += [f"## {title}", "", blurb, ""]
        for r in (r for r in REQUESTS if r["section"] == key):
            out += [
                f"### {r['id']} · {r['name']}",
                "",
                f"- **File:** `fibreart/game/{r['file']}`",
                f"- **Size:** {r['size']}",
                f"- **Used for:** {r['used']}",
                f"- **Stand-in until delivered:** {r['standin']}",
                *([f"- **Reference:** " + ", ".join(f"[`{f.split('/')[-1]}`](../reference/{f})" for f in refs(r))] if refs(r) else []),
                *([f"- **Attach:** " + ", ".join(f"[`{f.split('/')[-1]}`](../{f})" for f in r["attach"])] if r.get("attach") else []),
                *([f"- **Note:** {r['note']}"] if r.get("note") else []),
                f"- **Status:** {r['status']}",
                "",
                "```text",
                r["prompt"],
                "```",
                "",
            ]
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    ids = [r["id"] for r in REQUESTS]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    for i in dupes:
        print(f"duplicate request id: {i}")
    missing = sorted({f for r in REQUESTS for f in refs(r) if not (ROOT / "reference" / f).exists()})
    for f in missing:
        print(f"missing reference photo: fibreart/reference/{f}")
    if missing or dupes:
        return 1
    outputs = {DOC: document(), ASSET_LIST: asset_list()}
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
