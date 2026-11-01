#!/usr/bin/env python3
"""Generate the Bronze Drum image requests and the game's asset manifest.

Edit the data in this file, then run:

    python3 bronzedrum/design/source/build_requests.py          # write
    python3 bronzedrum/design/source/build_requests.py --check  # verify up to date

Outputs:
    bronzedrum/design/image-requests.md   - the request document
    bronzedrum/game/assets/manifest.json  - what the game loads

Statuses:
    stand-in   the game draws a procedural paper-cut stand-in and loads the
               file from game/assets/art/ once the status is flipped to
               "delivered"
    planned    requested for a later build; the game does not load it yet
    reference  inspiration and direction only; lives in design/references/
    delivered  the file is in the repository and the game loads it
    regenerate delivered, but a new take is wanted (the request says why and
               its prompt is revised); the game keeps loading the current file
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "design" / "image-requests.md"
MANIFEST = ROOT / "game" / "assets" / "manifest.json"

# Same values as game/src/palette.js.
PALETTE = {
    "rice paper": "#F2E8D5",
    "paper shade": "#D9C9A8",
    "ink": "#16151A",
    "night indigo": "#1E2A44",
    "dusk indigo": "#3A4C6E",
    "bronze": "#B07A3A",
    "bronze light": "#D9A55B",
    "verdigris": "#4F8A7B",
    "lacquer red": "#A8322D",
    "moon": "#F6F0DC",
    "Han iron": "#5E6470",
    "Han iron dark": "#33373F",
    "straw": "#C9A866",
}

STYLE = (
    "Hand-cut paper art. Flat silhouettes cut with a knife from thick handmade rice paper and "
    "white fibre sheets, with intricate cut-out holes (leaf veins, crescents, scallops, lattice) "
    "that let light through. Lit from behind: light glows through the cuts and each layer casts a "
    "soft shadow on the layer behind it. Motifs from Dong Son bronze drums (a 12-point sun-star, "
    "concentric rings, flying herons, feather-crowned figures in profile, long boats, stilt houses "
    "with saddle roofs) and northern Vietnamese plants (areca palms, bamboo, lotus, rice). "
    "Folkloric, intimate and ceremonial. Limited palette: rice paper cream, ink black, night "
    "indigo, bronze, verdigris and lacquer red. No painterly gradients except the glow of the "
    "backlight, no photorealism, no 3D render look, no text, no watermark."
)

CUTOUT = (
    "Single cut-paper figure, side profile, full body, feet on the bottom edge, centred, "
    "transparent background (PNG with alpha). If transparency is not possible, use a flat pure "
    "magenta #FF00FF background with nothing else on it and no cast shadow: the game adds its "
    "own shadow."
)

STRIP = (
    "Seamless horizontally: the left and right edges must join with no visible seam. "
    "Transparent above the silhouette (PNG with alpha); the game layers it over the sky."
)

# id, game asset id, title, purpose, spec, status, stand-in, file, prompt
REQUESTS: list[dict] = []


def req(section, rid, asset, title, purpose, spec, status, standin, file, prompt):
    # Direction pieces carry the shared style too, except the installation photograph.
    if section == "mood" and rid != "BD-M02":  # style frames set their own treatment
        prompt = f"{STYLE} {prompt}"
    REQUESTS.append(
        dict(section=section, id=rid, asset=asset, title=title, purpose=purpose, spec=spec,
             status=status, standin=standin, file=file, prompt=prompt)
    )


SECTIONS = {
    "style": (
        "Style frames: choose the direction first",
        "Generate these three before anything else. They show the same moment (the "
        "army marching on a Han palisade at dusk, the sisters and the drum behind it) under "
        "three different treatments of the paper, so the treatment can be judged on its own. "
        "Pick one, or a mix, and the palette and the prompts below are tuned to it before the "
        "full set is generated. The game's first stand-ins sat closest to S02; "
        "screenshots of it are in `design/screens/`.",
    ),
    "mood": (
        "Inspiration and atmosphere",
        "Direction pieces, not game assets. They fix the look, the light and the emotional "
        "range before production art is made, and every later request should agree with them. "
        "Save delivered pieces to `design/references/` under the file names given.",
    ),
    "world": (
        "Backgrounds",
        "One sky per chapter and four parallax strips. The game draws each strip at the full "
        "720-pixel screen height, so composition is given as a fraction of the image height. "
        "The ground line sits at 69% of the height; the band below it holds the drum HUD.",
    ),
    "cast": (
        "Characters and units",
        "In-game cutouts. Lac Viet figures face right (the direction of the march); Han figures "
        "face left. The game scales each sprite to a fixed on-screen height, given in the spec, "
        "and adds the backlit shadow itself.",
    ),
    "rig": (
        "Puppet part sheets",
        "The same figures split into separate pieces so they can be rigged and animated like "
        "shadow puppets. `design/source/build_rigs.py` cuts the sisters' sheets (BD-R01, BD-R02) "
        "into the jointed puppets that beat the drum in the game; the elephant and the spearwoman "
        "are not rigged yet.",
    ),
    "ui": (
        "Interface",
        "The title logo, the drum-face HUD, chapter cards and interface pieces.",
    ),
    "fx": (
        "Effects",
        "Sprite sheets for hits, projectiles and the drum waking, all used by the game (it "
        "falls back to drawing its own if a sheet is missing).",
    ),
    "story": (
        "Story chapters",
        "Art for the six chapters added after the first three: The Oath, Casting the Drums, The "
        "Villages Answer, The Coronation at Mê Linh, Mã Viện Returns and The Drums Are Melted. "
        "Same coloured-paper direction (BD-S02) and the same rules: Lạc Việt face right, Han "
        "face left. Props are drawn at fixed sizes in quiet scenes, so they can carry more cut "
        "detail than the battle sprites.",
    ),
    "practice": (
        "Drum Practice",
        "Art for Drum Practice, chosen from the title screen: free drumming and call and answer "
        "on a village green at dusk. The scene reuses the dusk sky and the parallax strips; the "
        "game draws the fire, the lantern string and the partner drummers (BD-P03). Until these "
        "are delivered the game draws paper-cut stand-ins, so each piece replaces one drawing "
        "and must keep its proportions.",
    ),
    "water": (
        "Water puppets (alternate style)",
        "The alternate look, chosen in Settings, Style: Vietnamese water puppetry (mua roi "
        "nuoc). Each request mirrors one shadow-puppet image (BD-WC01 mirrors BD-C01), at the "
        "same size and composition, so the two swap without touching the layout; give the "
        "generator the delivered shadow-puppet image as a reference where it takes one. The "
        "figures are carved, lacquered wooden puppets that wade in a pond the game draws along "
        "the ground; the scenery is lacquer painting. Generate the style frame (BD-W01) first. "
        "Until a piece arrives the game shows the shadow-puppet image in its place, under the "
        "drawn pond and lacquer grade.",
    ),
}


# ------------------------------------------------------------------ style

SCENE = (
    "A side-on view at dusk of a line of Lac Viet women warriors with spears and feather crowns "
    "marching right across rice paddies towards a Han timber palisade with a watchtower; behind "
    "the women, two sisters in feather crowns beat a bronze drum on a carried palanquin; "
    "limestone karst peaks and areca palms behind; a large low moon ringed by faint concentric "
    "drum rings. Wide 16:9 composition, layered in five depths."
)
req("style", "BD-S01", None, "Style frame A: white paper and lamplight",
    "The closest to hand-cut fibre panels in a gallery: almost no colour; depth and mood come "
    "from light, shadow and the density of the cuts.",
    "3840x2160, opaque", "delivered", None, "references/s01-white-paper.png",
    f"{SCENE} Every layer is cut from white and cream fibre paper; colour comes only from a "
    "warm amber lamp behind the scene and the cool blue shadows each layer casts on the next. "
    "Intricate snowflake-like filigree in the hills, leaves and feathers; a kaleidoscope of light "
    "and shadow. Only accents of colour: the bronze drum and a thin lacquer-red sash on each "
    "woman. Hand-cut paper art, no painterly rendering, no text.")
req("style", "BD-S02", None, "Style frame B: coloured papers, lit from behind",
    "The game's direction: each depth a different coloured sheet, night indigo to rice "
    "cream, with bronze and lacquer-red accents.",
    "3840x2160, opaque", "delivered", None, "references/s02-coloured-papers.png",
    f"{STYLE} {SCENE}")
req("style", "BD-S03", None, "Style frame C: shadow theatre",
    "The boldest read at game size: solid ink silhouettes in front of glowing translucent "
    "coloured paper, like a shadow-puppet screen.",
    "3840x2160, opaque", "delivered", None, "references/s03-shadow-theatre.png",
    f"{SCENE} Every near figure and object is a solid ink-black silhouette with fine cut-out "
    "detail, set in front of a glowing screen of translucent dyed paper that shifts from amber "
    "at the horizon to deep rose and indigo above; the far hills are paler silhouettes printed "
    "on the screen. Like a Southeast Asian shadow-puppet performance lit by oil lamps. "
    "Hand-cut paper art, no painterly rendering, no text.")

# ------------------------------------------------------------------ mood

M = "mood"
req(M, "BD-M01", None, "Key art: the sisters ride to war",
    "The single image the game is sold on. Sets scale, hierarchy and the backlit-diorama look.",
    "3840x2160, opaque", "delivered", None, "references/m01-key-art.png",
    "Key art for a game about the Trung sisters, Vietnam, 40 CE. Trung Trac and Trung Nhi ride a "
    "great war elephant into battle, both in gold armour with tall feathered crowns, beating a "
    "huge bronze drum carried in the howdah between them. Behind them an army of women with "
    "spears, bows and feather headdresses streams across rice paddies; ahead, a Han palisade "
    "citadel under a full moon. Built as a stage of five cut-paper layers, one behind another, lit "
    "from behind so the moon and the cuts glow; every layer casts a soft shadow on the one behind. "
    "The sisters are the brightest, most intricately cut shapes in the frame.")
req(M, "BD-M02", None, "Lightbox study: suspended panels",
    "Defines the game's depth and lighting model: how layers glow, how shadows fall, how much "
    "the cuts carry.",
    "3840x2160, opaque", "delivered", None, "references/m02-suspended-panels.png",
    "Photograph of a gallery installation in a dark room: six large hand-cut white fibre-paper "
    "panels hang from the ceiling one behind another. A single warm lamp behind the last panel "
    "throws their cut patterns as long shadows onto the floor and the near wall. The panels show, "
    "back to front: a full moon ringed with herons, limestone karst peaks, areca palms and bamboo, "
    "stilt houses, rice paddies, and a row of women warriors with feather crowns. Fire-lit, "
    "cave-like atmosphere; the paper fibres visible where the light passes through.")
req(M, "BD-M03", None, "Dong Son motif sheet",
    "A shared vocabulary of cut shapes, translated from the bronze drums, for every artist "
    "and every later request.",
    "3000x3000, opaque cream ground", "delivered", None, "references/m03-dong-son-motifs.png",
    "Reference sheet of cut-paper motifs translated from Dong Son bronze drums, arranged in a grid "
    "on rice-paper cream: the 12-point sun-star at the drum's centre; bands of tangential circles; "
    "zigzag and ladder bands; flying long-beaked herons; feather-crowned dancers and warriors in "
    "profile; long boats with crews; deer; stilt houses with saddle roofs; the small frogs that "
    "sit on drum rims; a drummer pounding paired drums. Each motif cut as a flat ink-black "
    "silhouette with fine interior cuts.")
req(M, "BD-M04", None, "Colour script",
    "The palette's journey through the story, so each chapter has its own light.",
    "4800x1600, opaque, eight panels in two rows", "delivered", None, "references/m04-colour-script.png",
    "A colour script of eight small cut-paper scenes in two rows of four, each a different light: "
    "1 dawn training, rose and bronze; 2 the garden, verdigris and cream; 3 grief, deep indigo with "
    "a single lacquer-red shape; 4 casting the drums, molten bronze and orange; 5 the villages "
    "answer, cream daylight and verdigris; 6 battle on the river, slate grey and lacquer red; 7 "
    "Luy Lau at night, indigo and gold; 8 elegy, ash grey and cream with one bronze shape. Simple "
    "compositions, the colour shift readable at thumbnail size.")
req(M, "BD-M05", None, "The sisters: character study",
    "Fixes the two leads' silhouettes and personalities before the sprites are made.",
    "3000x2000, opaque cream ground", "delivered", None, "references/m05-sisters.png",
    "Character study of two Vietnamese sisters as cut-paper figures, side by side, front view and "
    "side profile each. Trung Trac, the elder: composed and upright, bronze and gold, hair in a "
    "high knot under a crown of tall feathers, holding a drumstick still at her side; her cut "
    "patterns are ordered rings and stars. Trung Nhi, the younger: in motion, lacquer red, flowers "
    "and leaves cut into her sleeves and hair, laughing, drumstick raised; her cut patterns are "
    "vines and birds. Ancient Lac Viet dress, wrapped skirts, bead collars. Dignified, warm, not "
    "sexualised.")
req(M, "BD-M06", None, "The garden at Me Linh",
    "Atmosphere for chapter one: the training years, intimate and green.",
    "3840x2160, opaque", "delivered", None, "references/m06-garden.png",
    "The garden of a Lac Viet lord's house at Me Linh, late afternoon, with a pale moon in the sky. "
    "Nhi sits among lotus and flowering shrubs with birds around her; across the pond, Trac "
    "practises with a spear beside straw training targets. Stilt house with a saddle roof behind. "
    "Cut-paper layers backlit by low sun, verdigris and cream, the leaves cut with fine veins.")
req(M, "BD-M07", None, "Casting the drums",
    "Atmosphere for the uprising's preparation: the metalworkers of Nhat Nam.",
    "3840x2160, opaque", "delivered", None, "references/m07-casting.png",
    "Night in a foundry of the Nhat Nam metalworkers: molten bronze poured from crucibles into "
    "clay drum moulds stamped with the sun-star; women carry the moulds, sparks drawn as tiny cut "
    "holes letting orange light through. Finished bronze drums stacked at the side. Cut-paper "
    "layers, bronze and orange glow against ink black.")
req(M, "BD-M08", None, "The villages answer",
    "The drum as a call: the sound made visible. Direction for the drum-wake effect and the "
    "campaign map.",
    "3840x2160, opaque", "delivered", None, "references/m08-villages-answer.png",
    "Night over the Red River delta seen from above at a low angle. The sound of a great drum "
    "spreads from the centre as concentric cut-paper rings, like the rings on a bronze drum face. "
    "In stilt villages along the river, lanterns light one by one and women come down to long "
    "boats carrying spears. Indigo, cream and bronze.")
req(M, "BD-M09", None, "Battle on the Hat River",
    "Atmosphere for chapter two: daylight battle, shield walls and crossbow volleys.",
    "3840x2160, opaque", "delivered", None, "references/m09-river-battle.png",
    "A battle at a river ford in low daylight. Han crossbowmen in iron-grey lamellar armour stand "
    "on a wooden palisade; a wall of Lac Viet women raises round shields with star patterns cut "
    "through them as a volley of bolts arcs over, drawn as clean cut lines. Reeds and lotus in "
    "the foreground. Slate grey, cream and lacquer red.")
req(M, "BD-M10", None, "Luy Lau at night",
    "Atmosphere for chapter three: the climax.",
    "3840x2160, opaque", "delivered", None, "references/m10-luy-lau.png",
    "The Han citadel of Luy Lau at night under a full moon. War elephants carrying the sisters "
    "and bronze drums break through the gate; gold armour and feather crowns catch the moonlight; "
    "the citadel's watchtowers are cut with lattice windows lit from within. Indigo and gold, "
    "triumphant but heavy.")
req(M, "BD-M11", None, "Elegy: the drums melted",
    "The ending's tone: the victory does not last. Quiet, respectful, no depiction of death.",
    "3840x2160, opaque", "delivered", None, "references/m11-elegy.png",
    "Quiet aftermath. In a Han workshop, captured bronze drums lie stacked by a furnace, about to "
    "be melted down and cast into a bronze horse. Through the open door, the Hat River at dawn "
    "with lotus drifting and herons flying. Ash grey and cream with one warm bronze shape. "
    "Mournful and still.")
req(M, "BD-M12", None, "In-game screen mock-up",
    "Steers the production HUD and checks that the style reads at play size.",
    "1920x1080, opaque", "delivered", None, "references/m12-screen-mockup.png",
    "A 16:9 video game screen in cut-paper style. Side-scrolling battlefield: a line of women "
    "warriors on the left marches right towards Han soldiers and a palisade on the right; "
    "behind the women, two sisters stand on a palanquin with a bronze drum. Bottom centre, a "
    "round bronze drum face with rings, four herons and a central star as the rhythm display. "
    "Bottom left, a small panel listing four drum commands as rows of dots. Top left and top "
    "right, thin strength bars. Plenty of empty space around the interface.")
req(M, "BD-M13", None, "Army of women: costume line-up",
    "The unit types and their silhouettes, readable at small sizes.",
    "4000x2000, opaque cream ground", "delivered", None, "references/m13-army-lineup.png",
    "Costume line-up of a Lac Viet women's army, ancient Vietnam, as flat cut-paper figures in "
    "profile facing right, all at the same scale: spearwoman, archer with a crossbow, shield "
    "bearer with a round star-cut shield, drum bearer, standard bearer, mountain archer with a "
    "longbow. Feather crowns of different heights, wrapped skirts, bead collars, lacquer-red "
    "sashes. Each silhouette distinct.")
req(M, "BD-M14", None, "Han forces: line-up",
    "The opposing side, dignified and specific to the Eastern Han, never caricatured.",
    "4000x2000, opaque cream ground", "delivered", None, "references/m14-han-lineup.png",
    "Line-up of Eastern Han Chinese soldiers, 1st century, as flat cut-paper figures in profile "
    "facing left, at one scale: spearman with a ji halberd, kneeling crossbowman, officer with a "
    "banner, the provincial governor in robes and a scholar's cap. Lamellar armour shown as rows "
    "of small cut slots, iron grey and black. Ordinary, human faces; no caricature.")

# ------------------------------------------------------------------ world

W_ = "world"
for sky, desc, light in [
    ("dawn", "Chapter one, the garden at Me Linh", "a dawn sky: indigo at the top, rose in the middle, warm bronze near the horizon; the sun as a cut 12-point star low on the right with a glowing halo; a few long scalloped paper clouds"),
    ("day", "Chapter two, the Hat River", "a hazy daylight sky: pale verdigris at the top fading to cream at the horizon; the sun as a cut 12-point star at upper right; long scalloped paper clouds"),
    ("night", "Chapter three, Luy Lau", "a night sky: deep indigo, a large full moon at upper right with crater shapes cut out of it, a scatter of small stars, a few long indigo paper clouds"),
]:
    req(W_, f"BD-B0{['dawn','day','night'].index(sky)+1}", f"sky-{sky}", f"Sky: {sky}",
        f"{desc}. The furthest backdrop; everything else is layered over it.",
        "2560x1440, opaque; keep the lower third plain, it is covered by hills",
        "delivered", "Renderer.buildSky", f"art/sky-{sky}.png",
        f"{STYLE} Backdrop of {light}. Sky only, no land.")

req(W_, "BD-B04", "layer-karst", "Far layer: karst peaks",
    "The far hills, moving at 15% of the camera speed.",
    "5120x1440. Peaks between 10% and 60% of the height; the base solid to the bottom edge. " + STRIP,
    "delivered", "Renderer.buildKarst", "art/layer-karst.png",
    f"{STYLE} A long horizontal strip of steep limestone karst peaks with rounded tops, cut from "
    "one sheet of paper in a single muted indigo-violet, with thin mist bands and small flying "
    "herons cut out of it so the light shows through. Flat silhouette, no interior shading.")
req(W_, "BD-B09", "layer-karst-far", "Farthest layer: pale karst peaks",
    "A paler, lower row of peaks behind BD-B04, moving at 7% of the camera speed, so the "
    "hills read in two depths.",
    "5120x1440. Peaks between 25% and 52% of the height; the base solid to the bottom edge. " + STRIP,
    "delivered", "Renderer.buildKarst(far)", "art/layer-karst-far.png",
    f"{STYLE} A long horizontal strip of distant limestone karst peaks with rounded tops, "
    "cut from one pale, misty violet-grey sheet that lets a lot of light through, with a dotted "
    "seam of tiny cut holes following the inside of each peak and thin mist bands cut across.")
req(W_, "BD-B05", "layer-grove", "Middle layer: palms, bamboo, stilt houses",
    "The middle distance, moving at 45% of the camera speed.",
    "5120x1440. Tree bases on a solid band at 63-71% of the height; tallest crowns at about 25%. " + STRIP,
    "delivered", "Renderer.buildGrove", "art/layer-grove.png",
    f"{STYLE} A long horizontal strip of areca palms, clumps of bamboo and stilt houses with "
    "saddle-shaped roofs like those on Dong Son drums, cut from one dark indigo-green sheet; leaf "
    "veins and lattice windows cut out so the light shows through.")
req(W_, "BD-B06", "layer-paddy", "Ground layer: rice paddies",
    "The ground the armies stand on.",
    "5120x1440. Top edge a gentle scalloped line at 69% of the height; solid below, with the water slits kept faint so the HUD reads over it. " + STRIP,
    "delivered", "Renderer.buildPaddy", "art/layer-paddy.png",
    f"{STYLE} A long horizontal strip of flooded rice paddies seen from the side, one dark sheet "
    "with a softly scalloped top edge; rows of thin horizontal slits cut through it suggest water "
    "catching light between rows of rice.")
req(W_, "BD-B07", "layer-reeds", "Foreground layer: reeds and lotus",
    "The nearest layer, in front of the armies, moving at 125% of the camera speed.",
    "5120x1440. Reeds rising from the bottom edge up to about 25% of the height; sparse enough "
    "that most of the bottom stays open. " + STRIP,
    "delivered", "Renderer.buildReeds", "art/layer-reeds.png",
    f"{STYLE} A long horizontal strip of reeds, grasses and lotus pads rising from the bottom "
    "edge, ink-black silhouettes with very fine cut detail, sparse with gaps between clumps.")
req(W_, "BD-B08", "paper-fiber", "Paper fibre texture",
    "Laid over the whole screen at low opacity, so the scene reads as one sheet of paper.",
    "1024x1024, opaque, tileable in both directions",
    "delivered", "fiberTexture", "art/paper-fiber.png",
    "Seamless tileable texture of handmade mulberry rice paper lit from behind: warm cream, long "
    "pale fibres and a few darker flecks, even lighting, no folds, no shadows, no objects.")

# ------------------------------------------------------------------ cast

C = "cast"
req(C, "BD-C01", "sister-trac", "Trung Trac, drumming",
    "The elder sister at the drum: plays the deep centre stroke (tung). Shown 96 px tall.",
    "1024x1536. " + CUTOUT,
    "delivered", "Renderer.sisters", "art/sister-trac.png",
    f"{STYLE} Trung Trac, a Lac Viet noblewoman and war leader, standing in profile facing right, "
    "both hands gripping a long drumstick raised for a strike. Gold armour of small plates over a "
    "wrapped skirt, a tall crown of feathers, hair in a high knot. Composed and upright. Bronze "
    "and ink-black paper, her armour cut with rings and small stars.")
req(C, "BD-C02", "sister-nhi", "Trung Nhi, drumming",
    "The younger sister at the drum: plays the rim stroke (cac) and the off-beat flourishes. "
    "Shown 96 px tall.",
    "1024x1536. " + CUTOUT,
    "delivered", "Renderer.sisters", "art/sister-nhi.png",
    f"{STYLE} Trung Nhi, a young Lac Viet war leader, in profile facing right, mid-swing with a "
    "short drumstick in each hand, body turning with energy. Gold armour over a lacquer-red "
    "wrapped skirt, a crown of feathers with flowers tucked in, vines and birds cut into her "
    "sleeves. Lively and fierce.")
req(C, "BD-C03", "war-elephant", "War elephant with howdah",
    "Chapter three: the sisters ride it with the great drum. The game draws the sisters and "
    "drum on top, so the howdah is empty. Shown 230 px tall.",
    "2048x1536. Empty howdah floor at about 70% of the height above the feet, centred slightly "
    "behind the middle. " + CUTOUT,
    "delivered", "Renderer.elephant", "art/war-elephant.png",
    f"{STYLE} An Asian war elephant walking right in profile, an empty open howdah with a "
    "lacquer-red rail on its back, a caparison cut with concentric rings and a sun-star, tusks "
    "and trunk curled forward. Ink-black paper with red and bronze inlays.")
req(C, "BD-C04", "drum-bearers", "The drum on its palanquin",
    "Chapters one and two: four women carry the bronze drum on a low platform; the sisters "
    "stand on its deck (drawn separately). Shown 150 px tall.",
    "2048x1024. Platform deck at about 35% of the height. " + CUTOUT,
    "delivered", "Renderer.drumCrew", "art/drum-bearers.png",
    f"{STYLE} Four Lac Viet women in feather crowns carry a low wooden palanquin on poles, "
    "walking right; on it sits a large bronze drum, its side banded with rings and its top a "
    "sun-star. The deck is empty apart from the drum. Ink-black figures, a bronze drum.")
req(C, "BD-C14", "drum-palanquin", "The drum palanquin with room for the sisters",
    "Replaces BD-C04 in the battle chapters. The sisters ride with the drum and beat it: the "
    "game draws them separately (Trưng Trắc as a jointed puppet, Trưng Nhị as a cut-out, each "
    "about half the palanquin's height) standing on the deck at the two ends, so their arms can "
    "move on every stroke. BD-C04's deck is filled by the drum, so they had nowhere to stand and "
    "read as floating; until this arrives they walk on the ground beside the bearers. Shown "
    "190 px tall; the bearers walk, so keep their legs in a mid stride.",
    "2400x1200, transparent. The deck's top is one straight, level line at exactly 42% of the "
    "height measured up from the bottom edge (58% down from the top), spanning the middle 80% of "
    "the width. The drum sits on the deck in the middle third. Two empty standing places on the "
    "deck, centred at 22% and 78% of the width and each about 16% wide, with nothing drawn above "
    "the deck there (no railing taller than 3% of the height, no canopy, no posts). Four bearers "
    "carry the poles on their shoulders, the poles just under the deck, their feet on the bottom "
    "edge. " + CUTOUT.replace("Single cut-paper figure, side profile, full body", "One cut-paper group, side profile, full bodies"),
    "delivered", "Renderer.drumCrew (the sisters walk beside BD-C04)", "art/drum-palanquin.png",
    f"{STYLE} A long, low ceremonial wooden palanquin carried on two poles by four Lac Viet "
    "women in feather crowns, walking right, the poles on their shoulders. On its flat deck, in "
    "the middle, a large Dong Son bronze drum banded with rings, its top a sun-star. The two ends "
    "of the deck are empty and level, room for two people to stand and drum. The deck's edge is "
    "carved with a band of herons and boats in cut detail. Ink-black bearers and wood, a warm "
    "bronze drum.")
req(C, "BD-C11", "drummer-chau", "Companion drummer: the barrel drum",
    "Walks with the drum crew, just in front of the palanquin. When the shields go up she "
    "strikes her drum and the game shakes the whole figure. Shown 88 px tall, so keep the "
    "shapes bold.",
    "1024x1536. " + CUTOUT,
    "delivered", "Renderer.companions", "art/drummer-chau.png",
    f"{STYLE} A Lac Viet woman drummer walking in profile facing right, a trống chầu slung at "
    "her hip on a strap: a small barrel drum lacquered red with a bronze band, its pale "
    "buffalo-hide head facing forward. Her right hand raises a wooden beater with a red tip. "
    "Short feather crown, wrapped skirt, a lacquer-red sash. Ink-black silhouette with fine cut "
    "details in the feathers.")
req(C, "BD-C12", "drummer-mo", "Companion drummer: the mõ",
    "Walks beside the barrel drummer. When the rhythm is reset she knocks her mõ and the game "
    "shakes the whole figure. Shown 84 px tall.",
    "1024x1536. " + CUTOUT,
    "delivered", "Renderer.companions", "art/drummer-mo.png",
    f"{STYLE} A Lac Viet woman walking in profile facing right, holding out a mõ in her left "
    "hand: a small round wooden slit drum of dark polished wood with a long slit cut across its "
    "front. Her right hand lifts a short wooden mallet. Short feather crown, wrapped skirt, a "
    "lacquer-red sash. Ink-black silhouette with the mõ in warm brown, fine cut details in the "
    "feathers.")
req(C, "BD-C05", "unit-spear", "Spearwoman",
    "The front line. Shown 92 px tall; the game bobs, levels and tilts it for march and strike.",
    "1024x1536. Spear held upright. " + CUTOUT,
    "delivered", "Renderer.warrior", "art/unit-spear.png",
    f"{STYLE} A Lac Viet woman warrior in profile facing right, holding a long bronze-headed "
    "spear upright, a feather crown fanning backwards, wrapped skirt, a lacquer-red sash. "
    "Ink-black silhouette with fine cut details in the feathers.")
req(C, "BD-C06", "unit-archer", "Archer",
    "The back line. Shown 92 px tall.",
    "1024x1536. " + CUTOUT,
    "delivered", "Renderer.warrior", "art/unit-archer.png",
    f"{STYLE} A Lac Viet woman archer in profile facing right, drawing a bow, a short feather "
    "crown, quiver on her back, a lacquer-red sash. Ink-black silhouette with fine cut details.")
# The Garden at Mê Linh's lesson in blocking: village children run in and
# pelt the women with stones; A raises their forearms in front of their faces.
req(C, "BD-C15", "children-sheet", "Village children throwing stones",
    "The first chapter's last lesson, blocking: once the targets are down two children run in from the right, stop a little "
    "way ahead of the women and lob small stones at them until the player blocks, then run off "
    "the way they came (the game flips them). The game draws the stones. Shown 74 px tall, so "
    "keep the shapes bold and the poses easy to read.",
    "1536x1024, transparent; a grid of 4 columns (poses) by 2 rows (children), 384x512 cells, "
    "each child standing on the bottom of its cell, facing LEFT, centred. Columns: 1 running, "
    "one leg forward; 2 running, the other leg forward; 3 one arm drawn far back with a stone "
    "in the hand; 4 the throw, arm flung forward, hand open. Row 1 a boy with a shaved head and "
    "a topknot, in a loincloth; row 2 a girl with her hair in two short tufts, in a wrapped "
    "skirt. Same scale in every cell. " + CUTOUT.replace("Single cut-paper figure, side profile, full body, feet on the bottom edge, centred, ", ""),
    "delivered", "Renderer.child (drawn children)", "art/children-sheet.png",
    f"{STYLE} A sprite sheet of two cheeky Lạc Việt village children, about seven years old, "
    "in profile facing left, on a grid of 4 columns by 2 rows: row 1 a barefoot boy with a "
    "shaved head and a little topknot, in a loincloth; row 2 a barefoot girl with two short "
    "tufts of hair, in a wrapped skirt with a lacquer-red sash. Columns: running with one leg "
    "forward; running with the other leg forward; winding up with one arm drawn far back, a "
    "small stone in the hand; the throw, arm flung forward, hand open. Ink-black silhouettes "
    "with fine cut details, mischievous rather than menacing.")
for rid, asset, who, base, what in [
    ("BD-C16", "unit-spear-cover", "Spearwoman", "BD-C05",
     "her spear held upright in her right hand, her left forearm raised across her face, "
     "elbow out, head ducked behind it"),
    ("BD-C17", "unit-archer-cover", "Archer", "BD-C06",
     "her bow lowered in her left hand, her right forearm raised across her face, elbow out, "
     "head ducked behind it"),
]:
    req(C, rid, asset, f"{who} covering her face",
        f"The {who.lower()} of {base} flinching from the children's stones in the first chapter: "
        "shown in place of her usual figure for a moment when a stone gets past the shields. Shown 92 px tall, "
        f"the same size and stance as {base}, so the two can swap without a jump.",
        "1024x1536. " + CUTOUT,
        "delivered", "Renderer.warrior (a drawn forearm)", f"art/{asset}.png",
        f"{STYLE} The same Lac Viet woman as {base}, in profile facing right, standing as in "
        f"{base} but flinching from thrown stones: {what}. Feather crown, wrapped skirt, a "
        "lacquer-red sash. Ink-black silhouette with fine cut details in the feathers.")
req(C, "BD-C07", "han-spear", "Han spearman",
    "Advances and attacks at close range. Shown 96 px tall.",
    "1024x1536. Faces left. " + CUTOUT,
    "delivered", "Renderer.hanSoldier", "art/han-spear.png",
    f"{STYLE} An Eastern Han Chinese soldier, 1st century, in profile facing left, holding a ji "
    "halberd upright, lamellar armour shown as rows of small cut slots, a soft cap. Iron grey "
    "and dark grey paper. An ordinary soldier, no caricature.")
req(C, "BD-C08", "han-crossbow", "Han crossbowman",
    "Fires a bolt every measure from range. Shown 96 px tall.",
    "1024x1536. Faces left. " + CUTOUT,
    "delivered", "Renderer.hanSoldier", "art/han-crossbow.png",
    f"{STYLE} An Eastern Han Chinese crossbowman, 1st century, kneeling in profile facing left, "
    "aiming a bronze-triggered crossbow, lamellar armour as rows of small cut slots. Iron grey "
    "and dark grey paper, no caricature.")
req(C, "BD-C09", "fort-palisade", "Han palisade fort",
    "The goal of chapters two and three. Shown 300 px tall; the game tears pieces out as it "
    "takes damage.",
    "2048x2048. Gate on the left side, facing the army. " + CUTOUT.replace("figure, side profile, full body, feet", "structure, side view, base"),
    "delivered", "Renderer.fort", "art/fort-palisade.png",
    f"{STYLE} A Han frontier fort seen from the side: a wall of pointed timber stakes, a gate on "
    "the left, a two-storey watchtower with a tiled roof and a pennant, lattice windows cut "
    "through. Dark iron-grey paper.")
req(C, "BD-C10", "straw-target", "Straw training target",
    "Chapter one's goal. Shown 110 px tall.",
    "1024x1024. " + CUTOUT.replace("figure, side profile, full body, feet", "object, side view, base"),
    "delivered", "Renderer.target", "art/straw-target.png",
    f"{STYLE} A straw training dummy on a wooden post with a crossbar, bound with rope in three "
    "places. Straw-coloured paper with ink-black post and ropes.")

# ------------------------------------------------------------------ rig

R = "rig"
for rid, asset, who, parts in [
    ("BD-R01", "rig-sister-trac", "Trung Trac", "head with crown, torso, upper and lower arms, hands with drumstick, skirt, legs"),
    ("BD-R02", "rig-sister-nhi", "Trung Nhi", "head with crown, torso, upper and lower arms, two hands with drumsticks, skirt, legs"),
    ("BD-R03", "rig-war-elephant", "the war elephant", "head, ear, trunk in three segments, body with howdah, four legs in two segments, tail"),
    ("BD-R04", "rig-unit-spear", "the spearwoman", "head with crown, torso, arms, spear, skirt, legs"),
]:
    req(R, rid, asset, f"Part sheet: {who}",
        f"Separate pieces of {who} for puppet rigging.",
        "4096x4096, transparent; pieces laid out apart with space between, each with a little "
        "overlap at the joints",
        "delivered", None, f"art/{asset}.png",
        f"{STYLE} A sheet of separate cut-paper puppet parts for {who}, matching the in-game "
        f"figure: {parts}. Each piece is whole and flat, laid out with space between, joints "
        "rounded so they overlap when assembled.")

# ------------------------------------------------------------------ ui

U_ = "ui"
req(U_, "BD-U01", "logo", "Title logo",
    "Replaces the typeset title on the title screen. Must read at small sizes.",
    "2048x1024, transparent",
    "delivered", "#logo-text (CSS)", "art/logo.png",
    "Game title logo in hand-cut paper: the words \"BRONZE DRUM\" in large, readable, slightly "
    "irregular cut letters in rice-paper cream, set over a bronze drum's sun-star and rings cut "
    "in bronze, with \"TRỐNG ĐỒNG\" in small spaced capitals above (keep the Vietnamese "
    "diacritics exact). Backlit glow, a soft cast shadow. Transparent background.")
req(U_, "BD-U02", "hud-drum", "HUD: the drum face",
    "The rhythm display at the bottom of the screen. The game lights four herons and the star "
    "over it, so keep those areas simple.",
    "1024x1024, transparent outside the circle",
    "delivered", "Renderer.hud", "art/hud-drum.png",
    "Top-down view of a Dong Son bronze drum face as a flat bronze paper cut-out disc: a "
    "12-point sun-star at the centre, then bands of rings, tangential circles and zigzags, a "
    "plain ring at 80% of the radius where four herons will be overlaid, and a beaded rim. "
    "Bronze with darker bronze cut lines, even light, perfectly circular.")
req(U_, "BD-U03", "ui-glyphs", "Drum and command glyphs",
    "Icons for the two strokes and the five commands, for the HUD and the instructions.",
    "2048x512, transparent; seven icons in a row on a 256 px grid",
    "delivered", None, "art/ui-glyphs.png",
    "A row of seven cut-paper icons on a transparent background: 1 a solid bronze disc (the "
    "centre stroke, tung); 2 a lacquer-red ring with a dot (the rim stroke, cac); 3 a foot "
    "stepping forward (march); 4 a spearhead (strike); 5 a round shield with a star (shields); 6 a "
    "raised hand with feathers (rally); 7 an elephant head (charge). Simple, bold, readable at "
    "32 pixels.")
req(U_, "BD-U04", "ui-panel", "Dialog panel",
    "The paper sheet behind the pause menu and the other dialogs, nine-sliced so the cut "
    "border keeps its shape at any size.",
    "1536x1024, transparent outside the sheet",
    "delivered", "CSS .panel (plain paper)", "art/ui-panel.png",
    "A sheet of cream rice paper with a hand-cut decorative border: a band of tangential circles "
    "and small herons cut through near the edge, corners cut with a sun-star. Plain centre for "
    "text. Even light, soft fibres.")
req(U_, "BD-U05", "ui-icons", "Utility icons",
    "Instructions, Settings and Fullscreen buttons.",
    "768x256, transparent; three icons on a 256 px grid",
    "delivered", None, "art/ui-icons.png",
    "Three cut-paper icons in rice-paper cream on a transparent background: an open scroll "
    "(instructions), a bronze drum seen from above with a small gear cut in it (settings), four "
    "corner brackets (fullscreen). Bold and simple, readable at 26 pixels.")
# The close-up sticks: the sisters' forearms and drumsticks seen from the
# player's place behind the drum, swinging onto the HUD drum on each stroke.
STICK_SPEC = ("1024x1024, transparent (or flat magenta #FF00FF, keyed out). One forearm and stick "
              "on the diagonal: the forearm leaves the image at the {corner} corner, cut off clean "
              "by the edge; the wrist sits at {wrist}; the centre of the stick's striking head sits "
              "at {head}. The game turns it about the wrist and lands the head on the drum, so keep "
              "those three points where they are given.")
req(U_, "BD-U20", "hud-stick-trac", "Close-up stick: Trắc's beater (the centre)",
    "Over the HUD drum, Trưng Trắc's forearm and beater swing in from the bottom left and "
    "land on the sun-star at the centre on every deep stroke (tùng), then lift away. Drawn "
    "about 1.8 times the drum's radius from wrist to head: about 105 px over the desktop "
    "drum, 180 px over the big touch drum.",
    STICK_SPEC.format(corner="bottom-left", wrist="22% across and 78% down",
                      head="80% across and 20% down"),
    "delivered", "Renderer.standinStick", "art/hud-stick-trac.png",
    f"{STYLE} A close-up of one woman's forearm and hand gripping a heavy wooden drum beater, "
    "seen from just behind her shoulder, matching Trưng Trắc's puppet (BD-R01): cream skin, a "
    "wide cuff of bronze and gold bands cut with dots and diamonds at the wrist, the edge of a "
    "black and bronze sleeve where the forearm leaves the image at the bottom-left corner. The "
    "beater is a stout dark wooden shaft with a flat round padded head wrapped in bronze-brown "
    "cloth, pointing to the upper right. Cut paper with crisp edges, lit from behind, a soft "
    "glow along the rim. No drum, nothing else in the image.")
req(U_, "BD-U21", "hud-stick-nhi", "Close-up stick: Nhị's stick (the rim)",
    "Over the HUD drum, Trưng Nhị's forearm and stick swing in from the right and strike the "
    "rim on every high stroke (cắc), then lift away. Drawn at the same size as BD-U20.",
    STICK_SPEC.format(corner="bottom-right", wrist="78% across and 78% down",
                      head="20% across and 20% down"),
    "delivered", "Renderer.standinStick", "art/hud-stick-nhi.png",
    f"{STYLE} A close-up of one woman's forearm and hand gripping a slender wooden drumstick, "
    "seen from just behind her shoulder, matching Trưng Nhị's puppet (BD-R02): cream skin, a "
    "brown and gold cuff cut with a row of cream diamonds at the wrist, a lacquer-red sleeve "
    "cut with white leaves where the forearm leaves the image at the bottom-right corner. The "
    "stick is a thin dark wooden rod ending in a small round polished wooden knob, pointing to "
    "the upper left. Cut paper with crisp edges, lit from behind, a soft glow along the rim. "
    "No drum, nothing else in the image.")
# Alternatives to BD-U20 and BD-U21, with the same wrist and head positions so
# any can stand in for either: to choose between, or to vary by chapter.
for rid, asset, who, corner, wrist, head, what in [
    ("BD-U22", "hud-stick-trac-pestle", "Trắc", "bottom-left", "22% across and 78% down", "80% across and 20% down",
     "a long plain wooden pole like a rice pestle, thick and smooth with a rounded blunt end, the "
     "way drummers on the Đông Sơn drum friezes strike their drums"),
    ("BD-U23", "hud-stick-trac-lacquer", "Trắc", "bottom-left", "22% across and 78% down", "80% across and 20% down",
     "a ceremonial beater with a lacquer-red shaft banded in gold, and a round head wrapped in "
     "cream cloth tied with red cord"),
    ("BD-U24", "hud-stick-nhi-bamboo", "Nhị", "bottom-right", "78% across and 78% down", "20% across and 20% down",
     "a slim stick of pale split bamboo with its nodes showing, the tip bound with a few turns of "
     "red thread"),
    ("BD-U25", "hud-stick-nhi-horn", "Nhị", "bottom-right", "78% across and 78% down", "20% across and 20% down",
     "a dark hardwood stick with a small polished buffalo-horn tip, a tassel of red thread hanging "
     "from the grip"),
]:
    trac = who == "Trắc"
    req(U_, rid, asset, f"Close-up stick, another kind: {who}'s {asset.rsplit('-', 1)[1]}",
        f"An alternative to {'BD-U20' if trac else 'BD-U21'}, drawn and animated the same way: "
        "the player picks a pair under Settings, Drumsticks (Folk: BD-U22 and BD-U24; "
        "Ceremonial: BD-U23 and BD-U25).",
        STICK_SPEC.format(corner=corner, wrist=wrist, head=head),
        "delivered", "Renderer.standinStick", f"art/{asset}.png",
        f"{STYLE} A close-up of one woman's forearm and hand gripping a drumstick, seen from just "
        f"behind her shoulder, matching Trưng {'Trắc' if trac else 'Nhị'}'s puppet "
        f"({'BD-R01' if trac else 'BD-R02'}): cream skin, "
        + ("a wide cuff of bronze and gold bands at the wrist, the edge of a black and bronze sleeve "
           if trac else "a brown and gold cuff cut with cream diamonds at the wrist, a lacquer-red "
           "sleeve cut with white leaves ")
        + f"where the forearm leaves the image at the {corner} corner. The stick is {what}, "
        f"pointing to the upper {'right' if trac else 'left'}. Cut paper with crisp edges, lit from "
        "behind, a soft glow along the rim. No drum, nothing else in the image.")
req(U_, "BD-U16", "touch-buttons", "Touch buttons: the companion drums",
    "On phones and tablets the game draws on-screen buttons beside the big touch drum, made "
    "as the instruments that accompany a bronze drum in a temple or village hall. The shield "
    "is a trống chầu barrel drum (bottom right, drawn about 150 px across). Reset is a mõ "
    "wooden slit drum (next to it, about 75 px). Pause is a small plain disc at the top. The "
    "game adds the glow, the press animation and the labels, so draw each one at rest with "
    "nothing written on it.",
    "768x256, transparent; three pieces on a 256 px grid, each centred and filling about 90% "
    "of its cell",
    "delivered", "Renderer.chauDrum / moDrum", "art/touch-buttons.png",
    f"{STYLE} Three cut-paper objects in a row on a transparent background, each centred in "
    "its third. 1: a trống chầu, a Vietnamese barrel drum with a buffalo-hide head, seen from "
    "the front and a little above so the round cream hide head fills most of the piece. The "
    "head has a red painted disc with a small sun-star at its centre and a ring of bronze tacks "
    "round its edge. The barrel below is lacquered red with a bronze band, and a wooden beater "
    "with a red tip rests across the top right. 2: a mõ, a round wooden slit drum from a "
    "pagoda, squat and a little wider than tall, in dark polished brown wood. A long curved "
    "slit is cut across its front like a mouth, and it sits on a small red cushion with a "
    "short wooden mallet leaning on it. 3: a plain round disc of dark indigo paper with a "
    "beaded bronze rim and two upright cream bars cut in the middle (pause). Flat even light, "
    "soft shadow under each, bold shapes that read at 48 pixels.")
for i, (cid, name, scene) in enumerate([
    ("garden", "The Garden at Me Linh", "two sisters practising with drumsticks beside a lotus pond and straw targets in a lord's garden, dawn"),
    ("outpost", "The Outpost on the Hat River", "women warriors with shields advancing on a Han timber outpost across a river ford, daylight"),
    ("luylau", "The Citadel at Luy Lau", "the sisters on a war elephant with a bronze drum before a walled citadel under a full moon"),
]):
    req(U_, f"BD-U0{6+i}", f"card-{cid}", f"Chapter card: {name}",
        "Background of the chapter-select card; the game lays a pale wash over it for text.",
        "1600x900, opaque; keep the left half quiet for text",
        "delivered", "buildCards (plain paper)", f"art/card-{cid}.png",
        f"{STYLE} A wide cut-paper vignette: {scene}. Main shapes on the right half, the left half "
        "mostly open sky or water.")

# ------------------------------------------------------------------ fx

F = "fx"
req(F, "BD-F01", "fx-scraps", "Paper scraps sheet",
    "Hits and defeats burst into torn scraps of paper instead of blood.",
    "2048x512, transparent; sixteen scraps on a 128 px grid",
    "delivered", "Renderer.scraps", "art/fx-scraps.png",
    "Sixteen small torn and cut paper scraps on a transparent background, in cream, lacquer red, "
    "iron grey and straw: triangles, curls, leaf shapes, feather fragments. Each with a fibrous "
    "torn edge on one side and a clean knife cut on the other.")
req(F, "BD-F02", "fx-projectiles", "Arrows and bolts",
    "Lac Viet arrows and Han crossbow bolts.",
    "1024x256, transparent; four pieces in a row",
    "delivered", "Renderer.drawParticles", "art/fx-projectiles.png",
    "Four cut-paper projectiles in a row on a transparent background, all pointing right: a Lac "
    "Viet arrow with a bronze head and feather fletching, the same arrow in flight with a motion "
    "cut, a short Han crossbow bolt in iron grey, the same bolt with a motion cut.")
req(F, "BD-F03", "fx-drum-wake", "The drum wakes",
    "Plays when four commands chain: the drum's rings spread outward like the call in BD-M08.",
    "2048x2048, transparent; one ring pattern, radially symmetric",
    "delivered", "Renderer.wakeBurst", "art/fx-drum-wake.png",
    "A radially symmetric burst of concentric cut-paper rings in bronze and gold on a transparent "
    "background, like the bands of a bronze drum face expanding outward: tangential circles, "
    "flying herons and a sun-star at the centre. Bright glow through the cuts.")



# ------------------------------------------------------------------ story chapters

ST = "story"
for sky, name, chapters, light in [
    ("dusk", "dusk", "The Oath and Mã Viện Returns",
     "a dusk sky: violet at the top, dusty rose in the middle, a large low sun as a cut 12-point "
     "star sinking at the right, long scalloped paper clouds edged with light"),
    ("foundry", "the foundry", "Casting the Drums",
     "a night sky over a foundry: near-black at the top, deep red-brown haze near the horizon "
     "lit orange from below by furnaces, embers cut as tiny holes drifting up, no moon"),
    ("ash", "ash dawn", "The Drums Are Melted",
     "a quiet dawn: ash grey at the top fading to warm cream at the horizon, a pale hazy sun, "
     "thin streaks of cloud, a few herons far away"),
]:
    req(ST, f"BD-B1{['dusk', 'foundry', 'ash'].index(sky)}", f"sky-{sky}", f"Sky: {name}",
        f"{chapters}. The furthest backdrop, like BD-B01 to BD-B03.",
        "2560x1440, opaque; keep the lower third plain, it is covered by hills",
        "delivered", "Renderer.buildSky", f"art/sky-{sky}.png",
        f"{STYLE} Backdrop of {light}. Sky only, no land.")

for i, (cid, name, scene) in enumerate([
    ("oath", "The Oath", "two sisters kneeling before their father's memorial altar at dusk, incense smoke rising, a mourning drum beside them"),
    ("casting", "Casting the Drums", "metalworkers pouring glowing bronze from a crucible into drum moulds in a night foundry"),
    ("villages", "The Villages Answer", "stilt villages along a river at night, lanterns lighting one after another, a drummer on a jetty"),
    ("coronation", "The Coronation at Mê Linh", "two queens crowned before a palace gate at Mê Linh, festival drummers, lantern strings and banners"),
    ("mavien", "Mã Viện Returns", "a Han general on horseback leading dense columns of soldiers to a river ford at dusk, Lạc Việt shields across the water"),
    ("elegy", "The Drums Are Melted", "bronze drums lined up beside a furnace at grey dawn, a river and drifting lotus beyond"),
]):
    req(ST, f"BD-U{10 + i}", f"card-{cid}", f"Chapter card: {name}",
        "Background band of the chapter-select card.",
        "1600x900, opaque; the band is cropped from the middle, so keep the subject central",
        "delivered", "buildCards (plain paper)", f"art/card-{cid}.png",
        f"{STYLE} A wide cut-paper vignette: {scene}.")

PROP = (
    "Single cut-paper object, side view, standing on the bottom edge, centred, transparent "
    "background (PNG with alpha). If transparency is not possible, use a flat pure magenta "
    "#FF00FF background with nothing else on it and no cast shadow."
)
for rid, asset, title, purpose, spec, prompt in [
    ("BD-P01", "prop-altar", "Memorial altar", "The Oath: the father's altar; the game adds the incense sticks and smoke. Shown 170 px tall.",
     "1024x1024. " + PROP,
     "A Lạc Việt ancestral altar: a low dark wooden table with carved legs, a tall memorial "
     "tablet with a rounded top standing on it, its inscription cut through so light shows, a "
     "bronze bowl for incense in front, offerings of fruit. Ink black and bronze."),
    ("BD-P02", "prop-mourning-drummer", "Mourning drummer", "The Oath: the caller, striking a funeral drum on a stand. Shown 160 px tall; the game bobs it on each stroke.",
     "1536x1024, the drummer on the left facing right towards the drum. " + PROP,
     "An old Lạc Việt man in mourning white robes and a plain headband beating a large dark "
     "drum on a wooden stand with one long stick, solemn. Ink black with cream robes."),
    ("BD-P03", "prop-festival-drummers", "Festival drummers", "The Coronation: the callers on a small stage. Shown 170 px tall.",
     "1536x1024. " + PROP,
     "Two joyful Lạc Việt drummers, a woman and a man in festival dress with feather crowns, "
     "beating a big lacquer-red drum on a carved stand hung with tassels and streamers."),
    ("BD-P04", "prop-village-house", "River village house", "The Villages Answer: one per village; the game hangs two lanterns from the eaves and lights them. Shown 130 px tall.",
     "1024x1024. " + PROP,
     "A Lạc Việt stilt house on a riverbank with a saddle-shaped roof like those on Dong Son "
     "drums, a ladder, woven walls with lattice windows cut through, a small jetty. Dark "
     "indigo-green paper, unlit."),
    ("BD-P05", "prop-lantern", "Lit paper lantern", "A lit lantern, hung from the village houses once a village answers. Shown 26 px tall.",
     "256x384. " + PROP,
     "A round paper lantern glowing warm orange from inside, cut with a small sun-star, a red "
     "tassel below, a short cord above."),
    ("BD-P06", "prop-bronze-drum", "Bronze drum (standing)", "The Drums Are Melted: five stand in a row; the game greys out each as it falls silent. Shown 90 px tall.",
     "1024x1024. " + PROP,
     "A Dong Son bronze kettle drum seen from the side, slightly from above: a flat top with "
     "the sun-star and rings, a bulging upper body, a waist and a flared foot, bands of herons "
     "and boats in relief, four small handles, warm bronze."),
    ("BD-P07", "prop-furnace", "Furnace and crucible", "Casting the Drums: the furnace the bronze is poured from. Shown 190 px tall.",
     "1024x1024. " + PROP,
     "An ancient clay foundry furnace with an arched mouth glowing orange, a clay crucible of "
     "molten bronze held above it on a wooden frame, sparks cut as small holes. Dark clay, "
     "orange glow."),
    ("BD-P08", "prop-mould", "Drum mould", "Casting the Drums: an empty clay mould; the game fills it with glowing bronze, pour by pour. Shown 100 px tall.",
     "1024x1024. " + PROP,
     "A tall clay casting mould for a bronze drum, bound with rope, the sun-star pattern "
     "stamped on its lid, a pouring cup at the top. Earthy brown clay."),
    ("BD-P09", "prop-drum-cast", "Freshly cast drum", "Casting the Drums: shown once a mould is full. Shown 100 px tall.",
     "1024x1024. " + PROP,
     "A freshly cast bronze kettle drum still glowing faintly orange at the edges, clay mould "
     "pieces broken away around its foot, the sun-star crisp on its top."),
]:
    req(ST, rid, asset, title, purpose, spec, "delivered", "Renderer.scene", f"art/{asset}.png",
        f"{STYLE} {prompt}")

req(ST, "BD-P10", "han-general", "Mã Viện on horseback",
    "Mã Viện Returns: the Han general watching from the rear of his columns, always near the "
    "right edge of the screen. Shown 180 px tall, slightly faded behind the field.",
    "1536x1536. Faces left. " + CUTOUT.replace("figure, side profile, full body, feet", "figure on horseback, side profile, hooves"),
    "delivered", "Renderer.general", "art/han-general.png",
    f"{STYLE} The Eastern Han general Mã Viện, 1st century, an old but upright commander on a "
    "dark warhorse in profile facing left, lamellar armour cut as rows of small slots, a "
    "crested helmet with a red plume, one hand raised to signal the advance, a long red "
    "banner on a pole behind him. Iron grey, black and lacquer red. Dignified and formidable, "
    "not caricatured.")

for rid, title, purpose, file, prompt in [
    ("BD-M15", "The Oath: the father's funeral",
     "Atmosphere for The Oath: grief turning into resolve.", "references/m15-oath.png",
     "At dusk in a lord's house at Mê Linh, two young sisters in white mourning clothes kneel "
     "before their father's memorial altar; incense smoke rises in cut-paper curls; an old "
     "drummer beats a funeral drum; the elder sister's face is set and the younger's fierce. "
     "Violet and rose light, one lacquer-red shape."),
    ("BD-M16", "The coronation at Mê Linh",
     "Atmosphere for The Coronation: the high point before the fall.", "references/m16-coronation.png",
     "Trưng Trắc and Trưng Nhị crowned queens before the palace gate of Mê Linh, a festival "
     "crowd of women and men with feather crowns, drummers on a stage, strings of glowing "
     "lanterns and banners, herons overhead. Day light, cream, bronze and lacquer red, joyful."),
    ("BD-M17", "Mã Viện at the ford",
     "Atmosphere for Mã Viện Returns: the overwhelming army and the last stand.", "references/m17-mavien.png",
     "At dusk, the Han general Mã Viện on a horse at the head of dense columns of soldiers "
     "with halberds and crossbows coming down to a wide river ford; on the near bank a thin "
     "line of Lạc Việt women raises star-cut shields. Grave, red-violet sky, iron grey and "
     "lacquer red. The Han are dignified, not caricatured."),
]:
    req(ST, rid, None, title, purpose, "3840x2160, opaque", "delivered", None, file, f"{STYLE} {prompt}")

# ------------------------------------------------------------------ drum practice

PR = "practice"
for rid, cid, name, scene in [
    ("BD-U17", "practice-free", "Free drumming",
     "feather-crowned Lạc Việt dancers circling a fire on a village green at dusk, a bronze drum "
     "beside them, a communal house with a sweeping saddle roof behind, lanterns overhead"),
    ("BD-U18", "practice-call", "Call and answer",
     "two drummers facing each other across a fire, one at a bronze drum and one at a lacquer-red "
     "festival drum, trading rhythms while villagers watch, dusk"),
]:
    req(PR, rid, f"card-{cid}", f"Practice card: {name}",
        "Background band of the card on the Drum Practice screen.",
        "1600x900, opaque; the band is cropped from the middle, so keep the subject central",
        "delivered", "buildPracticeCards (plain paper)", f"art/card-{cid}.png",
        f"{STYLE} A wide cut-paper vignette: {scene}.")
req(PR, "BD-U26", "card-practice-training", "Practice card: Training",
    "Background band of the Training card on the Drum Practice screen (a third card beside "
    "Free drumming and Call and answer), where the player practises the game's rhythms level "
    "by level.",
    "1600x900, opaque; the band is cropped from the middle, so keep the subject central",
    "delivered", "buildPracticeCards (plain paper)", "art/card-practice-training.png",
    f"{STYLE} A wide cut-paper vignette: an old drum master and a young feather-crowned "
    "drummer kneeling at a bronze drum in a courtyard at dusk, the master's stick raised to "
    "show a stroke while the student watches, a row of smaller drums and wooden beaters laid "
    "out in order along a low lacquer-red bench behind them, lanterns overhead.")
req(PR, "BD-P11", "prop-dinh", "The communal house (đình)",
    "The back of the practice green: a village communal house, dim against the dusk sky, its "
    "lattice lit from inside. Shown 230 px tall, centred about two thirds of the way across the "
    "screen; the fire and the dancers stand in front of it.",
    "2048x1024. " + PROP,
    "delivered", "Renderer.dinh", "art/prop-dinh.png",
    f"{STYLE} A Lạc Việt communal house (đình) seen from the side: a long low hall raised on "
    "wooden stilts, under a huge saddle-shaped roof whose two ends sweep up like a boat's prow, "
    "as on the houses of the Đông Sơn drums. Woven walls with rows of lattice windows cut "
    "through so warm light shows. Dark indigo-violet paper, a single sheet.")
req(PR, "BD-C13", "dancer-sheet", "Dancers: three poses each",
    "The dancers who gather as the player drums: four figures, each in three poses the game "
    "switches between on every stroke it hears (at rest or walking; a stamp on the deep stroke "
    "with both arms thrown up; a hop on the rim stroke with one wrist flicked out). The game "
    "flips them to face the fire, bobs and tilts them. Shown 96 px tall, so keep the shapes "
    "bold.",
    "1536x2048, transparent; a grid of 3 columns (poses) by 4 rows (dancers), 512x512 cells, "
    "each figure standing on the bottom of its cell, facing right, centred. Rows: a woman with "
    "a tall feather crown; a man in a loincloth with a feather crown; a woman holding two "
    "feathers; a man with a small hand drum. Same scale in every cell. " + CUTOUT,
    "delivered", "Renderer.dancer", "art/dancer-sheet.png",
    f"{STYLE} A sprite sheet of feather-crowned Lạc Việt dancers like the figures on the face "
    "of a Đông Sơn bronze drum, in profile facing right, on a grid of 3 columns by 4 rows. "
    "Each row is one dancer, each column a pose: 1 standing at rest, arms low; 2 stamping, knees "
    "bent, both arms thrown up high; 3 hopping on one foot, one wrist flicked out to the side. "
    "Row 1 a woman with a tall feather crown and a wrapped skirt; row 2 a man in a loincloth "
    "with a feather crown; row 3 a woman holding a long feather in each hand; row 4 a man "
    "with a small hand drum. Ink-black silhouettes with lacquer-red sashes and fine cut "
    "details in the feathers.")
req(PR, "BD-U19", "kit-faces", "Practice kits: drum faces",
    "In Drum Practice the player can swap the bronze drum for another pair of instruments. The "
    "big HUD drum (and the kit button on touch screens) shows the kit's face, seen from above "
    "and drawn as a disc: its centre is the deep stroke, its rim the high one. The game adds "
    "the glow and the flash on each stroke.",
    "1536x256, transparent; six discs on a 256 px grid, each centred and filling about 94% of "
    "its cell, in this order: bronze drum (not used; the game has BD-U02), barrel drum and mõ, "
    "rice drum, gongs, bamboo, lion-dance drum and cymbals",
    "delivered", "Renderer.kitFace", "art/kit-faces.png",
    f"{STYLE} Six round instrument faces in a row, seen straight from above, each a flat disc: "
    "1 a Đông Sơn bronze drum's tympanum with a sun-star and rings of herons; 2 the cream "
    "buffalo-hide head of a trống chầu with a red centre disc and a ring of bronze tacks, a "
    "small dark wooden mõ resting at its edge; 3 the pale hide head of a trống cơm rice drum "
    "with a round darker patch of rice paste in its centre and a brown wooden rim; 4 a flat "
    "bronze gong with concentric rings and a raised polished boss; 5 a round mat with five "
    "green bamboo tubes of a đàn t'rưng laid side by side, shortest to longest; 6 the cream "
    "head of a lion-dance drum with a lacquer-red rim and a gold ring, a small brass cymbal "
    "at its edge. Bold shapes that read at 100 pixels.")

# ------------------------------------------------------------------ water puppets

# The alternate style (Settings, Style): Vietnamese water puppetry. Every
# image above that carries the shadow-puppet look gets a water-puppet twin,
# BD-W + its own id (BD-C01 -> BD-WC01), game id wp- + its own (sister-trac ->
# wp-sister-trac). In the water style the game loads the twin when it is
# delivered and falls back to the shadow-puppet image until then.

WT = "water"

WATER_STYLE = (
    "Vietnamese water puppetry (mua roi nuoc) of the Red River delta, played on a village pond "
    "in front of a water pavilion. The figures are puppets carved from light fig wood and "
    "finished in glossy traditional lacquer: vermilion, black, ochre yellow and jade green, with "
    "gold and silver leaf. Naive, rounded carved faces with painted arched eyebrows, rosy "
    "cheeks and calm smiles; chunky simplified limbs with visible round pegs at the joints; a "
    "wet sheen on the lacquer. Scenery is painted in the style of Vietnamese lacquer painting "
    "(son mai): deep black and brown-red grounds, layered vermilion, gold and silver leaf, "
    "crushed eggshell for the whites, polished to a soft gloss. Motifs from Dong Son bronze "
    "drums (a 12-point sun-star, concentric rings, flying herons, feather-crowned figures, long "
    "boats, stilt houses with saddle roofs) and northern Vietnamese plants (areca palms, bamboo, "
    "lotus, rice). Folk, joyful and ceremonial, lit from the front by warm lanterns. Palette: "
    "black lacquer, vermilion, cinnabar red, gold leaf, ochre yellow, eggshell cream, jade green "
    "and deep green-brown pond water. No paper cut-outs, no silhouettes, no backlight, no "
    "photorealism, no 3D render look, no text, no watermark."
)

WATER_CUTOUT = (
    "Single carved and lacquered wooden puppet, side profile, full body, feet on the bottom "
    "edge, centred, transparent background (PNG with alpha). If transparency is not possible, "
    "use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow. The "
    "game draws the pond's surface over the feet and shins, so the figure seems to wade."
)

TRANSLATE = (
    "Carry the subject over into water-puppet form: where the description mentions paper, cut "
    "holes, cut details, silhouettes or light through the cuts, use carved wood, lacquer "
    "colours, painted patterns and gold or silver leaf instead."
)

# Base request -> a subject that replaces its own (for pieces whose subject is the paper itself).
WATER_SUBJECTS = {
    "BD-B08": (
        "Seamless tileable texture of a polished lacquer surface: deep black-brown with a soft "
        "gloss, very faint gold-leaf flecks and a few hairline crackles of eggshell, even "
        "lighting, no objects. It is laid thinly over the whole screen, so keep it quiet."),
    "BD-U04": (
        "A lacquered wooden panel: a black lacquer field framed by a carved vermilion border of "
        "tangential circles and small herons picked out in gold leaf, a sun-star in each corner. "
        "Plain centre for text. Soft gloss, even light."),
    "BD-F01": (
        "Sixteen small water splashes and flying wood chips on a transparent background: "
        "crowns of spray, single droplets, a ring of ripples seen from the side, small chips of "
        "vermilion and black lacquered wood, a lotus petal. Bright, clear water edged with "
        "light; each piece centred in its cell."),
    "BD-F02": (
        "Four carved wooden projectiles in a row on a transparent background, all pointing "
        "right, lacquered like puppet props: a Lac Viet arrow with a gold-leaf head and red "
        "fletching, the same arrow with a short trail of droplets, a short Han crossbow bolt in "
        "iron-grey lacquer, the same bolt with a trail of droplets."),
    "BD-F03": (
        "A radially symmetric burst of water rising from the pond, seen from above: concentric "
        "rings of ripples and spray in gold and jade, flying herons in gold leaf circling a "
        "sun-star at the centre, like the bands of a bronze drum face. Bright and joyful."),
    "BD-P11": (
        "A Lac Viet communal house (dinh) seen from the side with its water pavilion (thuy dinh) "
        "standing in the pond in front: the long low hall on wooden stilts under a huge "
        "saddle-shaped roof whose two ends sweep up like a boat's prow; before it, the small "
        "pavilion on posts in the water, its curved tiled roof, its front hung with a bamboo "
        "screen behind which the puppeteers stand. The pavilion is the point of the picture: draw "
        "it clearly, in front of the hall's right half, its roof reaching about half the hall's "
        "height, its posts standing in a strip of pond water along the bottom edge. Black "
        "lacquer, vermilion pillars, gold leaf."),
}

# Titles and purposes for the pieces whose subject changes with the medium.
WATER_TITLES = {
    "BD-B08": ("Lacquer texture", "Laid thinly over the whole screen in place of the paper fibre."),
    "BD-U04": ("Lacquer panel", "The panel behind menus and dialogs."),
    "BD-F01": ("Splashes and wood chips sheet", "Hits and defeats burst into splashes and chips of lacquered wood."),
    "BD-F02": ("Projectiles sheet", "Arrows and crossbow bolts in flight."),
    "BD-F03": ("Burst from the pond (the drum waking)", "The burst when the drum's spirit wakes."),
    "BD-P11": ("Communal house and water pavilion", "Drum Practice's backdrop: the village's communal house with its water pavilion in the pond."),
}

# Water figures delivered as recoloured cut-paper (traced from the shadow
# sprites: flat, with cut-out holes) instead of carved puppets like the style
# frame's. Regenerated with PUPPET below; the delivered take stays in the game
# until then.
TRACED = "The first take traced the shadow-puppet sprite: a flat cut-paper figure in lacquer colours, not a carved wooden puppet like those of the style frame BD-W01."
REDO = {rid: TRACED for rid in (
    "BD-C01", "BD-C02", "BD-C14", "BD-C11", "BD-C12", "BD-C05", "BD-C06", "BD-C15", "BD-C16",
    "BD-C17", "BD-C07", "BD-C08", "BD-P02", "BD-P03", "BD-P10", "BD-C13", "BD-R01", "BD-R02")}
REDO["BD-P11"] = "The first take is the communal house alone, recoloured: the water pavilion in the pond in front of it, which the prompt asks for, is missing."

# Accepted replacements retain the revised direction and prompt, but no longer
# appear as open regeneration requests. The delivery record preserves provenance.
REGENERATIONS_FILE = ROOT / "design" / "image-regenerations-water-puppets.json"
WATER_REGENERATED = {
    r["id"] for r in json.loads(REGENERATIONS_FILE.read_text()).get("images", [])
    if r.get("accepted")
} if REGENERATIONS_FILE.exists() else set()

PUPPET = (
    "Match the puppets of the water-puppet style frame BD-W01 "
    "(bronzedrum/design/references/w01-water-puppet-frame.png; give it to the generator as the "
    "style reference): each figure a carved wooden doll with a large round head, a smooth glossy "
    "face painted pale with rosy cheeks, arched black brows and a small calm smile, carved hair "
    "and headdress, a sturdy body and rounded limbs with visible round joint pegs at the "
    "shoulders, elbows and hips, the costume carved in low relief and painted in glossy lacquer "
    "with gold-leaf trim, warm highlights on the wet lacquer. From the shadow-puppet image take "
    "only the pose, the facing and the framing; do not copy its flat cut-paper patterns, its "
    "cut-out holes or its silhouette look."
)

# Every image with the shadow-puppet look, in the order of the list above.
WATER_BASES = [
    "BD-B01", "BD-B02", "BD-B03", "BD-B09", "BD-B04", "BD-B05", "BD-B06", "BD-B07", "BD-B08",
    "BD-B10", "BD-B11", "BD-B12",
    "BD-C01", "BD-C02", "BD-C03", "BD-C04", "BD-C14", "BD-C11", "BD-C12", "BD-C05", "BD-C06",
    "BD-C15", "BD-C16", "BD-C17", "BD-C07", "BD-C08", "BD-C09", "BD-C10",
    "BD-R01", "BD-R02",
    "BD-U04", "BD-U06", "BD-U07", "BD-U08", "BD-U10", "BD-U11", "BD-U12", "BD-U13", "BD-U14",
    "BD-U15", "BD-U17", "BD-U18", "BD-U26",
    "BD-F01", "BD-F02", "BD-F03",
    "BD-P01", "BD-P02", "BD-P03", "BD-P04", "BD-P05", "BD-P06", "BD-P07", "BD-P08", "BD-P09",
    "BD-P10", "BD-P11", "BD-C13",
]

req(WT, "BD-W01", None, "Style frame: water puppets",
    "Generate this first. The same moment as the style frames BD-S01 to BD-S03 (the army "
    "marching on a Han palisade at dusk, the sisters and the drum behind it), staged as a "
    "water-puppet show, to settle the look before the rest of this section.",
    "2560x1440, opaque",
    "delivered", None, "references/w01-water-puppet-frame.png",
    f"{WATER_STYLE} A water-puppet performance at dusk seen from the audience's bank: across "
    "the pond, lacquered wooden puppets of feather-crowned Lac Viet women with spears and bows "
    "wade through the water towards a Han wooden palisade on the right, behind them a palanquin "
    "puppet carrying a bronze drum with two puppet sisters striking it. Behind the pond a "
    "small water pavilion with a curved tiled roof and a bamboo screen, painted lacquer scenery "
    "of karst peaks and areca palms, red lanterns strung above, gold reflections and ripples on "
    "the water.")
req(WT, "BD-W02", "wp-water", "The pond's surface",
    "Water style only: the pond the puppets wade in, drawn as a band along the ground line over "
    "their feet and shins, scrolling with the nearest layer. Until it arrives the game draws "
    "the water itself.",
    "4096x512, opaque, seamless horizontally: the left and right edges must join with no "
    "visible seam. The top edge is the water line, seen almost edge-on.",
    "delivered", "Renderer.pond (drawn water)", "art/wp-water.png",
    f"{WATER_STYLE} A long seamless strip of pond water seen almost edge-on from the audience's "
    "bank: deep green-brown water with gold and vermilion lantern reflections broken into "
    "horizontal ripples, a few floating lotus leaves, a bright thin highlight along the water "
    "line at the top edge. No figures, no shore.")

_BY_ID = {r["id"]: r for r in REQUESTS}
for base_id in WATER_BASES:
    b = _BY_ID[base_id]
    rid = "BD-W" + base_id.removeprefix("BD-")
    asset = "wp-" + b["asset"]
    spec = b["spec"].replace(CUTOUT, WATER_CUTOUT).replace("cut-paper", "carved and lacquered wooden")
    redo = REDO.get(base_id)
    if redo and base_id in ("BD-R01", "BD-R02"):
        spec = spec.rstrip(".") + f". Lay the pieces out exactly as on the first water take (art/{asset}.png): every piece at the same place and about the same size, so the rig's measured cuts still fit."
    elif redo and base_id == "BD-P11":
        spec = spec.rstrip(".") + f". Keep the size and the ground line of the shadow-puppet version ({b['file']}), but not its composition: the water pavilion stands in front of the hall."
    elif redo and base_id not in WATER_SUBJECTS:
        spec = spec.rstrip(".") + f". Keep the pose, facing, framing and size of the shadow-puppet version ({b['file']}) so the two swap in the game, but not its look: see the prompt."
    else:
        spec = spec.rstrip(".") + f". Keep the composition, pose, proportions and framing of the shadow-puppet version ({b['file']}), so the two swap in the game; give it to the generator as a reference image if it takes one."
    if base_id in WATER_SUBJECTS:
        prompt = f"{WATER_STYLE} {WATER_SUBJECTS[base_id]}"
    else:
        subject = b["prompt"].replace(STYLE, "").strip()
        prompt = f"{WATER_STYLE} {PUPPET if redo else TRANSLATE} {subject}"
    title, purpose = WATER_TITLES.get(base_id, (b["title"], b["purpose"]))
    req(WT, rid, asset, f"Water puppets: {title}",
        f"The water-puppet version of {base_id}, shown in its place when Settings, Style is "
        f"Water puppets. {purpose}",
        spec, "regenerate" if redo and rid not in WATER_REGENERATED else "delivered", b["standin"] and f"{b['asset']} (the shadow-puppet image)", f"art/{asset}.png", prompt)
    REQUESTS[-1]["base"] = b["asset"]
    if redo and rid not in WATER_REGENERATED:
        REQUESTS[-1]["redo"] = redo

# ------------------------------------------------------------------ output

STATUS_TEXT = {
    "stand-in": "stand-in in the game",
    "planned": "planned, not loaded yet",
    "reference": "reference only",
    "delivered": "delivered",
    "regenerate": "delivered; regenerate (the game keeps the current file until the new one arrives)",
}


def build_doc() -> str:
    out = []
    out.append("# Bronze Drum: image requests\n")
    out.append(
        "Artwork for the Bronze Drum game in `bronzedrum/game/`, plus direction pieces for the "
        "look and atmosphere. Generated from `source/build_requests.py`; edit the data there and "
        "rerun it, which also rewrites `game/assets/manifest.json`.\n")
    out.append("## How to use this list\n")
    out.append(
        "1. Generate the three **style frames** (BD-S01 to BD-S03) first and choose a direction; "
        "the rest of the list is tuned to that choice before it is generated in full.\n"
        "2. Then the **inspiration and atmosphere** pieces (BD-M01 to BD-M14). They fix the "
        "look; when a later asset disagrees with them, the direction pieces win.\n"
        "3. Each prompt is complete on its own: paste it as it stands. The shared style text is "
        "already included in every prompt that needs it.\n"
        "4. Save each image under the file name in its **File** line and drop it in "
        "`bronzedrum/intake/` (or straight into `bronzedrum/game/assets/` and "
        "`bronzedrum/design/`). On integration the request's status flips to `delivered` and "
        "the game loads the file in place of its procedural stand-in.\n"
        "5. The **water puppets** section (BD-W01 onwards) is an alternate look for the whole "
        "game, chosen in Settings, Style. Start with its style frame, BD-W01.\n"
        "6. Cutouts need transparency. If the generator cannot produce alpha, use a flat pure "
        "magenta `#FF00FF` background as the prompts say; it is keyed out on integration.\n")
    out.append("## Art direction\n")
    out.append(
        "The game is staged as a **backlit paper-cut theatre**. Every element is a flat silhouette "
        "cut from paper, layered in depth and lit from behind: light glows through the cuts, and "
        "each layer throws a soft shadow onto the one behind it. The aim is the feeling of standing "
        "in a dark room among hanging hand-cut panels, with fire-lit, cave-like shadows.\n")
    out.append(
        "This direction is inspired by **Sarah Nguyen**'s hand-cut paper and fibre panels: "
        "suspended, backlit, built on folklore, plants, animals and a changing moon, often "
        "about women's stories. The prompts describe those *qualities* rather than naming her, "
        "so the generated art borrows the approach without copying her pieces. If she takes part "
        "in the project, her own work replaces these direction pieces.\n")
    out.append(
        "The second source is the **Dong Son bronze drum** (Lac Viet, before and around the "
        "Trung sisters' time). Its face is already a flat, concentric, stylised frieze of "
        "herons, feather-crowned figures, boats and stilt houses around a sun-star, so it "
        "translates naturally into cut paper. The drum face also serves as the HUD and, "
        "later, as the campaign map.\n")
    out.append("**Rules for every piece**\n")
    out.append(
        "- Flat colour fields. The only gradient is the glow of the backlight.\n"
        "- Silhouettes read first. Faces and armour are carried by cut holes, not by painted "
        "detail.\n"
        "- Lac Viet figures face right, Han figures face left.\n"
        "- The Han are people, not monsters: specific Eastern Han kit (ji halberds, crossbows, "
        "lamellar armour), ordinary faces.\n"
        "- Vietnamese names keep their diacritics wherever text appears (Trưng Trắc, Trưng Nhị, "
        "Mê Linh, Luy Lâu, Hát). The prompts are written without them so generators parse them "
        "cleanly; anything with lettering, like the logo, spells them exactly.\n"
        "- No gore. Hits burst into paper scraps.\n")
    out.append("**Palette** (the same values as `game/src/palette.js`)\n")
    out.append("| Name | Hex |\n| --- | --- |")
    for k, v in PALETTE.items():
        out.append(f"| {k} | `{v}` |")
    out.append("")
    out.append("## Summary\n")
    out.append("| Section | Requests | Stand-in | Planned | Reference | Delivered | Regenerate |")
    out.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    totals = [0, 0, 0, 0, 0, 0]
    for key, (title, _) in SECTIONS.items():
        rows = [r for r in REQUESTS if r["section"] == key]
        counts = [len(rows)] + [sum(r["status"] == s for r in rows) for s in ("stand-in", "planned", "reference", "delivered", "regenerate")]
        totals = [a + b for a, b in zip(totals, counts)]
        out.append(f"| {title} | " + " | ".join(str(c) for c in counts) + " |")
    out.append("| **total** | " + " | ".join(f"**{c}**" for c in totals) + " |")
    out.append("")
    for key, (title, intro) in SECTIONS.items():
        rows = [r for r in REQUESTS if r["section"] == key]
        out.append(f"## {title} ({len(rows)})\n")
        out.append(intro + "\n")
        for r in rows:
            out.append(f"### {r['id']} · {r['title']}\n")
            out.append(r["purpose"] + "\n")
            out.append(f"- **Spec:** {r['spec']}")
            status = STATUS_TEXT[r["status"]]
            if r["standin"]:
                status += f" · **Stand-in:** `{r['standin']}`"
            if r["asset"]:
                status += f" · **Game id:** `{r['asset']}`"
            out.append(f"- **Status:** {status}")
            if r.get("redo"):
                out.append(f"- **Regenerate because:** {r['redo']}")
            where = "bronzedrum/design/" if not r["asset"] else "bronzedrum/game/assets/"
            out.append(f"- **File:** `{where}{r['file']}`")
            out.append(f"- **Prompt:** {r['prompt']}\n")
    return "\n".join(out).rstrip() + "\n"


def build_manifest() -> str:
    assets = []
    for r in REQUESTS:
        if not r["asset"]:
            continue
        entry = {"id": r["asset"], "request": r["id"], "file": r["file"], "status": r["status"],
                 "section": r["section"], "runtime": bool(r["standin"])}
        if r.get("base"):
            entry["base"] = r["base"]  # the shadow-puppet image this water-puppet one replaces
        # The game loads the web copy made by build_web_art.py, not the master.
        if entry["runtime"] and (ROOT / "game" / "assets" / "web" / f"{r['asset']}.webp").exists():
            entry["web"] = f"web/{r['asset']}.webp"
        assets.append(entry)
    return json.dumps({"generatedBy": "bronzedrum/design/source/build_requests.py", "assets": assets}, indent=2, ensure_ascii=False) + "\n"


def validate() -> None:
    ids = [r["id"] for r in REQUESTS]
    assert len(ids) == len(set(ids)), "duplicate request id"
    assets = [r["asset"] for r in REQUESTS if r["asset"]]
    assert len(assets) == len(set(assets)), "duplicate game id"
    for r in REQUESTS:
        assert r["status"] in STATUS_TEXT, r["id"]
        assert r["section"] in SECTIONS, r["id"]
        if r["status"] == "stand-in":
            assert r["asset"] and r["standin"], f"{r['id']}: a stand-in needs a game id and a stand-in"
        if r["status"] in ("delivered", "regenerate"):
            base = ROOT / "game" / "assets" if r["asset"] else ROOT / "design"
            assert (base / r["file"]).exists(), f"{r['id']}: delivered file missing"


def main() -> int:
    validate()
    outputs = {DOC: build_doc(), MANIFEST: build_manifest()}
    if "--check" in sys.argv:
        stale = [p for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
        for p in stale:
            print(f"out of date: {p.relative_to(ROOT.parent)} (run build_requests.py)")
        return 1 if stale else 0
    for p, text in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        print(f"wrote {p.relative_to(ROOT.parent)}")
    print(f"{len(REQUESTS)} requests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
