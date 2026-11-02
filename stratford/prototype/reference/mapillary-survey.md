# Mapillary facade survey (November 2026)

What the street-level photos on Mapillary show of downtown Stratford's
building fronts, recorded per building in `game/data/facades.json` for the
town code to model each front like the real one. Check the file with
`python3 stratford/prototype/tools/town/check_facades.py`.

Street-level imagery © Mapillary contributors (CC BY-SA 4.0). Main
contributors of the frames used: **sun00** (about 325 frames, 2016–2021,
bike- and car-mounted), **joshuazelek** (9 frames, 2019) and **treestryder**
(8 frames, 2025). Each entry's `photos` lists the Mapillary image ids, so any
of them can be opened at `https://www.mapillary.com/app/?pKey=<id>`.

## How it was done

1. **Fronts.** Every `town.json` building whose `street` is Ontario, Downie,
   Wellington, Albert, York or Erie Street or Market Place, with its centroid
   inside x −450..450, z −450..300 (171 buildings, "core"). At the owner's
   request, the residential streets north of downtown were added: Elizabeth,
   Waterloo Street North/South, Britannia, James, Mornington, William and
   Lakeside Drive, inside x −300..500, z −820..−300 (204 buildings, "res").
   Princess and Rankin Streets, and the north ends of Downie and Erie, have
   no buildings tagged with that street in `town.json`, so they could not be
   selected. Landmarks: every City Hall edge over 8 m, the Courthouse and the
   Avon Theatre fronts, plus wider frames of all three and of Market Square.
2. **Candidate frames** from the local index of 13,731 images: camera 8–40 m
   from the front edge's midpoint, on the street side of it, with the
   direction to the midpoint within 35° of the compass angle. Scored by
   heading error, how square-on the view is, distance and recency; the best
   from each direction along the street were kept. The Graph API's
   `computed_geometry`/`computed_compass_angle` and camera focal length then
   re-checked each candidate and placed the front's two ends in the frame.
3. **Contact sheets** showed, for each building, crops of up to three frames
   with green/magenta marks where the front's ends should fall. Each was read
   by eye; only what was visible was recorded, and fronts that were hidden,
   blurred or only seen edge-on were left out. Where frames disagreed (the
   marks fell on a neighbour, or the two frames showed different buildings),
   the entry says so and its `confidence` is lowered.
4. Thumbnails (1024 px) were downloaded to `local/stratford-mly/frames/`
   (ignored by Git); nothing from Mapillary is stored in the repository except
   image ids and the survey's own words.

`confidence` is roughly: 0.7+ clear square-on view, attribution certain;
0.5–0.65 good oblique view; 0.35–0.45 partial view or attribution among
narrow fronts uncertain; 0.2–0.3 only a glimpse (colour/material only).

## Coverage

| Street | Set | Fronts in scope | Recorded | Recorded with confidence ≥ 0.4 | Mean confidence |
| --- | --- | --- | --- | --- | --- |
| Ontario Street | core | 35 | 34 | 22 | 0.44 |
| Downie Street | core | 33 | 27 | 16 | 0.41 |
| Wellington Street | core | 39 | 28 | 21 | 0.45 |
| Market Place | core | 9 | 6 | 3 | 0.37 |
| Albert Street | core | 22 | 11 | 9 | 0.45 |
| York Street | core | 15 | 1 | 1 | 0.70 |
| Erie Street | core | 18 | 12 | 7 | 0.46 |
| Britannia Street | res | 18 | 16 | 13 | 0.61 |
| Mornington Street | res | 47 | 23 | 16 | 0.47 |
| Waterloo Street North | res | 8 | 7 | 5 | 0.51 |
| Waterloo Street South | res | 2 | 1 | 1 | 0.60 |
| Elizabeth Street | res | 59 | 2 | 2 | 0.47 |
| William Street | res | 60 | 4 | 1 | 0.35 |
| James Street | res | 9 | 1 | 0 | 0.30 |
| Lakeside Drive | res | 1 | 0 | 0 | – |

Downtown: 119 of 171 fronts recorded (70 %), 79 with confidence ≥ 0.4.
Residential: 54 of 204 recorded. Plus the Courthouse, the Avon Theatre and
City Hall entries, and notes for Market Square and four landmarks
(175 building entries in all).

Why fronts are missing:

- **York Street** has no usable street-level frames: the only photos near it
  are 2025 close-ups of street objects (EV chargers, plaques). Only the
  riverside boathouse kiosk could be recorded.
- **Narrow downtown fronts** (5–7 m) on Ontario, Downie and Wellington were
  mostly seen from a bike riding along the street, so the front is oblique
  and, between near-identical neighbours, the attribution is uncertain. Upper
  floors are often out of frame; those entries record only the storefront.
