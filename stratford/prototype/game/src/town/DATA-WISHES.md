# Town data wishes

Things the town code (`src/town/`) would use from `game/data/town.json`, for
the data pipeline (`tools/town/`) to consider. The town works without all of
them: each has a fallback, noted below.

- **Landmark materials.** The reference photos show the Perth County
  Courthouse in buff brick with red-brown trim (the data says `brick_red`),
  St. James' Anglican in grey stone (`brick_buff`) and Knox Presbyterian in
  dark red brick (`stone`). `landmarks.js` overrides them for now; a
  `material` from `building:material` / photos in the data would be better.
- **City Hall's `front`.** Its `front` edge is not the Market Square side, where
  the clock tower stands. The town picks the edge facing the `market-square`
  landmark instead. A `towerAt: [x, z]` (or the tower as a `building:part`)
  would let the tower land exactly where it is.
- **Tower and spire heights** (`building:part` with `height`, or LiDAR DSM
  maxima inside the footprint): towers and steeples are proportioned by rule.
- **Roof colour / material** (`roof:colour`, `roof:material`): roofs are picked
  from a palette by a hash of the building id.
- **Sidewalk widths** (`sidewalk:*:width`, or the OSM sidewalk ways matched to
  their street): the town assumes 4.4 m downtown and 4.0 m (2.1 m grass
  boulevard + concrete) on residential streets.
- **Crossings.** Zebra crosswalks come from footways that cross a carriageway,
  plus downtown junctions; `footway=crossing` / `crossing=*` tags would be
  more faithful.
- **Bridge decks.** Deck heights are interpolated between the bank heights
  with a small arch; a deck height from the LiDAR DSM along each `bridge` way
  would match the real bridges.
- **Trees.** Used as given (kind, height, crown). If a release ever falls back
  to uniform placeholder trees, `prepareTrees` varies their sizes.
