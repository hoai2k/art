# Downtown Stratford, Ontario: written notes for the 3D modeller

## How these notes were made

These are written observations, not images. They were gathered by reading public web pages (heritage designation by-laws and "reasons for designation", Parks Canada and Canadian Register statements of significance, Ontario Heritage Trust records, Doors Open pages, Wikipedia, local-history sites, architecture press) and by looking at the openly licensed photographs already in `reference/stratford/` (cited as `[photo: filename]`). **No copyrighted image was saved to the repository.** Pages were only viewed; any local scratch files (the Ontario Heritage Trust by-law PDFs, which are public records) live in `/home/user/art/local/stratford-notes/` (ignored by Git). **Google Street View, Google Maps imagery and Google Earth were never used.** Requests were few and slow, and one proxy refusal is noted at the end (Dezeen returned 403; it was not worked around). Claims are linked to numbered sources in the list at the end, written as [S12]. Where a source was thin, the note says "guess" or "not confirmed". Numbers marked "est." are eyeballed from photographs or inferred and must not be treated as surveyed.

Coordinates follow `ARCHITECTURE.md`: origin at City Hall's centroid, +X east, -Z north, metres. `town.json` figures quoted below are `base` / `height` / `levels` / `roof` / `material` of the OSM building.

---

## 1. Stratford City Hall (1898-1900)

**Identity.** Designed by Toronto architect George W. King with local architect J. W. Siddall; built 1898-99, opened January 1900; National Historic Site of Canada since 1976 [S1][S2]. Style is deliberately eclectic: Parks Canada lists Classical Revival (columns and moulded cornice at the entrance), Richardsonian Romanesque (rounded entrance arch, conical roofs, smaller gables), Dutch Baroque (gable over the entrance) and a Palladian window on the rear [S1][S2]. Wikipedia and the local history site call it Queen Anne Revival / neo-Jacobean with Flemish Renaissance gables [S3][S4].

**Footprint and site.** Irregular **triangular civic square**; the plan was drawn to exploit that site so there is an interesting face from every angle [S1][S2]. Wikipedia: the two ends of the building have 12-sided (dodecagonal) bases, the middle section is hexagonal, and the clock tower has a circular base [S3] (the hexagonal tower is also stated by [S4]; the photo shows a square-ish brick shaft with a pyramidal spire, so treat "circular/hexagonal" tower base as unresolved, see below). The front (entrance) faces south-west toward the Wellington Street / Market Place corner across a curving walkway and a large flower bed [S3][photo: city_hall_front_symmetric_2025.jpg].

**Storeys and heights.** The photos show three main floors (rusticated stone basement storey, a tall first floor, a second floor under the eaves) with dormer gables and a half-storey of roof. No source gives a numeric height. Estimates from the photograph (est., guess): eaves about 14 m above the plinth base; ridge about 19 m; clock tower top (spire tip, excluding flagpole) about 35 m; flagpole adds about 8 m. **`town.json` says `height` 17.57, `levels` 5.0, base -0.66, roof 'hipped', brick_red.** The 17.57 m is plausible as the roof-ridge height but the tower is not in the data; the tower must be added as a separate element (see priority list). The footprint is a 4-point quad, 38 x 23 m bbox (area 621 m2); the real plan has chamfered, polygonal ends and a projecting central entrance bay, so the quad is a coarse stand-in.

**Walls.** Dark red brick, "chosen after a local brickyard over-fired its white bricks"; the architects had planned buff brick [S3]. Rough-dressed limestone foundation (the plinth reads pale grey, rock-faced, about one storey tall at the front, taller where the ground falls); brown sandstone banding courses running across the facade at sill and lintel level; moulded stone cornices; terra-cotta caps and curved decoration [S1][S2][S5]. Red brick links it visually to the nearby Worth Block and sets it apart from the region's white-brick commercial buildings [S1]. Photo: the brick is a warm brick red with orange-brown mortar-lines, banded with yellowish-buff stone; the eave and gable trim and the finials are painted pale cream/white [photo: city_hall_front_symmetric_2025.jpg].

**Roof.** Slate roof (dark grey in the photo), conical/polygonal turret roofs and smaller gables set along the eaveline; exterior decoration is concentrated at entrance, roof and tower [S1][S2]. Photo: the main roof is a hipped slate mass; the two end pavilions have polygonal "witch-hat" roofs with small ball finials; the front has a ranked row of stepped, shaped (Dutch/Flemish) gables with white-painted copings and finials; chimneys are minor.

**Tower.** Clock tower rises behind the central cross-gable [S3]; it is the focus of the viewscape [S1]. From the photo: a brick shaft rising from the roof ridge with a belt course, a stage with a pair of tall slit windows, a cornice, then a tall slate-clad pyramidal/polygonal spire with a gabled clock face on its south side (blue clock face, white surround), crowned by a slender finial and a flagpole flying the Canadian flag. Proportion (est.): the brick shaft is about 4.5 m wide; the spire is as tall as the shaft above the roof ridge; overall the tower is roughly twice the ridge height above ground.

**Windows.** Above the entrance, three framed windows in the central gable and two inset windows in the gable end [S3]; a semicircular arched window over the door with banded voussoirs [S3]. Elsewhere round-headed and square-headed windows [S4]. Photo: ground floor windows are large single-pane rectangles with stone surround; first floor has paired and tripled tall windows; the second floor has small square windows tucked into dormer gables; one big round-headed stair window at the left end; arched pair in the central gable.

**Entrance.** Double oak doors under a **semicircular rusticated arch**, reached by a wide flight of steps that narrows toward the door, with a central iron handrail and brick cheek walls [S3][S4]. Flanking pilasters carry terracotta seals, one with a train, one with a beehive [S3]. Polished marble columns inside the portal, moulded cornice above [S1]. Above it a white-painted stone balcony/cornice with scrolled Dutch-gable ornaments [photo].

**Furniture at City Hall.** Black iron lamp standards with four globes stand by the steps [S3]; photo shows black posts with clusters of white globes, black-and-slat park benches in the flower bed, hanging flower baskets on poles.