- **Southern Wellington Street** and parts of **Albert Street** were only
  photographed looking along the street, with the fronts edge-on far ahead.
- **Elizabeth, William and James Streets** are covered by summer frames
  from one car sequence in which street trees hide almost every house; the
  remaining William and Elizabeth sheets showed only edge-on or tree-covered
  views and were not recorded. Britannia, Waterloo North and the middle of
  Mornington have good square-on frames.
- **Market Place** fronts were photographed in 2017 across the square with
  construction fencing in places; three of nine are good.

## What the photos show that differs from `town.json`

- **Storeys vs height.** Many downtown fronts are three storeys where
  `town.json` has a 3.5–5 m, one- or one-and-a-half-level building: the
  Bentley/Ontario Street blocks (w1470456086, w1470456093, w1470456083),
  the Downie Street Italianate (w1462606512), the Wellington Street red brick
  row (w1491094219, w1491094232), the Parlour Inn (w351986015), the Albert
  Street townhouses (w1491997098, w345580583), the four-storey Ontario Street
  block (w1024040073, 3.5 m) and a four-storey William Street apartment block
  (w1496825607, 7 m). These look like footprints whose LiDAR height came from
  a low rear part; the checker lists them as warnings. A few are the other
  way: the big box store (w283422256) and the Wellington Street hydro office
  (w240409734) are one storey where `town.json` says two.
- **Material.** Of 171 entries with a material, 113 differ from
  `town.json`'s guess. Most often red and buff brick are swapped (25 buff →
  red, 22 red → buff), and many residential "clapboard" houses are brick
  (and vice versa). Notable: the Courthouse is buff brick (data: brick_red);
  Knox Presbyterian is dark red brick (data: stone); the Erie Street civic
  block (w369911353) is buff brick (data: stone); the Wellington Street
  hall (w286688354) is buff brick with a gabled roof (data: red brick, flat);
  the Ontario/Erie corner (w1470455731) is ochre render, three storeys (data:
  two-storey red brick); Zion Lutheran (w68829327) is cream ribbed precast
  and red brick (data: stone). Several fronts are painted: white
  (w1024040084, w1470456088, w1462606517), sage green with charcoal trim
  (w1462606790), olive green (w1462606521), cream (w1462606512), black
  (w1462606513).
- **Roofs.** Several "flat" or "gabled" roofs are otherwise in the photos;
  houses now carry a `roof` field (`gable_front`, `cross_gable`, `hipped` …).
- **Missing or extra buildings.** No street front without a footprint was noticed in the frames read (this was not checked systematically).
  Some footprints are outbuildings (a garage on Mornington, w1431061576) or
  stand behind a garden wall (w1431061573), and a fuel station footprint
  (w455529163) shows only its canopy.

## Against the current landmark models (`game/src/town/landmarks.js`)

- **City Hall.** The rock-faced grey limestone basement reads as a full
  storey (about 3–3.5 m on the Wellington Street side), taller than the
  2.2 m plinth. The two ends are full-height rounded/polygonal bays of red
  brick under conical slate roofs, not small turrets standing at the
  corners. The front's wide flight of steps rises to a round-arched entrance
  under a balcony; dormers and shaped gables have white copings and finials.
  The central tower with its tall dark slate spire and small pinnacles
  matches the model.
- **Courthouse.** Buff walls and the corner tower with a steep dark spire
  match; the photos show strong dark red-brown banding, window surrounds and
  cornice, which plain buff misses. Summer trees and spruces hide much of it.
- **Avon Theatre.** The model adds only a marquee box and a blade sign. The
  Downie Street front is cream stone-slab cladding with deep-set windows, a
  row of roofline brackets and a green-tinted glass-and-metal canopy with
  stairs and rails each side. The George Street side is red brick with a
  band of glass-block windows, an oculus and a glass-block stair tower, and
  a tall grey/beige stage house with fire escapes and a black fly tower
  rises behind.
- **Market Square** (2017 on): pale concrete paving in large panels with
  dark charcoal brick-paver bands, a paver parking lane along Market Place
  with black bollards, tall black lamp posts with hanging baskets, young
  trees in pits and large concrete block seats. No fountain is visible.

## Files

- `game/data/facades.json`: the survey data (schema in the file's header
  fields; houses add `roof` and `roof_colour`).
- `tools/town/check_facades.py`: validates it against `town.json` (ids,
  enumerations, hex colours, storeys vs height); exits 1 on errors.
- Review boards (photo beside the recorded data) were made for the owner
  outside the repository.