**Where sources disagree.** Tower base: "circular" [S3], "hexagonal" [S4], square-looking in the photo; a modeller can use a square shaft with chamfered corners and a polygonal spire. Original 1856 hall burned in 1898 [S4].

### Priority list (10 details that make it read as City Hall)
1. Tall slate spire on a brick tower, gabled blue clock face, finial and flag.
2. Stepped Dutch-style gables with white copings along the eaves.
3. Polygonal witch-hat turrets with ball finials at the two ends.
4. Strong red brick walls with yellow-buff sandstone bands.
5. Rusticated pale grey stone basement/plinth.
6. Round arch entrance with a wide, narrowing flight of steps and brick cheek walls.
7. White-painted balcony cornice with scrolled ornaments over the portal.
8. Triangular / curved footprint on its wedge-shaped square.
9. Black lamp standards with white globes at the steps, and the crescent flower bed.
10. Slate hipped roof with tall chimney-less outline, many small dormers.

---

## 2. Market Square

**Layout.** City Hall stands on a **triangular civic square** in the heart of the business district [S1]; the square behind it was set aside in 1834, held the first town hall (market house) from 1857 and was the farmers' market [S4]. The open space south of City Hall ("Market Place") was an asphalt parking and market lot for decades, ringed by a continuous wall of 2-3 storey commercial blocks [photo: market_square_open_space_from_south.jpg]. A 2006 competition (PLANT Architect) proposed paving brick and sycamores; in 2015-2017 the city ran a new redesign (RFP 15-09, won by a Janet Rosenberg & Studio scheme): wide bands of **natural stone pavers dissolving into coloured concrete**, flanking concrete seat walls, tree pits, a water feature [S6][S7][S8]. Construction was staged 2017; the staircase and two trees were dropped and rink infrastructure was cut [S8]. I could not find the as-built paving description; treat "stone-paver bands in coloured concrete with tree pits and seat walls" as the best available description, and the old asphalt as the pre-2017 state. Which state the game should show is a design call.

**What surrounds it.** Photo (pre-2017 asphalt state): a row of 2-3 storey blocks with a variety of brick colours: dark red brick, whitewashed/cream, brown with teal-green trim and a pitched pediment, pale green with a small gable, orange-red with Romanesque arched upper windows, and a hipped-roof corner. Street level: dark fascia signbands, striped and flat awnings, hanging flower baskets [photo: market_square_open_space_from_south.jpg]. The north-west side is Wellington Street with the Brandenberger (yellow brick, 1872), Easson (red veneer over earlier mansard, 1872) and Worth (1889) blocks [S9].

### Priority list
1. Wedge shape bounded by streets, not a rectangle.
2. Continuous 2-3 storey frontage in mixed brick colours.
3. Flat open paved floor (asphalt old, paver bands new).
4. Flower bed and benches in front of City Hall.
5. Hanging flower baskets on lamp poles.
6. Cars angle-parked around the edge (old state).
7. Awnings and fascia signbands in the shop fronts.
8. The wall of the Worth Block's pointed centre tower in the corner view.
9. Yellow centre-line and a rainbow crosswalk by City Hall [photo: city_hall_front_symmetric_2025.jpg].
10. Tree pits with small trees.

---

## 3. Perth County Courthouse (1885-1887)

**Identity.** Designed by George F. Durand, built by the Scrimgeour Brothers, opened 9 May 1887 [S10][S11]. High Victorian, mixing Queen Anne and Richardsonian Romanesque [S10][S12]. Stands at the head of Ontario Street (1 Huron Street) on the former Daly property [S13]. The adjoining County Jail (1886) faces St. Andrew Street [S10].

**Footprint and heights.** Mainly rectangular, long axis roughly north-south, with a front tower at the south-west corner [photo]. `town.json`: footprint a clean 4-point rectangle 21 x 40 m (bbox x -242.7..-221.9, z -185.9..-146.0), base -5.24 m, `height` 16.83, `levels` 5.0, hipped, brick_red. Sources: **three storeys** (basement vaults and boilers, first floor offices, second floor courtroom) on a high rusticated stone foundation that absorbs the slope [S10]. **Tower is 115 ft (about 35 m)**, "visible from far up Ontario Street" [S13]; the 16.83 m figure is therefore the main block only and omits the tower; the base -5.24 m is consistent with the sloping site.

**Walls.** Disagreement with `town.json`: it classes the walls `brick_red`, but sources say **white/yellow ("buff") brick with red (Credit Valley) sandstone trim**, a "bichromal" scheme, on limestone foundations from St. Marys [S10][S13][S14]. Photo confirms warm cream-yellow brick with red sandstone and red-brown terracotta trim, and banding in red [photo: perth_county_courthouse_from_street.jpg]. So the main wall colour should be cream-yellow, not red.

**Roof and tower.** Slate roof (re-laid 2014); the tower spire was replaced in 2009 [S10]. Photo: the tower is on the left of the front, three stages of arched windows (paired round-headed windows with red-brick hood arches), a projecting red-stone cornice/balcony stage, then a **slate pyramidal roof with a lower mansard-like skirt, a small gabled dormer with red-framed triangular pediment, and a tall pointed red metal finial**. Main front has a big gabled bay with a row of four arched windows and a red terracotta tympanum, a second smaller gabled bay to the right, a red-capped slim buttress/chimney, and dormer gables with moulded brick chimneys (Queen Anne chimneys) [S10][photo].

**Windows and entrance.** Unusually tall stained-glass and plain windows; doorways have glazed transoms [S10]. Photo: large semicircular-headed double windows on the first-floor main front with banded brick voussoirs; entrance is a dark red-brown door under a pointed arch at the base of the tower, reached by a few steps. A terracotta figure of Justice sits above the main gable [S10]. The main stair has a big stained-glass window with the Canadian coat of arms at the first landing [S13].

**Grounds.** Lawn, a few big trees (a pair of weeping spruce in front, a copper beech to the right), a low planted bed and a wooden/brown sign, black two-head lamp post on the front lawn [photo].

### Priority list
1. Cream-yellow brick with red sandstone/terracotta banding (not plain red brick).
2. Tall corner tower with arched windows and a steep slate pyramid roof.
3. Red finial spike on top of the tower.
4. Large gabled front bay with arched window row and red tympanum.
5. Round-headed double windows with hooded voussoirs on first floor.
6. High rusticated stone base, building stepping down the slope.
7. Moulded chimneys with red caps.
8. Dormer gables in slate roof.
9. Terracotta Justice figure over the gable.
10. Trees and lawn setback; Huron/Ontario Street terminus position.

---

## 4. The Avon Theatre and the Downie Street block

**Avon Theatre.** Opened 1 January 1901 as the Theatre Albert (architect Harry J. Powell), about 1,250 seats originally [S15][S16]. Stratford Festival bought it in 1963; renovated 1964-67 (Pounder Brothers; John C. Parkin's office drew the alterations) which replaced the Downie Street front with a modern one in 1967; DLIA with Marklevitz Architect did a major 2001-02 renovation that added the Studio Theatre [S15][S16][S17]. Address 99 Downie Street. The facade has been changed repeatedly and sources disagree which change produced today's front. A Romeo Creek culvert runs diagonally beneath the building [S16].

**What the front looks like (photo).** A **flat-roofed 3-storey block clad in cream-buff stone slabs**, not brick. Large rectangular window openings in deep reveals, a **curved green/teal copper-coloured glass-and-metal marquee** with a ring of lamps and the lettering "AVON THEATRE", rows of small slatted metal sun-shades/brackets along the roofline, two square notch openings at the parapet, a small glass dome on the roof, two stairs flanking the entrance recess with steel handrails, display cases for posters set in the stone [photo: avon_theatre_front_three_quarter.jpg]. `town.json`: base -2.63, `height` 12.65, `levels` 3.5, flat, material stone, footprint 13 points, bbox 121 x 60 m (this includes the stage house and Studio Theatre behind). Heights fit; the 3.5 "levels" suggests a taller stage house behind. Behind the front, the stage house is a plain brick and timber volume (stagehouse of wall-bearing brick, ceiling about 14 m above stage in 1910) [S16].

**The surrounding Downie block.**
- **Gordon Block, 2-12 Downie St (1893-94):** three-storey red brick corner building at Ontario/Downie/Erie; two corner towers with square hipped (pyramid) slate roofs of different sizes; larger tower has a row of four small round-headed windows; tall ground-floor plate-glass storefronts on a cast-iron frame with slim cast-iron corner columns and a narrow signage frieze; second-floor windows flat-headed, third-floor round-headed; bay windows (some bowed, in pairs and triples); corbelled and fan-work brick roofline; embossed patterned brick panels between dominant brick pilasters; a triangle on the roofline; pressed-metal cornice at the storefront [S18][S19][photo: downie_street_at_ontario_street.jpg].
- **Beamish building (1888) and Festival Square (10 Downie)**, indoor mall on the sites of the Gordon and Idington blocks [S16].
- **Fosters Inn, 105-109 and 111-117 Downie (1906, 1908):** two pairs of three-storey buff brick buildings in simplified Edwardian "stripped classicism": smooth brick faces with subtle pilasters dividing the buildings, understated cornice with modillion blocks and a frieze board, double-hung upper windows with stone lintels and 12-over-1 sashes, brick relieving arches with keystones in soldier and rowlock courses; storefronts altered (stained glass transoms) but with continuous marquee banding [S20][S16].
- **Victoria Hotel, 96-100 Downie (1867):** two-storey brick, Georgian symmetry with a Gothic gable (trefoil) and Italianate brackets, corner of Downie and George [S21].
- **Duggan store, 55-67 Downie (1900):** three storeys with large display windows. **Mooney Biscuit factory, 245 Downie (1903):** five storeys, channelled brick, arched windows with radiating voussoirs [S16].

### Priority list
1. Cream stone-slab facade with deep-set windows.
2. Teal curved marquee with a ring of lamp bulbs.
3. Roofline row of small metal sun-shade brackets.
4. Pair of entrance stairs with steel rails flanking a recessed entrance.
5. Tall brick stage house behind.
6. Gordon Block's two pyramid-capped corner towers.
7. Rows of arched windows in red brick above plate-glass storefronts.
8. Buff brick Fosters Inn with continuous cornice banding.
9. Awnings (striped) on 3-storey buff brick [photo: fosters_inn_striped_awnings.jpg].
10. Overhead traffic lights and pedestrian crosswalk at Downie/Ontario.

---

## 5. The Festival Theatre (1957)

**Identity.** Designed by Robert Fairfield (Rounthwaite & Fairfield, commissioned January 1953) around the thrust stage Tanya Moiseiwitsch and Tyrone Guthrie designed for the 1953 tent [S22][S23]. Intentionally "a building with a roof like a tent" [S24]; Fairfield won the 1958 Massey Medal. Address 55 Queen Street.

**Form.** **Circular drum, about 200 ft (61 m) in diameter, made of 34 bays**, with a foyer ring extending another 40 ft and running 160 ft along the outside wall [S25]. A **folded-plate concrete roof** (the "pie-crust"/fluted crown) rises in a shallow cone to a central peak topped by a **coronet finial and flagpole** [S24][S26]. Photo: the roof is a low grey faceted cone; its fluted edges project as a ring of **triangular gables** (V-shaped eave points) around the perimeter, each end in a point; below, a recessed dark glazed clerestory wall, then a low flat-roofed ring of foyer with a broad deck at its top; the entrance has a wide sweeping flat canopy [photo: festival_theatre_blue_sky_side_view.jpg, festival_theatre_entrance_canopy.jpg]. The crown on top is a ring of upright metal prongs (like a small circular crown) around a short mast with a flag.

**Walls and colours.** Concrete roof panels in light grey; timber-framed window-wall in dark brown; bronze-brown soffits and fascias, warm buff plaster on the entrance wings; tall painted-white square entrance pillars in a row (on the drive side); pennants/banners in yellow, blue and red on poles [S26][photo]. The entry canopy sign reads "FESTIVAL THEATRE" in raised letters; dark red-brown glazed double doors with small mullions [photo: festival_theatre_entrance_canopy.jpg].

**Grounds.** On the north bank of the Avon, overlooking parkland; the Arthur Meighen Gardens (1997) lie at the entrance and the 1997 KPMB addition overlooks the river [S26]. Photo: sloping lawns with mown grass, perennial beds, a garden path to a gazebo, low shrubs, large conifers (spruce or cedar) beside the drive. **Disagreement with `town.json`:** it records `material` 'stone', `height` 14.94, `levels` 4.5, hipped, base -3.1, a 19-point polygon with bbox 90 x 97 m (area 6,353 m2). The sources say a 61 m diameter drum, so a 90 x 97 m footprint includes the 1997 addition and the foyer ring; check the footprint before extruding it. "Stone" is wrong for the roof (concrete) but plausible for the pillars.

### Priority list
1. Round plan with a central cone and a ring of V-shaped gables (the fluted crown).
2. Coronet finial and flagpole at the peak.
3. Flag/pennant poles around the plaza.
4. Wide flat entrance canopy with raised lettering.
5. Dark timber glazed clerestory ring.
6. Row of tall pale square pillars at the drive.
7. Sloped lawns and terraced gardens falling toward the river.
8. Low foyer ring with roof terrace.
9. Large conifers by the drive; mature willow at the water.
10. Warm bronze-brown soffits against the light-grey roof.

---

## 6. The Tom Patterson Theatre (completed 2020, opened 2022)

**Identity.** Hariri Pontarini Architects (Siamak Hariri), replacing the Kiwanis Community Centre at 111 Lakeside Drive on the site of the earlier theatre; one floor, about 7,150 m2; LEED Gold; 2022 Governor General's Medal [S27][S28]. Landscape by Holbrook & Associates / The Planning Partnership: the Ophelia Lazaridis Gardens, tall grasses and drought-resistant plants, a row of cherry trees along the main entrance, a plaza; the site was raised more than 2 m above the road to open river views, a large old maple is preserved [S27][S29].

**Form.** A solid **horseshoe-shaped, drum-like core** (theatre and rehearsal hall) clad in **pale/light brick** (some sources say limestone-pillar framed), wrapped by lobby and lounge spaces behind an **undulating ribbon of glass and bronze** that follows the river curve [S28][S29][S30]. Photo: a long, low, flat-topped building; a curved wall of floor-to-ceiling glass in thin bronze mullions; large cantilevered bronze-clad entrance canopy with the name in raised letters; masonry end walls of grey-brown stone/brick with a slightly rippled texture; a curved concrete bench along the plaza; steel bollards; bare trees in winter [photo: tom_patterson_theatre_front_approach.jpg]. Glass panels reach 6.1 m high and vary in thickness [S29]. Bronze beams stick out of the facade to mark the open-air cafe and timber beams stick through the glass to form cantilevered covered seating [S30]. The entrance canopy is a large double cantilever on one cruciform column [S27].

**Disagreements.** `town.json`: material `glass`, flat, `height` 10.98, `levels` 3.0, base -9.19, 27-point polygon bbox 116 x 63 m (area 4,465 m2). Sources: one floor of 7,150 m2 (so about a 3-storey-tall theatre volume plus single-floor lobby); the brick drum is the dominant volume, not glass. Sources disagree between "pale brick" [S28][S30] and "limestone/stone" [S29]; the photo shows warm grey-brown, so treat it as pale taupe brick with stone piers.

### Priority list
1. Curving wall of full-height glass with thin bronze mullions facing the river.
2. Pale brick drum rising behind the glass.
3. Big cantilevered bronze canopy with raised letters.
4. Stone piers/cheek walls at the entrance.
5. Cantilevered bronze and timber beams poking through the facade at the cafe.
6. Plaza raised above Lakeside Drive.
7. Rows of cherry trees at the entrance and tall grasses.
8. Curved concrete benches.
9. Preserved large maple beside the entrance.
10. Flat roof with no visible roof elements.

---

## 7. Ontario Street between City Hall and the river (block by block)

Orientation: Ontario Street is the main street of Stratford and one of its oldest, longest and widest, originally the Huron Road [S31][S32]. Downtown it runs generally east-west from the Courthouse at Huron Street, past the head of Downie, to Knox church further east. Information below is the best that was found; the exact order of buildings along each block face could not be verified without address maps, so use addresses as anchors and treat the sequence as a guess.

**General character** [photo: ontario_street_looking_downtown.jpg, downtown_red_brick_street_looking_down_slope.jpg]: continuous street walls of 2-3 storey brick, red to brown-red dominant with a few cream/buff and whitewashed fronts; stepped rooflines; a corner turret/pyramid tower at the east end; mixed cornices (corbelled brick, pressed metal, modillion); parallel parking on both sides, three travel lanes, a yellow centre line; black decorative lamps with two lantern heads and hanging planters; metal parking signs ("P" in a green circle on cream); Canadian flags on poles on some facades; sidewalks of pale grey concrete with a curb.

**Known buildings (addresses from [S31][S18][S33][S34]):**
- 1 Ontario St (west end): 1962 modernist bank by Robert Fairfield, flat, sleek, contrasts with the Victorian blocks.
- 70-76 Ontario St: three-storey business block on the site of the Shakespeare Inn; two matching parts built c.1857-c.1900; upper windows 6-over-6 double-hung, slightly rounded tops with raised brick edging and brick quoins; narrow signboard frieze above multi-paned storefronts; a **tower over No. 70** matching the Gordon Block's pyramid corner towers acts as a visual anchor [S34].
- 2-12 Downie / Gordon Block at the Ontario/Downie/Erie corner (see Section 4).
- 48 Ontario: two storeys, linked to the old Albion Hotel; 111-115 Ontario: remnant of the four-storey mansard New Albion Hotel after a 1936 fire left two storeys [S31].
- 102-104 Ontario, Beacon Building (c.1906-07).
- 136 Ontario, "Stratford Place" with a facade mural series [S31].
- 142 Ontario, Knox Presbyterian Church (see Section 9).
- 185-187 and the Queen's Hotel at Ontario/Waterloo, a Neo-Classical Revival 1905 brick hotel with an angled corner cupola [S31].
- East of the centre: houses with commercial reuse: 248 Ontario (Larkworthy House, c.1926; 2.5-storey red-brick, Tudor half-timbered gable and Prairie/Craftsman porch with squat tapered columns and wide eaves) [S35][S31]; 310 Ontario (1881 Italianate, 2-storey buff brick, dentils, quoins, cornice with returns, verandah, 2-over-2 windows) [S36]; 322 Ontario (1894 late Italianate, with verandah and bargeboard) [S37].
- Demolished/replaced (do not model): old post office site now Memorial Park (stone, demolished 1961), Perth Mutual building site (parking), Vogue Theatre [S31].

**Storefront treatment.** Wood-panelled or metal-framed plate-glass storefronts with recessed doors, narrow signboard friezes, and cast-iron slim columns on the 1890s blocks [S18][S19]; modern tenants add flat or striped canvas awnings (fosters_inn_striped_awnings, benessere_shopfront_brick_awning), projecting hanging signs on black brackets, planters and sandwich boards.

**Colours (from photos).** Brick: mid red-brown, orange-red, dark brown; buff/cream; a few painted white and pale green or teal trim (teal/green paint appears on cornices and bay frames); black fascias for signs [photo: market_square_open_space_from_south.jpg, ontario_street_looking_downtown.jpg].

**Disagreement/gap.** Without an address-level map I cannot give per-building storey counts; the photos show 2 and 3 storeys with the corner tower buildings 3 storeys and a few 4-storey buildings further down toward the river. The Ontario Street blocks between City Hall and the Avon (toward Lake Victoria) were not found in detail; the Ontario Street Bridge/Avon river crossing and its buildings are a gap.

### Priority list (street as a whole)
1. Continuous brick street wall of mostly red/brown 2-3 storey buildings.
2. Pyramid-roof corner towers (Gordon Block, No. 70).
3. Upper windows with arched/round heads in rows.
4. Corbelled brick and pressed-metal cornices.
5. Plate-glass storefronts with narrow sign friezes.
6. Awnings, hanging signs, planters.
7. Black twin-head lamp posts with hanging baskets.
8. Flags on poles above doors.
9. Parallel parking and centre yellow line.
10. Closing view at the courthouse tower/spire at the west end.

---

## 8. Downie, Wellington, Albert and York Streets

- **Downie Street**: see Section 4; mix of 2-5 storey brick commercial buildings; transit terminal at Downie [S38][S16].
- **Wellington Street**: City Hall (No. 1) at the head; Brandenberger Block (28-34, 1872; large yellow brick, high Victorian), Easson Block (28-30; originally mansard, c.1930 red brick veneer, buttresses still visible), Worth Block (38-46, 1889; long block with retail ground floor, offices and meeting halls above, a third-floor ballroom, and a pointed centre tower in 1905 photos), No. 88 (1897 Victorian Gothic), a 3-storey metal-clad c.1914 industrial building at No. 258 with 6-over-6 sash windows; butcher and baker storefronts at 22-24 [S9].
- **Albert Street**: red-brick buildings with arched windows (photo: albert_street_no56_red_brick_arched_windows.jpg); no written source collected.
- **York Street** (toward the river, east side of Lake Victoria): a short block of 2-3 storey old buildings (red brick, painted stucco in ochre/yellow, stone rubble), iron fire stairs, black twin lanterns, planters in front of shops, a decorative cast-iron/black bench, and at the end a tall tower in the Shakespearean Gardens visible between trees; large honey-locust-like or ash trees line the right side [photo: york_street_from_lakeside_drive.jpg]. Municipal parking lot signs.

---

## 9. Knox Presbyterian and St. James' Anglican churches

**Knox Presbyterian (142 Ontario Street).** The congregation was organized in 1848; a church by George F. Durand (1887-88) with a ~42 m steeple was destroyed when **lightning ignited the spire on 13 May 1913**, collapsing into the sanctuary; the present church by Brydon & Greig of Toronto was dedicated in 1915; the Sunday School wing dates from 1907 [S39][S31][S40]. **There is no tall spire today.** Photo: a large Gothic Revival / Arts and Crafts church of dark red-brown brick with stepped buttress piers topped by **verdigris-green copper caps**; a huge pointed-arch traceried window (white, many mullions) in the gable end; a side porch with a round-headed arch and dark double doors; a steep green-stained roof; gabled buttress caps in copper along the side; bike rack and hanging baskets at the street [photo: knox_presbyterian_church_front_2025.jpg]. `town.json`: base 2.43, `height` 14.33, `levels` 5.0, gabled, material `stone`, 24-point footprint 32 x 56 m. The photo shows brick, not stone: change the material to brick (dark red-brown). The marker blurb that says it was sold in 2022 and is now the Copperlight venue is consistent with [S40].

**St. James' Anglican (41 Mornington St).** Gundry & Langley; cornerstone 1868, opened 20 March 1870; the third church on the site; Decorated Gothic Revival; main building about 130 x 51 ft, with cut stone weather facings on buttresses and sills, hood moulds and boss terminals; side windows are pairs of pointed windows between buttresses with a small rosette above under an arched hood; west window of three pointed lights and a rosette under a pointed-oval louvre; a row of small triangular dormers in the shingled roof planes; **a 14 x 14 ft bell tower built 1906-09, supported by corner buttresses terminating in four broach spires, with two tall pointed louvred bell openings and four small windows below** [S41][S42][S43]. Material: "white brick" (buff) on the designation notice, the heritage register says buff brick [S41][S42]. Photo: the tower is at the NE corner, square, with four slim pinnacle-like spires at its corners and a lower pierced parapet between them; louvred pointed openings; stone-carved buttress weatherings; stout chimney stack at the left of the roof; spruces beside the front [photo: st_james_anglican_church_side_tower.jpg]. `town.json`: base -0.9, `height` 12.45, `levels` 4.0, gabled, brick_buff, 10-point footprint 66 x 38 m (area 1,294 m2): consistent. Not confirmed: tower height (guess about 25 m to pinnacle tips). Note: the congregation reportedly merged into Holy Trinity in 2026 [S43].

### Priority lists
**Knox:** 1. Dark red-brown brick. 2. Huge pointed gable window. 3. Green copper buttress caps. 4. Round-arched side porch. 5. Stepped buttresses. 6. Steep roof. 7. Low, wide massing with no spire. 8. Street-front on Ontario. 9. Hanging baskets/lantern pole. 10. Tree on the corner.
**St. James:** 1. Buff brick. 2. Square tower with four slim corner spires. 3. Tall louvred bell openings. 4. Gable end with 3-light pointed window and rosette. 5. Stone-capped buttresses. 6. Triangular dormers in roof. 7. Pairs of lancet windows along the nave. 8. Chimney stack. 9. Hall wing in matching brick. 10. Conifers flanking the entrance.

---

## 10. Lakeside Drive, the river, Lake Victoria, bridges, dam, swans

- **Lakeside Drive** ("the River Drive") runs along the south side of Lake Victoria; benches, paths and Art in the Park (May-October, south side between North and Front streets) [S44]. Photo: park-like banks, grass to the water, weeping willows, tall conifers, mown lawns.
- **Lake Victoria** is a seasonal reservoir of the Avon held by the **R. Thomas Orr Dam** (new dam christened October 1967) [S44][S45]. The river is drained each year after the Festival season (the 2025 photos show the lake drained with mud banks) [S44][reference README].
- **Bridges** [S44][photos]: the **Festival Bridge** (Lakeside Drive crossing, floodlit), **LakeSide North Bridge** (north end of the lake), a rustic **arched wooden footbridge to Tom Patterson Island** (brown-stained timber deck and curved handrails, rebuilt by Donald Bell Strudley after 1960s vandalism), and the **1885 double-arch stone bridge on Huron Street**: light buff rubble stone, two shallow segmental arches on a central pier with a stone cutwater, plain parapet with a dark capping course [photo: huron_street_stone_arch_bridge.jpg][S46].
- **Swans:** mute swans (first arrived in 1918, gift of a Grand Trunk official; a pair from Queen Elizabeth II added 1973); two colour groups (black-legged "Royals" and beige-legged "Polish"); 24 white swans released each April; the swans winter at the parks board quarters on Morenz Drive [S44][S47][S48]. No source gives the swans' size beyond "up to 30 pounds".
- **Trees (from photos):** weeping willows on the water edge, white spruce/Norway spruce, silver maple and ash; cherry trees at the Tom Patterson Theatre.

---

## 11. The Shakespearean Gardens and Gallery Stratford

**Shakespearean Gardens** (opened 1936, mainly through R. Thomas Orr; on a site cleared by a 1922 fire). Heritage designation covers the chimney tower, the original stone walls, the lychgate on Huron Street, the knot garden, herb garden, rose garden, perennial border, walkway lamp lighting, the sundial and the bust of Shakespeare; a pergola, the Courthouse and the Huron Street bridge frame it [S49][S50]. Photo: a **slender square brick chimney tower** (buff/tan brick, about 20 m est.) with a small timbered "cap" and a steeply pitched shingled pyramid roof topped by a weathervane; low dry-stone/limestone walls; clipped columnar evergreens; gravel paths with black metal benches and bins; formal beds [photo: shakespearean_gardens_clock_tower_trees.jpg].

**Gallery Stratford (Pump House).** Built 1883 to a design by George F. Durand; "Municipal Gothic with notable Italianate tracery in the brickwork"; designated 1985; one-storey **buff brick**, hip roof with gable ends on the facade, projecting eaves, paired 2-over-2 double-hung windows, red brick arched radiating voussoirs, a **buff brick incinerator stack**, a date stone [S51][S52]. `town.json`: buff brick, 2 levels, hipped, 6.74 m: fits a tall single-storey; the second level is probably the roof/tall interior, and the gallery's 1967 additions are included in the 19-point footprint (bbox 30 x 40 m).

---

## 12. The railway station (101 Shakespeare St)

Built 1913 by the Grand Trunk Railway, opened August 1914, later Canadian National, designated a Heritage Railway Station in 1993; influenced by the Prairie Style (sprawl, low pitch, horizontal lines) [S53][S54]. **Two-storey main block with 13 bays on the track and street faces and three on the end**, symmetrical stepped planes; **broad hipped roofs with long sweeping planes**, central intersecting gables, brick chimneys at either end; **unusually large vitrified brown clay bricks**, a **rock-faced purple granite base** (grey-purple in the photo) up to the window sills; generous windows between narrow brick piers with one-over-one-over-one sashes; deeply recessed doors and windows; a **platform canopy with deep eaves and exposed rafter ends wrapping three sides** and linking to a one-storey express building; a trackside gable with three blind arches over the operator's bay [S53]. The tower (now missing) is part of the designation [S54]. `town.json`: `height` 7.9 m, 2.5 levels, hipped, brick_red, 6 points, 88 x 23 m footprint: the main two-storey block should be about 9-10 m to the eaves (est.) with the one-storey express block (about 5 m) as the low wing; the data likely blends both into one volume. Photo: brown-red brick with grey rough-faced stone base; shallow grey shingled hipped roof; white window trim; hanging flower baskets under the eaves; paving is asphalt [photo: railway_station_front_blue_sky.jpg].

---

## 13. Typical residential streets

Housing is mostly late Victorian: 1.5-2.5 storey buff (white-yellow) or red brick houses in Gothic Revival (steep centre gable with bargeboard and finials), Italianate (low hipped roof, wide bracketed eaves, round-headed hooded windows, sometimes a "widow's walk" with iron cresting, "Stratford porch"/enclosed front porch) and Queen Anne forms, on stone fieldstone foundations, with 2-over-2 or 6-over-6 sash windows, verandahs with turned posts and gingerbread brackets, and bay windows [S36][S55][S56][S57][S58]. Larger examples are Edwardian or Arts and Crafts [S35]. Setbacks are short (about 4-8 m, est.), front yards are raised and held by low dry-laid stone retaining walls with stone steps; porches face the street [photo: houses_wide_porches_street_row.jpg]. Trees: mature maples, ash, and other large deciduous trees overhang the road; grass boulevards between sidewalk and curb; **sidewalks are poured concrete, pale grey, with edge curb in concrete**; overhead wires on tall concrete or grey poles with cobra-head street lamps (grey/white arms) [photo: residential_street_tree_lined_sidewalk.jpg]. Yellow centre line on collector streets.

---

## Street furniture and ground surfaces (whole town)

- **Lamps:** downtown has black cast-style twin-lantern posts (a tall post with two lantern heads on side brackets and flower-basket arms) on Ontario and York Streets; round-globe black lamp standards (cluster of white globes) at City Hall; the Shakespearean Gardens have lantern lamps along the walks [photo: ontario_street_looking_downtown.jpg, york_street_from_lakeside_drive.jpg, city_hall_front_symmetric_2025.jpg][S49]. Residential streets use grey cobra-head lights on wooden/concrete poles.
- **Benches/bins:** black slat benches with curved metal frames; black round or square steel bins (e.g. at Festival Theatre doors); concrete curved benches at the Tom Patterson Theatre; planters: black metal rectangular troughs and square planters with seasonal flowers in front of shops, hanging baskets on lamp poles [photo: york_street_from_lakeside_drive.jpg].
- **Sidewalks and curbs:** pale grey concrete slabs with saw-cut joints, raised concrete curb, asphalt roadway with white parking-stall ticks and yellow centre lines; coloured pavers/stone bands in the new Market Square [S6][S8]; asphalt plaza at the Festival Theatre, gravel paths in the gardens.
- **Crosswalks:** white "ladder" (zebra) style bars at Downie/Ontario and by Huron Street; one crosswalk by City Hall is painted in rainbow colours [photo: downie_street_at_ontario_street.jpg, city_hall_front_symmetric_2025.jpg]. Pedestrian crossovers are a city programme [S59].
- **Traffic signals:** black or yellow-backed signals on side-mounted mast arms; overhead green guide signs over Ontario Street [photo: ontario_street_looking_downtown.jpg].
- **Street trees:** I found no source naming the downtown street-tree species. Photos show honey locust-like fine-leaved trees on York Street, small trees in planters on Ontario Street, and maples, ash and spruce in the parks and residential streets (guess; not confirmed).

---

## Gaps

- No source found for per-building storey counts along Ontario Street between Downie and the river, or for Albert Street; photos are the only evidence.
- Tower heights for City Hall and St. James' are estimates.
- Market Square's as-built paving and furniture are not documented in anything found.
- The City's HCD Standards (Downtown Core HCD, by-law 173-97) are not published online (emailed on request) [S61].
- The Ontario Heritage Trust record for the Courthouse itself was not found.

## Sources

- [S1] Parks Canada, Stratford City Hall NHS (character-defining elements): https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=522
- [S2] Canadian Register of Historic Places, Stratford City Hall: https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=12644
- [S3] Wikipedia, Stratford City Hall: https://en.wikipedia.org/wiki/Stratford_City_Hall
- [S4] Streets of Stratford, Save the Hall: http://www.streetsofstratford.ca/save-the-hall
- [S5] Heritage Guide, Stratford City Hall: https://heritageguide.ca/stratford-city-hall-national-historic-site-of-canada-stratford-ontario
- [S6] Janet Rosenberg & Studio, Stratford Market Square: https://jrstudio.ca/project/stratford-market-square-design-competition
- [S7] City of Stratford, Market Square RFP 15-09 and Rosenberg proposal: https://stratford.ic12.esolg.ca/en/inside-city-hall/resources/MarketSquare/RFP15-09---Janet-Rosenberg-Proposal.pdf
- [S8] CTV Kitchener, Market Square changes: https://kitchener.ctvnews.ca/stratford-market-square-project-sees-some-changes-but-not-over-parking-1.3241488 ; mystratfordnow, reconstruction: https://www.mystratfordnow.com/41478/market-square-reconstruction-moving-along
- [S9] Streets of Stratford, Wellington Street: https://www.streetsofstratford.ca/wellington-street
- [S10] Wikipedia, Perth County Courthouse: https://en.wikipedia.org/wiki/Perth_County_Courthouse
- [S11] Perth County, courthouse panels: https://perthcounty-ca.govstack.com/media/2irfipjx/panel-3-4-perth-county-courthouse.pdf
- [S12] Doors Open Ontario, Perth County Courthouse: https://www.doorsopenontario.on.ca/stratford/perth-county-courthouse
- [S13] Streets of Stratford, The Birth of the New Court House: https://www.streetsofstratford.ca/new-court-house
- [S14] Wikipedia, George F. Durand: https://en.wikipedia.org/wiki/George_F._Durand
- [S15] Wikipedia, Avon Theatre: https://en.wikipedia.org/wiki/Avon_Theatre
- [S16] Streets of Stratford, Downie Street: https://www.streetsofstratford.ca/downie-street
- [S17] CCA, Avon Theatre alterations 1964-67: https://www.cca.qc.ca/en/archives/83643/john-c-parkin-fonds/107546/architectural-projects/501010/avon-theatre-alterations-stratford-ontario-1964-1967
- [S18] Heritage Guide, Gordon Block: https://heritageguide.ca/gordon-block-stratford-ontario
- [S19] Ontario Heritage Trust, by-law 107-84 (10 Downie St, Gordon Block): https://www.heritagetrust.on.ca/oha/details/file?id=12787
- [S20] Ontario Heritage Trust, 111-117 Downie St by-law 1-2000: https://www.heritagetrust.on.ca/oha/details/file?id=11046 and notice https://www.heritagetrust.on.ca/oha/details/file?id=11047
- [S21] Ontario Heritage Trust, 96-100 Downie St by-law 4-99: https://www.heritagetrust.on.ca/fr/oha/details/file?id=11050
- [S22] Wikipedia, Stratford Festival: https://en.wikipedia.org/wiki/Stratford_Festival
- [S23] Streets of Stratford, Fairfield Drive: https://www.streetsofstratford.ca/fairfield-drive
- [S24] Docomomo Ontario, Stratford Festival Theatre: https://docomomo-ontario.ca/gallery/stratford-festival-theatre/
- [S25] Wikipedia, Festival Theatre, Stratford: https://en.wikipedia.org/wiki/Festival_Theatre,_Stratford
- [S26] same as [S24] (grounds, Meighen gardens, KPMB addition)
- [S27] Wikipedia, Tom Patterson Theatre (via the Wikipedia.com mirror): https://en.wikipedia.com/wiki/Tom_Patterson_Theatre
- [S28] Globe and Mail, Tom Patterson Theatre review: https://www.theglobeandmail.com/arts/art-and-architecture/article-stratfords-new-tom-patterson-theatre-deserves-a-standing-ovation/
- [S29] Azure, Hariri Pontarini Tom Patterson Theatre: https://www.azuremagazine.com/article/hariri-pontarini-stratford-festival-tom-patterson-theatre/
- [S30] Thornton Tomasetti, Tom Patterson Theatre: https://www.thorntontomasetti.com/project/tom-patterson-theatre ; Dezeen (search snippet only; page returned 403): https://www.dezeen.com/2022/06/10/hariri-pontarini-tom-patterson-theatre-ontario/amp/
- [S31] Streets of Stratford, Ontario Street: https://www.streetsofstratford.ca/ontario-street
- [S32] Streets of Stratford, Ontario Street, Huron to Downie: https://streetsofstratford.ca/ontario-st-to-downie-street
- [S33] Ontario Heritage Trust, 248 Ontario St: https://www.heritagetrust.on.ca/oha/details/file?id=11054
- [S34] Ontario Heritage Trust, 70 Ontario St by-law 86-86: https://www.heritagetrust.on.ca/oha/details/file?id=12776
- [S35] see [S33] (Larkworthy House)
- [S36] Ontario Heritage Trust, 310 Ontario St: https://www.heritagetrust.on.ca/oha/details/file?id=11072
- [S37] Ontario Heritage Trust, 322 Ontario St by-law 137-86: https://www.heritagetrust.on.ca/oha/details/file?id=12773
- [S38] Wikipedia, Stratford, Ontario: https://en.wikipedia.org/wiki/Stratford,_Ontario
- [S39] Doors Open Ontario, Knox / Copperlight: https://www.doorsopenontario.on.ca/stratford/copperlight-at-knox-presbyterian
- [S40] Visit Perth County, historic churches tour (search snippet): https://visitperth.ca/pdfs/HistoricChurchesTour-with-map.pdf
- [S41] Ontario Heritage Trust, 41 Mornington St (St. James) notice 1983: https://www.heritagetrust.on.ca/oha/details/file?id=11035
- [S42] Ontario Heritage Trust register summary of St. James: https://heritagetrust.on.ca/oha/details/file?id=11035 (as cited in search results)
- [S43] St. James Stratford, A Brief History: https://stjamesstratford.ca/history-of-st-james ; HMDB marker: https://www.hmdb.org/m.asp?m=301695
- [S44] Streets of Stratford, Lakeside Drive: https://www.streetsofstratford.ca/lakeside-drive
- [S45] Streets of Stratford, Evolution of the Avon River: https://streetsofstratford.ca/evolution-of-the-avon-river
- [S46] Lonely Planet, Avon River: https://www.lonelyplanet.com/points-of-interest/avon-river/1365412
- [S47] City of Stratford, Swans and Ducks: https://www.stratford.ca/play-here/parks-forestry/swans-ducks/
- [S48] Wikipedia, Avon River (Ontario): https://en.wikipedia.org/wiki/Avon_River_(Ontario)
- [S49] CTV Kitchener, Shakespearean Gardens 90th anniversary: https://www.ctvnews.ca/kitchener/article/shakespearean-gardens-celebrates-90th-anniversary/
- [S50] Grant Haven, Gardens history: https://www.granthaven.com/post/gardens-history-goes-back-nearly-a-century
- [S51] Heritage Guide, Stratford Waterworks: https://heritageguide.ca/stratford-waterworks-romeo-ontario
- [S52] Wikipedia, Gallery Stratford: https://en.wikipedia.org/wiki/Gallery_Stratford
- [S53] Parks Canada, Former CNR (VIA Rail) Station: https://pc.gc.ca/apps/dfhd/page_hrs_eng.aspx?id=2181
- [S54] Ontario Heritage Trust, 101 Shakespeare St by-law 111-88: https://www.heritagetrust.on.ca/oha/details/file?id=12779
- [S55] Ontario Heritage Trust, 157 Water St: https://www.heritagetrust.on.ca/oha/details/file?id=11026
- [S56] Ontario Heritage Trust, 55 Elizabeth St: https://www.heritagetrust.on.ca/oha/details/file?id=12004
- [S57] Ontario Heritage Trust, 220 Mornington St: https://www.heritagetrust.on.ca/oha/details/file?id=12006 ; 86 Milton St: https://www.heritagetrust.on.ca/fr/oha/details/file?id=11066 ; 89 Norman St: https://www.heritagetrust.on.ca/oha/details/file?id=11995
- [S58] Ontario Heritage Trust, 210 Cambria St: https://www.heritagetrust.on.ca/oha/details/file?id=11999
- [S59] ConstructConnect, Stratford pedestrian crossovers: https://projects.constructconnect.com/details/6345669-2023-pedestrian-crossovers&find_loc=-N5A-1W7
- [S60] (unused)
- [S61] City of Stratford, Heritage Conservation District page: https://stratford.ca/live-here/heritage-stratford/heritage-conservation-district/ ; Ontario Heritage Trust HCD record: https://www.heritagetrust.on.ca/oha/hcd-details?id=96
- Repository reference photos used for observation only (openly licensed, already in `reference/stratford/`): see `reference/README.md`.

**Blocked/failed hosts:** dezeen.com returned 403 through the proxy (not worked around); a few Wikipedia titles 404; the Visit Perth PDFs returned 526 once. Per-photo licences for the `reference/stratford/` images are in `reference/README.md`.
